import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/index';
import { db } from '../server/db/database';
import { seedDatabase } from '../server/db/seed';

let devTokens: Record<string, string> = {};
let customerTokenA: string = '';
let customerTokenB: string = '';
let customerCookieA: string = '';
let customerCookieB: string = '';
let adminToken: string = '';
let adminCookie: string = '';
let tableSessionCookie: string = '';

beforeAll(async () => {
  const seedResult = await seedDatabase();
  devTokens = seedResult.initialTokens;
});

describe('1. Table Security & Zero ID Leakage', () => {
  it('should accept a valid opaque table token and return no internal table identifiers', async () => {
    const validToken = devTokens['T-01'];
    expect(validToken).toBeDefined();

    const res = await request(app)
      .post('/api/table/session')
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Table verified successfully.');
    expect(res.body.sessionActive).toBe(true);
    
    // CRITICAL SECURITY ASSERTIONS:
    // Internal DB table id and internal table code MUST NEVER be in the response
    expect(res.body.table_id).toBeUndefined();
    expect(res.body.tableId).toBeUndefined();
    expect(res.body.internal_table_code).toBeUndefined();
    expect(res.body.tableCode).toBeUndefined();
    expect(res.body.id).toBeUndefined();

    // Verify session cookie was set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('table_session='))).toBe(true);
    
    tableSessionCookie = cookies.find((c: string) => c.includes('table_session=')) || '';
  });

  it('should reject table enumeration (sequential IDs, manipulated tokens, plaintext table codes)', async () => {
    const invalidAttempts = ['1', '2', 'T-01', 'table_1', 'admin', '00000000000000000000000000000000'];

    for (const attempt of invalidAttempts) {
      const res = await request(app)
        .post('/api/table/session')
        .send({ token: attempt });

      expect(res.status).toBe(403);
      expect(res.body.sessionActive).toBe(false);
    }
  });

  it('should verify active table session via GET /api/table/session without leaking IDs', async () => {
    const res = await request(app)
      .get('/api/table/session')
      .set('Cookie', [tableSessionCookie]);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.table_id).toBeUndefined();
    expect(res.body.internal_table_code).toBeUndefined();
  });
});

describe('2. Customer Authentication & OTP Security', () => {
  it('should request OTP for a valid mobile number', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('OTP sent successfully');
  });

  it('should reject immediate OTP resend due to 60-second cooldown', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: '9876543210' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Please wait');
    expect(res.body.cooldownRemaining).toBeGreaterThan(0);
  });

  it('should reject invalid OTP and report remaining attempts', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9876543210', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Incorrect OTP');
    expect(res.body.attemptsRemaining).toBeDefined();
  });

  it('should successfully verify valid OTP and establish Customer A session', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9876543210', otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.phone).toBe('+919876543210');
    expect(res.body.token).toBeDefined();

    customerTokenA = res.body.token;
    customerCookieA = res.headers['set-cookie']?.find((c: string) => c.includes('customer_token=')) || '';
  });

  it('should authenticate Customer B with distinct phone number', async () => {
    // Request & verify Customer B
    await request(app).post('/api/auth/request-otp').send({ phone: '9123456789' });
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '9123456789', otp: '123456' });

    expect(res.status).toBe(200);
    customerTokenB = res.body.token;
    customerCookieB = res.headers['set-cookie']?.find((c: string) => c.includes('customer_token=')) || '';
  });
});

describe('3. Order Price Manipulation & Authoritative Server Pricing', () => {
  let createdOrderNumber: string = '';

  it('should strictly ignore client-submitted prices and calculate totals from database', async () => {
    // Menu item 1 is Garlic Bruschetta (DB price = ₹240.00)
    // Menu item 16 is Hazelnut Iced Latte (DB price = ₹240.00)
    // Total subtotal should be ₹480.00, Tax (5%) = ₹24.00, Total = ₹504.00
    // We intentionally send fake prices (e.g. ₹1.00 each, total ₹2.00) to attempt manipulation
    const tamperedPayload = {
      items: [
        { menu_item_id: 1, quantity: 1, unit_price: 1.00, total: 1.00 },
        { menu_item_id: 16, quantity: 1, unit_price: 1.00, total: 1.00 }
      ],
      client_subtotal: 2.00,
      client_total: 2.00,
      payment_method: 'CASH',
      notes: 'Please make it extra hot'
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', [tableSessionCookie, customerCookieA])
      .send(tamperedPayload);

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    
    const order = res.body.order;
    createdOrderNumber = order.public_order_number;

    // Verify authoritative server calculation
    expect(order.subtotal).toBe(480.00);
    expect(order.tax).toBe(24.00);
    expect(order.total).toBe(504.00);
    expect(order.payment_method).toBe('CASH');
    expect(order.payment_status).toBe('PENDING');
    expect(order.order_status).toBe('PENDING');

    // Verify items snapshot
    expect(order.items.length).toBe(2);
    expect(order.items[0].unit_price_snapshot).toBe(240.00);
    expect(order.items[1].unit_price_snapshot).toBe(240.00);

    // Verify table ID is NOT exposed in customer response
    expect(order.table_id).toBeUndefined();
    expect(order.tableId).toBeUndefined();
    expect(order.internal_table_code).toBeUndefined();
  });

  it('should reject ordering unavailable or non-existent items', async () => {
    // Non-existent item
    const res1 = await request(app)
      .post('/api/orders')
      .set('Cookie', [tableSessionCookie, customerCookieA])
      .send({
        items: [{ menu_item_id: 99999, quantity: 1 }],
        payment_method: 'CASH'
      });
    expect(res1.status).toBe(400);

    // Invalid quantity
    const res2 = await request(app)
      .post('/api/orders')
      .set('Cookie', [tableSessionCookie, customerCookieA])
      .send({
        items: [{ menu_item_id: 1, quantity: 0 }],
        payment_method: 'CASH'
      });
    expect(res2.status).toBe(400);
  });
});

describe('4. Customer Data Isolation & IDOR Defense', () => {
  let orderNumberA: string = '';

  beforeAll(async () => {
    // Create an order for Customer A
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', [tableSessionCookie, customerCookieA])
      .send({
        items: [{ menu_item_id: 6, quantity: 1 }], // Alfredo Pasta ₹380
        payment_method: 'UPI'
      });
    orderNumberA = res.body.order.public_order_number;
  });

  it('should allow Customer A to access their own order by public order number', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderNumberA}`)
      .set('Cookie', [customerCookieA]);

    expect(res.status).toBe(200);
    expect(res.body.order.public_order_number).toBe(orderNumberA);
  });

  it('should PREVENT Customer B from accessing Customer A order (IDOR attack test)', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderNumberA}`)
      .set('Cookie', [customerCookieB]);

    // Must be rejected (404/403)
    expect(res.status).toBe(404);
    expect(res.body.order).toBeUndefined();
  });

  it('should ensure Customer B order history contains only Customer B orders', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Cookie', [customerCookieB]);

    expect(res.status).toBe(200);
    const orders = res.body.orders;
    expect(orders.some((o: any) => o.public_order_number === orderNumberA)).toBe(false);
  });
});

describe('5. Historical Price Snapshot Immutability', () => {
  it('should maintain immutable price snapshots in past orders when menu item price changes', async () => {
    // Step 1: Place order with Menu Item 7 (Margherita Pizza, initial price ₹420.00)
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', [tableSessionCookie, customerCookieA])
      .send({
        items: [{ menu_item_id: 7, quantity: 1 }],
        payment_method: 'CASH'
      });

    const publicNo = orderRes.body.order.public_order_number;
    expect(orderRes.body.order.subtotal).toBe(420.00);

    // Step 2: Simulate price change in database for Menu Item 7 (increased to ₹550.00)
    db.prepare('UPDATE menu_items SET price = 550.00 WHERE id = 7').run();

    // Step 3: Fetch historical order and verify snapshots remain unchanged at ₹420.00
    const historicalRes = await request(app)
      .get(`/api/orders/${publicNo}`)
      .set('Cookie', [customerCookieA]);

    expect(historicalRes.status).toBe(200);
    expect(historicalRes.body.order.subtotal).toBe(420.00);
    expect(historicalRes.body.order.items[0].unit_price_snapshot).toBe(420.00);
  });
});

describe('6. Admin Authorization & Privileged Operations', () => {
  it('should reject unauthenticated access to admin endpoints', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('should reject customer tokens attempting to access admin endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [customerCookieA]);

    expect(res.status).toBe(403);
  });

  it('should authenticate admin user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({
        email: 'admin@cafe.local',
        password: 'Admin@12345'
      });

    expect(res.status).toBe(200);
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.role).toBe('ADMIN');
    expect(res.body.token).toBeDefined();

    adminToken = res.body.token;
    adminCookie = res.headers['set-cookie']?.find((c: string) => c.includes('admin_token=')) || '';
  });

  it('should allow admin to view dashboard stats and live orders', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', [adminCookie]);

    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.today_orders_count).toBeGreaterThanOrEqual(0);
  });

  it('should allow admin to regenerate table token and invalidate old token (Token Replay Test)', async () => {
    const oldToken = devTokens['T-01'];

    // Regenerate Table 1 token
    const regenRes = await request(app)
      .post('/api/admin/tables/1/regenerate-token')
      .set('Cookie', [adminCookie]);

    expect(regenRes.status).toBe(200);
    expect(regenRes.body.rawToken).toBeDefined();
    const newToken = regenRes.body.rawToken;
    expect(newToken).not.toBe(oldToken);

    // 1. Old token must now be REJECTED (Replay attack prevention)
    const oldAttempt = await request(app)
      .post('/api/table/session')
      .send({ token: oldToken });
    expect(oldAttempt.status).toBe(403);

    // 2. Previously active session on Table 1 is now INVALIDATED
    const oldSessionAttempt = await request(app)
      .get('/api/table/session')
      .set('Cookie', [tableSessionCookie]);
    expect(oldSessionAttempt.status).toBe(403);

    // 3. New token is ACCEPTED
    const newAttempt = await request(app)
      .post('/api/table/session')
      .send({ token: newToken });
    expect(newAttempt.status).toBe(200);
    expect(newAttempt.body.success).toBe(true);
  });

  it('should allow staff/admin to verify cash payment at counter', async () => {
    // Sample Order 2 was seeded as CASH PENDING
    const verifyRes = await request(app)
      .post('/api/admin/payments/2/verify-cash')
      .set('Cookie', [adminCookie]);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toContain('Cash payment confirmed');

    // Check payment record in admin payments
    const paymentsRes = await request(app)
      .get('/api/admin/payments?status=PAID')
      .set('Cookie', [adminCookie]);

    expect(paymentsRes.status).toBe(200);
    expect(paymentsRes.body.payments.some((p: any) => p.order_id === 2 && p.status === 'PAID')).toBe(true);
  });
});
