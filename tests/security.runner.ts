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
let staffToken: string = '';
let staffCookie: string = '';
let tableSessionCookie: string = '';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failedCount++;
    throw new Error(`Assertion Failed: ${msg}`);
  } else {
    console.log(`✅ PASS: ${msg}`);
    passedCount++;
  }
}

async function runAllSecurityTests() {
  console.log('\n======================================================');
  console.log('🛡️  RUNNING COMPREHENSIVE SECURITY & BUSINESS TESTS  🛡️');
  console.log('======================================================\n');

  const seedResult = await seedDatabase();
  devTokens = seedResult.initialTokens;

  // -------------------------------------------------------------
  // Test 1: Table Token & Zero ID Leakage
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 1: Table Security & Zero ID Leakage ---');
  const validToken = devTokens['T-01'];
  assert(!!validToken, 'Dev table token exists');

  const tableRes = await request(app)
    .post('/api/table/session')
    .send({ token: validToken });

  assert(tableRes.status === 200, 'POST /api/table/session returns 200');
  assert(tableRes.body.success === true, 'Response contains success=true');
  assert(tableRes.body.message === 'Table verified successfully.', 'Response contains table verified message');
  assert(tableRes.body.table_id === undefined, 'ZERO LEAKAGE: table_id is undefined in response');
  assert(tableRes.body.internal_table_code === undefined, 'ZERO LEAKAGE: internal_table_code is undefined in response');
  assert(tableRes.body.id === undefined, 'ZERO LEAKAGE: id is undefined in response');

  const setCookies = tableRes.headers['set-cookie'] as string[] | undefined;
  assert(!!setCookies && setCookies.some((c: string) => c.includes('table_session=')), 'HttpOnly table_session cookie is set');
  tableSessionCookie = setCookies?.find((c: string) => c.includes('table_session=')) || '';

  // Test table enumeration prevention
  for (const fakeToken of ['1', '2', 'T-01', 'table_1', '00000000000000000000000000000000']) {
    const fakeRes = await request(app)
      .post('/api/table/session')
      .send({ token: fakeToken });
    assert(fakeRes.status === 403, `Table enumeration rejected for "${fakeToken}" with 403`);
  }

  // -------------------------------------------------------------
  // Test 2: Customer Authentication & OTP Security
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Customer Authentication & OTP Security ---');
  const otpRes = await request(app).post('/api/auth/request-otp').send({ phone: '9876543210' });
  assert(otpRes.status === 200, 'OTP requested successfully for 9876543210');

  // Cooldown test
  const cooldownRes = await request(app).post('/api/auth/request-otp').send({ phone: '9876543210' });
  assert(cooldownRes.status === 400, 'Immediate OTP resend blocked by 60s cooldown');
  assert(cooldownRes.body.cooldownRemaining > 0, 'Cooldown remaining seconds provided');

  // Invalid OTP test
  const invalidOtpRes = await request(app).post('/api/auth/verify-otp').send({ phone: '9876543210', otp: '000000' });
  assert(invalidOtpRes.status === 400, 'Invalid OTP rejected');
  assert(invalidOtpRes.body.attemptsRemaining !== undefined, 'Remaining attempts tracked');

  // Valid Customer A verification
  const verifyResA = await request(app).post('/api/auth/verify-otp').send({ phone: '9876543210', otp: '123456' });
  assert(verifyResA.status === 200, 'Customer A verified with OTP');
  customerTokenA = verifyResA.body.token;
  customerCookieA = verifyResA.headers['set-cookie']?.find((c: string) => c.includes('customer_token=')) || '';

  // Customer B verification
  await request(app).post('/api/auth/request-otp').send({ phone: '9123456789' });
  const verifyResB = await request(app).post('/api/auth/verify-otp').send({ phone: '9123456789', otp: '123456' });
  assert(verifyResB.status === 200, 'Customer B verified with OTP');
  customerTokenB = verifyResB.body.token;
  customerCookieB = verifyResB.headers['set-cookie']?.find((c: string) => c.includes('customer_token=')) || '';

  // -------------------------------------------------------------
  // Test 3: OTP Brute-Force & Expiry Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: OTP Brute-Force & Expiration Defense ---');
  const brutePhone = '9800000000';
  await request(app).post('/api/auth/request-otp').send({ phone: brutePhone });

  for (let i = 1; i <= 5; i++) {
    const attempt = await request(app).post('/api/auth/verify-otp').send({ phone: brutePhone, otp: '999999' });
    assert(attempt.status === 400, `Brute force attempt ${i}/5 rejected with 400`);
  }

  // 6th attempt after max attempts exceeded should be locked out
  const lockedOutAttempt = await request(app).post('/api/auth/verify-otp').send({ phone: brutePhone, otp: '123456' });
  assert(lockedOutAttempt.status === 400, 'Locked-out OTP record rejected even with correct OTP');

  // Expired OTP test: insert an expired OTP record
  const expiredPhone = '+919999988888';
  await db.run(`
    INSERT INTO otp_records (phone, otp_hash, attempts, max_attempts, expires_at, last_sent_at)
    VALUES (?, 'dummyhash', 0, 5, datetime('now', '-10 minutes'), datetime('now', '-10 minutes'))
  `, [expiredPhone]);

  const expiredRes = await request(app).post('/api/auth/verify-otp').send({ phone: expiredPhone, otp: '123456' });
  assert(expiredRes.status === 400 && expiredRes.body.error?.includes('expired'), 'Expired OTP rejected with expiration notice');

  // -------------------------------------------------------------
  // Test 4: Price & Quantity Tampering Defense
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Price & Quantity Tampering Defense ---');
  // Attempt quantity = 0
  const zeroQtyRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({ items: [{ menu_item_id: 1, quantity: 0 }], payment_method: 'CASH' });
  assert(zeroQtyRes.status === 400, 'Quantity = 0 rejected with 400');

  // Attempt quantity = -3
  const negQtyRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({ items: [{ menu_item_id: 1, quantity: -3 }], payment_method: 'CASH' });
  assert(negQtyRes.status === 400, 'Negative quantity rejected with 400');

  // Attempt quantity = 100 (> 50 limit)
  const hugeQtyRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({ items: [{ menu_item_id: 1, quantity: 100 }], payment_method: 'CASH' });
  assert(hugeQtyRes.status === 400, 'Quantity > 50 rejected with 400');

  // Attempt to buy Garlic Bruschetta (₹240) and Alfredo Fettuccine (₹380) with ₹1 manipulated price
  const tamperedOrderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({
      items: [
        { menu_item_id: 1, quantity: 1, client_price: 1.00 },
        { menu_item_id: 6, quantity: 1, client_price: 1.00 }
      ],
      client_total: 2.00,
      payment_method: 'CASH',
      notes: 'No onions'
    });

  assert(tamperedOrderRes.status === 201, 'Order created successfully');
  const orderA = tamperedOrderRes.body.order;
  assert(orderA.subtotal === 620.00, `Authoritative subtotal ₹620.00 calculated (tampered ₹2.00 ignored)`);
  assert(orderA.tax === 31.00, `Authoritative tax ₹31.00 (5%) calculated`);
  assert(orderA.total === 651.00, `Authoritative total ₹651.00 calculated`);
  assert(orderA.items[0].unit_price_snapshot === 240.00, 'Item 1 snapshot price is ₹240.00');
  assert(orderA.items[1].unit_price_snapshot === 380.00, 'Item 2 snapshot price is ₹380.00');
  assert(orderA.table_id === undefined, 'Customer order response does NOT leak table_id');

  // -------------------------------------------------------------
  // Test 5: Idempotency & Duplicate Order Submission
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Idempotency & Duplicate Submissions ---');
  const idempKey = 'idemp_key_unique_test_123';
  const initialOrderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({
      items: [{ menu_item_id: 2, quantity: 1 }],
      payment_method: 'UPI',
      idempotency_key: idempKey
    });
  assert(initialOrderRes.status === 201, 'First order with idempotency key created');
  const initialOrderNo = initialOrderRes.body.order.public_order_number;
  const initialOrderTotal = initialOrderRes.body.order.total;

  const duplicateOrderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({
      items: [{ menu_item_id: 2, quantity: 1 }],
      payment_method: 'UPI',
      idempotency_key: idempKey
    });
  assert(duplicateOrderRes.status === 201, 'Duplicate submission returns cached response');
  assert(duplicateOrderRes.body.order.public_order_number === initialOrderNo, 'Duplicate submission does NOT create new order');

  // -------------------------------------------------------------
  // Test 6: Customer Data Isolation & IDOR Protection
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Customer Data Isolation (IDOR Defense) ---');
  const publicOrderNo = orderA.public_order_number;

  // Customer A can view their own order
  const getOwnerRes = await request(app)
    .get(`/api/orders/${publicOrderNo}`)
    .set('Cookie', [customerCookieA]);
  assert(getOwnerRes.status === 200, 'Customer A can view their own order');

  // Customer B CANNOT view Customer A's order
  const getIdorRes = await request(app)
    .get(`/api/orders/${publicOrderNo}`)
    .set('Cookie', [customerCookieB]);
  assert(getIdorRes.status === 404, 'IDOR ATTACK BLOCKED: Customer B cannot access Customer A order (404)');

  // Customer B order history does not contain Customer A order
  const getHistoryB = await request(app)
    .get('/api/orders')
    .set('Cookie', [customerCookieB]);
  assert(getHistoryB.status === 200, 'Customer B can fetch their order history');
  assert(!getHistoryB.body.orders.some((o: any) => o.public_order_number === publicOrderNo), 'Customer B history is isolated');

  // -------------------------------------------------------------
  // Test 7: Historical Price Immutability
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 7: Historical Price Snapshot Immutability ---');
  // Update Item 1 price in database to ₹500.00
  await db.run('UPDATE menu_items SET price = 500.00 WHERE id = 1');

  // Retrieve past order and verify it STILL has original snapshot ₹240.00
  const checkHistory = await request(app)
    .get(`/api/orders/${publicOrderNo}`)
    .set('Cookie', [customerCookieA]);
  assert(checkHistory.body.order.subtotal === 620.00, 'Historical order subtotal remains unchanged at ₹620.00');
  assert(checkHistory.body.order.items[0].unit_price_snapshot === 240.00, 'Historical item snapshot remains at ₹240.00 (not overwritten by ₹500.00)');

  // -------------------------------------------------------------
  // Test 8: Unavailable Items Rejection
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 8: Unavailable Items Rejection ---');
  // Mark Item 3 unavailable
  await db.run('UPDATE menu_items SET available = 0 WHERE id = 3');

  const unavailableOrderRes = await request(app)
    .post('/api/orders')
    .set('Cookie', [tableSessionCookie, customerCookieA])
    .send({ items: [{ menu_item_id: 3, quantity: 1 }], payment_method: 'CASH' });
  assert(unavailableOrderRes.status === 400, 'Ordering unavailable item rejected with 400');
  assert(unavailableOrderRes.body.error?.includes('unavailable'), 'Unavailable item error message provided');

  // -------------------------------------------------------------
  // Test 9: Direct UPI Intent Generation & Verification Flow
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 9: Direct UPI Intent & Verification ---');
  // Customer A requests UPI details for initialOrderNo
  const upiIntentRes = await request(app)
    .get(`/api/payments/${initialOrderNo}/upi`)
    .set('Cookie', [customerCookieA]);

  assert(upiIntentRes.status === 200, 'Customer fetched direct UPI payment intent');
  assert(upiIntentRes.body.upiUrl.startsWith('upi://pay?'), 'UPI URL is valid upi:// intent link');
  assert(upiIntentRes.body.upiUrl.includes('pa='), 'UPI URL contains payee VPA pa=');
  assert(upiIntentRes.body.upiUrl.includes(`am=${initialOrderTotal.toFixed(2)}`), `UPI URL contains authoritative server amount am=${initialOrderTotal.toFixed(2)}`);
  assert(upiIntentRes.body.upiUrl.includes('cu=INR'), 'UPI URL contains cu=INR');
  assert(upiIntentRes.body.qrDataUrl.startsWith('data:image/png;base64,'), 'Dynamic UPI QR image generated');
  assert(upiIntentRes.body.amount === initialOrderTotal, 'Server authoritative amount returned');

  // Verify order payment remains PENDING (Customer cannot mark as paid)
  const checkPendingOrder = await request(app).get(`/api/orders/${initialOrderNo}`).set('Cookie', [customerCookieA]);
  assert(checkPendingOrder.body.order.payment_status === 'PENDING', 'Order payment status remains PENDING until staff verification');

  // Customer cannot verify UPI payment
  const custVerifyUpi = await request(app)
    .post(`/api/admin/payments/2/verify-upi`)
    .set('Authorization', `Bearer ${customerTokenA}`);
  assert(custVerifyUpi.status === 403, 'Customer cannot call verify-upi endpoint (403)');

  // -------------------------------------------------------------
  // Test 10: Admin Authorization & Staff RBAC
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 10: Admin Authorization & Staff RBAC ---');
  // Unauthenticated access rejected
  const unauthRes = await request(app).get('/api/admin/dashboard');
  assert(unauthRes.status === 401, 'Unauthenticated request to admin route rejected with 401');

  // Customer bearer token rejected from admin routes with 403
  const nonAdminBearerRes = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${customerTokenA}`);
  assert(nonAdminBearerRes.status === 403, 'Customer token rejected from admin routes with 403');

  // Customer tries to confirm cash payment with authorization bearer token -> 403
  const custConfirmCash = await request(app)
    .post('/api/admin/payments/1/verify-cash')
    .set('Authorization', `Bearer ${customerTokenA}`);
  assert(custConfirmCash.status === 403, 'Customer cannot confirm cash payment (403)');

  // Staff login (role = STAFF)
  const staffLoginRes = await request(app)
    .post('/api/admin/login')
    .send({ email: 'staff@cafe.local', password: 'Staff@12345' });
  assert(staffLoginRes.status === 200, 'Staff logged in successfully');
  staffToken = staffLoginRes.body.token;
  staffCookie = staffLoginRes.headers['set-cookie']?.find((c: string) => c.includes('admin_token=')) || '';

  // Staff CAN view orders
  const staffOrdersRes = await request(app).get('/api/admin/orders').set('Cookie', [staffCookie]);
  assert(staffOrdersRes.status === 200, 'Staff can view live kitchen orders');

  // Staff CANNOT regenerate table token (requires ADMIN role)
  const staffRegenRes = await request(app).post('/api/admin/tables/1/regenerate-token').set('Cookie', [staffCookie]);
  assert(staffRegenRes.status === 403, 'Staff rejected from ADMIN-only regenerate table token (403)');

  // Staff CANNOT delete menu items (requires ADMIN role)
  const staffDeleteMenuRes = await request(app).delete('/api/admin/menu/1').set('Cookie', [staffCookie]);
  assert(staffDeleteMenuRes.status === 403, 'Staff rejected from ADMIN-only delete menu item (403)');

  // Admin login (role = ADMIN)
  const adminLoginRes = await request(app)
    .post('/api/admin/login')
    .send({ email: 'admin@cafe.local', password: 'Admin@12345' });
  assert(adminLoginRes.status === 200, 'Super Admin logged in successfully');
  adminToken = adminLoginRes.body.token;
  adminCookie = adminLoginRes.headers['set-cookie']?.find((c: string) => c.includes('admin_token=')) || '';

  // Admin CAN regenerate table token
  const adminRegenRes = await request(app).post('/api/admin/tables/1/regenerate-token').set('Cookie', [adminCookie]);
  assert(adminRegenRes.status === 200, 'Super Admin authorized to regenerate table token');
  const newToken = adminRegenRes.body.rawToken;
  assert(newToken !== validToken, 'New token is cryptographically distinct from old token');

  // -------------------------------------------------------------
  // Test 11: Token Revocation, Replay Defense & Staff Payment Verifications
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 11: Token Revocation, Replay & Staff Payments ---');
  // Old token is rejected
  const oldAttempt = await request(app).post('/api/table/session').send({ token: validToken });
  assert(oldAttempt.status === 403, 'TOKEN REPLAY DEFENSE: Revoked table token is rejected (403)');

  // Old session cookie is invalidated
  const oldSessionAttempt = await request(app).get('/api/table/session').set('Cookie', [tableSessionCookie]);
  assert(oldSessionAttempt.status === 403, 'Old table session cookie is invalidated');

  // New token is accepted
  const newAttempt = await request(app).post('/api/table/session').send({ token: newToken });
  assert(newAttempt.status === 200, 'New table token accepted');

  // Staff/Admin verifies Cash Payment for Sample Order 2
  const verifyCashRes = await request(app).post('/api/admin/payments/2/verify-cash').set('Cookie', [staffCookie]);
  assert(verifyCashRes.status === 200, 'Staff verified cash payment at counter');

  // Staff/Admin verifies UPI Payment for initialOrderNo
  const order4 = await db.get<{ id: number }>('SELECT id FROM orders WHERE public_order_number = ?', [initialOrderNo]);
  const verifyUpiRes = await request(app)
    .post(`/api/admin/payments/${order4!.id}/verify-upi`)
    .set('Cookie', [staffCookie])
    .send({ transaction_reference: 'UPI-UTR-999888' });
  assert(verifyUpiRes.status === 200, 'Staff verified direct UPI payment');

  // Customer querying order now sees payment_status = PAID
  const paidOrderRes = await request(app).get(`/api/orders/${initialOrderNo}`).set('Cookie', [customerCookieA]);
  assert(paidOrderRes.body.order.payment_status === 'PAID', 'Customer order now reflects PAID after staff verification');

  console.log('\n======================================================');
  console.log(`🎉 ALL TESTS COMPLETED! Passed: ${passedCount}, Failed: ${failedCount}`);
  console.log('======================================================\n');
}

runAllSecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
