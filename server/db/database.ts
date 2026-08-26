import { createClient as createWebClient, Client } from '@libsql/client/web';
import dotenv from 'dotenv';
import { hashPassword, hashToken, generateOpaqueToken } from '../utils/crypto';

dotenv.config();

let remoteClient: Client | null = null;
const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl) {
  try {
    remoteClient = createWebClient({ url: tursoUrl, authToken: tursoToken });
  } catch (e) {
    console.warn('[Remote Turso Init Note]:', e);
  }
}

// -------------------------------------------------------------
// In-Memory Data Store for Zero-Dependency Vercel Demo Execution
// -------------------------------------------------------------
interface User { id: number; phone: string; created_at: string; updated_at: string; }
interface AdminUser { id: number; email: string; password_hash: string; role: 'ADMIN' | 'STAFF'; created_at: string; updated_at: string; }
interface Table { id: number; internal_table_code: string; secure_token_hash: string; status: string; created_at: string; updated_at: string; }
interface TableSession { id: number; session_id: string; session_token_hash: string; table_id: number; expires_at: string; created_at: string; }
interface OtpRecord { id: number; phone: string; otp_hash: string; attempts: number; max_attempts: number; expires_at: string; last_sent_at: string; created_at: string; }
interface MenuCategory { id: number; name: string; display_order: number; created_at: string; updated_at: string; }
interface MenuItem { id: number; category_id: number; name: string; description: string; price: number; image_url: string; available: number; is_veg: number; is_spicy: number; created_at: string; updated_at: string; }
interface Order { id: number; public_order_number: string; user_id: number; table_id: number; subtotal: number; tax: number; total: number; payment_method: string; payment_status: string; order_status: string; notes: string | null; created_at: string; updated_at: string; }
interface OrderItem { id: number; order_id: number; menu_item_id: number | null; item_name_snapshot: string; unit_price_snapshot: number; quantity: number; total: number; created_at: string; }
interface Payment { id: number; order_id: number; method: string; amount: number; status: string; transaction_reference: string | null; verified_by: number | null; verified_at: string | null; created_at: string; updated_at: string; }
interface IdempotencyKey { id: number; idempotency_key: string; response_status: number; response_body: string; created_at: string; }

class MemoryStore {
  users: User[] = [];
  admin_users: AdminUser[] = [];
  tables: Table[] = [];
  table_sessions: TableSession[] = [];
  otp_records: OtpRecord[] = [];
  menu_categories: MenuCategory[] = [];
  menu_items: MenuItem[] = [];
  orders: Order[] = [];
  order_items: OrderItem[] = [];
  payments: Payment[] = [];
  idempotency_keys: IdempotencyKey[] = [];

  nextId = {
    users: 1, admin_users: 1, tables: 1, table_sessions: 1, otp_records: 1,
    menu_categories: 1, menu_items: 1, orders: 1, order_items: 1, payments: 1, idempotency_keys: 1
  };

  initialized = false;

  async initSeed() {
    if (this.initialized) return;

    // 1. Admin & Staff
    const adminHash = await hashPassword('Admin@12345');
    const staffHash = await hashPassword('Staff@12345');

    this.admin_users = [
      { id: 1, email: 'admin@cafe.local', password_hash: adminHash, role: 'ADMIN', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, email: 'staff@cafe.local', password_hash: staffHash, role: 'STAFF', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    this.nextId.admin_users = 3;

    // 2. Tables
    const defaultTokens = [
      '09ab0899e3b9d278b106accc3e53f588d50d04eedc55c2c31f7cc792ddfacfc9',
      'b90385da02272bffecdb1574fa149703d374796977bdf4acf7b422e8cfe6e47e',
      '30b3509ad8e728d7599118653d934e7a424169552cf60d1e8974b392fdbb3572',
      '1982465fb1f8c06dc79a5a5c5586e79566bdb7c5db14710bdb62550d6e117b06',
      'fe3af01df00823e4879eee7131bce7037adf6da978324fa702218a4368c90751',
      'a441643d09da013c68c3f8e2949674ea5053b0ecae16c7c8f816080913c85ad6',
      '9de14f625b8bd9af198335af84d1a7655d618c00df61989f7e7ec8c880edce27',
      '1af211ae9d22784a2cb4955476430f7f4b331109b5149ce2b07c69cbad3f3929',
      '8557c0c5e14ff933e277e294fed8ddca8101cd4a9e079bcee2cb0023b005435b',
      '2a7c9364b2f5db34b2cecce20b67308c8a53cefd5894a678ac913fec2619ae01'
    ];

    this.tables = [];
    for (let i = 1; i <= 10; i++) {
      const code = `T-${i < 10 ? '0' + i : i}`;
      const raw = defaultTokens[i - 1] || generateOpaqueToken();
      this.tables.push({
        id: i,
        internal_table_code: code,
        secure_token_hash: hashToken(raw),
        status: i === 4 ? 'OCCUPIED' : (i === 5 ? 'ORDER_PENDING' : 'AVAILABLE'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    this.nextId.tables = 11;

    // 3. Categories
    const cats = ['Starters', 'Main Course', 'Snacks', 'Beverages', 'Desserts'];
    this.menu_categories = cats.map((name, idx) => ({
      id: idx + 1,
      name,
      display_order: idx + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    this.nextId.menu_categories = 6;

    // 4. Menu Items
    const items = [
      { cat: 1, name: 'Artisan Garlic Bruschetta', desc: 'Toasted sourdough rubbed with garlic, topped with tomatoes and balsamic glaze.', price: 240, img: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 1, name: 'Crispy Peri Peri French Fries', desc: 'Golden fries in fiery African peri-peri spices with cheesy herb dip.', price: 190, img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 1 },
      { cat: 1, name: 'Paneer Tikka Crostini', desc: 'Char-grilled cottage cheese cubes seasoned with tandoori spices on crostini.', price: 290, img: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 1 },
      { cat: 1, name: 'Loaded Nachos Grande', desc: 'Tortilla chips baked with spiced beans, cheddar cheese sauce, salsa, and jalapenos.', price: 320, img: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 2, name: 'Creamy Alfredo Fettuccine', desc: 'Handcrafted pasta ribbons tossed in a rich garlic parmesan cream sauce with wild mushrooms.', price: 380, img: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 2, name: 'Classic Margherita Wood-Fired Pizza', desc: 'Thin crust with San Marzano tomato sauce, fresh buffalo mozzarella, and sweet basil.', price: 420, img: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 2, name: 'Farmhouse Gourmet Pizza', desc: 'Loaded with bell peppers, sweet corn, black olives, onions, mushrooms, and mozzarella.', price: 460, img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 2, name: 'Penne Arbiatta Piccante', desc: 'Penne pasta in a spicy tomato concasse sauce with crushed chili flakes and garlic.', price: 360, img: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281290?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 1 },
      { cat: 3, name: 'Gourmet Truffle Mushroom Burger', desc: 'Portobello mushroom patty with caramelized onions and truffle aioli on brioche.', price: 340, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 3, name: 'Spicy Paneer Tikka Panini', desc: 'Artisan ciabatta bread stuffed with tandoori paneer and mint chutney.', price: 280, img: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 1 },
      { cat: 4, name: 'Velvet Cappuccino', desc: 'Espresso topped with steamed milk and a velvety micro-foam dusted with cocoa powder.', price: 210, img: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 4, name: 'Hazelnut Iced Latte', desc: 'Chilled espresso combined with fresh milk and roasted hazelnut syrup over ice.', price: 240, img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 4, name: 'Belgian Hot Chocolate', desc: 'Melted dark chocolate whisked with hot milk and topped with fluffy marshmallows.', price: 250, img: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 5, name: 'Molten Belgian Chocolate Lava Cake', desc: 'Warm chocolate cake with flowing center served with Madagascar vanilla gelato.', price: 290, img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
      { cat: 5, name: 'Classic Italian Tiramisu', desc: 'Ladyfingers dipped in espresso and layered with mascarpone cream and cocoa powder.', price: 320, img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 }
    ];

    this.menu_items = items.map((it, idx) => ({
      id: idx + 1,
      category_id: it.cat,
      name: it.name,
      description: it.desc,
      price: it.price,
      image_url: it.img,
      available: 1,
      is_veg: it.veg,
      is_spicy: it.spicy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    this.nextId.menu_items = items.length + 1;

    // 5. Demo Users
    this.users = [
      { id: 1, phone: '+919876543210', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, phone: '+919123456789', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    this.nextId.users = 3;

    // 6. Sample Orders
    this.orders = [
      {
        id: 1,
        public_order_number: 'ORD-582914',
        user_id: 1,
        table_id: 1,
        subtotal: 620,
        tax: 31,
        total: 651,
        payment_method: 'UPI',
        payment_status: 'PAID',
        order_status: 'COMPLETED',
        notes: 'Extra spicy please',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        public_order_number: 'ORD-918234',
        user_id: 2,
        table_id: 2,
        subtotal: 530,
        tax: 26.5,
        total: 556.5,
        payment_method: 'CASH',
        payment_status: 'PENDING',
        order_status: 'PREPARING',
        notes: 'Serve coffee first',
        created_at: new Date(Date.now() - 1200000).toISOString(),
        updated_at: new Date(Date.now() - 1200000).toISOString()
      }
    ];
    this.nextId.orders = 3;

    this.order_items = [
      { id: 1, order_id: 1, menu_item_id: 1, item_name_snapshot: 'Artisan Garlic Bruschetta', unit_price_snapshot: 240, quantity: 1, total: 240, created_at: new Date().toISOString() },
      { id: 2, order_id: 1, menu_item_id: 5, item_name_snapshot: 'Creamy Alfredo Fettuccine', unit_price_snapshot: 380, quantity: 1, total: 380, created_at: new Date().toISOString() },
      { id: 3, order_id: 2, menu_item_id: 12, item_name_snapshot: 'Hazelnut Iced Latte', unit_price_snapshot: 240, quantity: 1, total: 240, created_at: new Date().toISOString() },
      { id: 4, order_id: 2, menu_item_id: 14, item_name_snapshot: 'Molten Belgian Chocolate Lava Cake', unit_price_snapshot: 290, quantity: 1, total: 290, created_at: new Date().toISOString() }
    ];
    this.nextId.order_items = 5;

    this.payments = [
      { id: 1, order_id: 1, method: 'UPI', amount: 651, status: 'PAID', transaction_reference: 'UPI-REF-9928374', verified_by: 1, verified_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, order_id: 2, method: 'CASH', amount: 556.5, status: 'PENDING', transaction_reference: null, verified_by: null, verified_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    this.nextId.payments = 3;

    this.initialized = true;
  }
}

export const memoryStore = new MemoryStore();
memoryStore.initSeed();

export const db = {
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return res.rows as unknown as T[];
    }
    await memoryStore.initSeed();
    return executeMemoryQuery<T[]>(sql, params, 'all');
  },

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return (!res.rows || res.rows.length === 0) ? null : (res.rows[0] as unknown as T);
    }
    await memoryStore.initSeed();
    return executeMemoryQuery<T | null>(sql, params, 'get');
  },

  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return {
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
        changes: res.rowsAffected
      };
    }
    await memoryStore.initSeed();
    return executeMemoryRun(sql, params);
  },

  async exec(sql: string): Promise<void> {
    if (remoteClient) {
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await remoteClient.execute(stmt);
      }
    }
  },

  async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<void> {
    if (remoteClient) {
      const stmts = statements.map(s => (typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.args || [] }));
      await remoteClient.batch(stmts, 'write');
    }
  },

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    if (remoteClient) {
      const tx = await remoteClient.transaction('write');
      try {
        const result = await fn(tx);
        await tx.commit();
        return result;
      } catch (err) {
        try { await tx.rollback(); } catch (_) {}
        throw err;
      }
    }

    await memoryStore.initSeed();
    const memoryTx = {
      execute: async ({ sql, args }: { sql: string; args?: any[] }) => {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const rows = executeMemoryQuery<any[]>(sql, args || [], 'all');
          return { rows, rowsAffected: 0, lastInsertRowid: 0 };
        } else {
          const runRes = executeMemoryRun(sql, args || []);
          return { rows: [], rowsAffected: runRes.changes, lastInsertRowid: runRes.lastInsertRowid };
        }
      }
    };
    return await fn(memoryTx);
  }
};

function normalizePhoneStr(p: string | number | undefined | null): string {
  if (!p) return '';
  const s = String(p).replace(/\D/g, '');
  if (s.length === 10) return `+91${s}`;
  if (s.length === 12 && s.startsWith('91')) return `+${s}`;
  return `+${s}`;
}

// -------------------------------------------------------------
// In-Memory Query Engine
// -------------------------------------------------------------
function executeMemoryQuery<T>(sql: string, params: any[], mode: 'all' | 'get'): T {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();

  // 1. Admin Users query
  if (cleanSql.includes('FROM admin_users') || cleanSql.includes('FROM admin_users u')) {
    if (cleanSql.includes('WHERE email = ?')) {
      const email = params[0];
      const match = memoryStore.admin_users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('WHERE id = ?') || cleanSql.includes('WHERE u.id = ?')) {
      const id = Number(params[0]);
      const match = memoryStore.admin_users.find(u => u.id === id);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('COUNT(*)')) {
      return (mode === 'get' ? { count: memoryStore.admin_users.length } : [{ count: memoryStore.admin_users.length }]) as unknown as T;
    }
    return (mode === 'all' ? memoryStore.admin_users : memoryStore.admin_users[0] || null) as unknown as T;
  }

  // 2. Tables query
  if (cleanSql.includes('FROM tables') || cleanSql.includes('FROM tables t')) {
    if (cleanSql.includes('WHERE secure_token_hash = ?')) {
      const hash = params[0];
      const match = memoryStore.tables.find(t => t.secure_token_hash === hash);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('WHERE id = ?') || cleanSql.includes('WHERE t.id = ?')) {
      const id = Number(params[0]);
      const match = memoryStore.tables.find(t => t.id === id);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('COUNT(*)')) {
      const count = memoryStore.tables.filter(t => !['AVAILABLE', 'INACTIVE'].includes(t.status)).length;
      return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
    }
    // Admin table list
    const result = memoryStore.tables.map(t => ({
      id: t.id,
      internal_table_code: t.internal_table_code,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
      session_count: memoryStore.table_sessions.filter(s => s.table_id === t.id).length
    }));
    return (mode === 'all' ? result : result[0] || null) as unknown as T;
  }

  // 3. Table Sessions query
  if (cleanSql.includes('FROM table_sessions') || cleanSql.includes('FROM table_sessions ts')) {
    if (cleanSql.includes('WHERE ts.session_token_hash = ?') || cleanSql.includes('WHERE session_token_hash = ?')) {
      const hash = params[0];
      const session = memoryStore.table_sessions.find(s => s.session_token_hash === hash);
      if (!session) return (mode === 'get' ? null : []) as unknown as T;
      const table = memoryStore.tables.find(t => t.id === session.table_id);
      const res = {
        session_id: session.session_id,
        table_id: session.table_id,
        expires_at: session.expires_at,
        table_status: table?.status || 'AVAILABLE'
      };
      return (mode === 'get' ? res : [res]) as unknown as T;
    }
  }

  // 4. Menu Categories query
  if (cleanSql.includes('FROM menu_categories')) {
    const list = [...memoryStore.menu_categories].sort((a, b) => a.display_order - b.display_order);
    if (cleanSql.includes('WHERE id = ?')) {
      const match = list.find(c => c.id === Number(params[0]));
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    return (mode === 'all' ? list : list[0] || null) as unknown as T;
  }

  // 5. Menu Items query
  if (cleanSql.includes('FROM menu_items') || cleanSql.includes('FROM menu_items m')) {
    if (cleanSql.includes('COUNT(*) as count FROM menu_items WHERE category_id = ?')) {
      const catId = Number(params[0]);
      const count = memoryStore.menu_items.filter(m => m.category_id === catId).length;
      return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
    }
    if (cleanSql.includes('WHERE m.id = ?') || cleanSql.includes('WHERE id = ?')) {
      const id = Number(params[0]);
      const item = memoryStore.menu_items.find(m => m.id === id);
      if (!item) return (mode === 'get' ? null : []) as unknown as T;
      const cat = memoryStore.menu_categories.find(c => c.id === item.category_id);
      const res = { ...item, category_name: cat?.name || '' };
      return (mode === 'get' ? res : [res]) as unknown as T;
    }

    let items = memoryStore.menu_items.map(m => {
      const cat = memoryStore.menu_categories.find(c => c.id === m.category_id);
      return { ...m, category_name: cat?.name || '', display_order: cat?.display_order || 0 };
    });

    if (cleanSql.includes('m.available = 1') || cleanSql.includes('available = 1')) {
      items = items.filter(m => m.available === 1);
    }
    if (cleanSql.includes('m.category_id = ?') || cleanSql.includes('category_id = ?')) {
      const catId = Number(params[params.length - 1]);
      items = items.filter(m => m.category_id === catId);
    }
    if (cleanSql.includes('m.name LIKE ?') || cleanSql.includes('name LIKE ?')) {
      const term = String(params[0]).replace(/%/g, '').toLowerCase();
      items = items.filter(m => m.name.toLowerCase().includes(term) || m.description.toLowerCase().includes(term));
    }

    items.sort((a, b) => a.display_order - b.display_order);
    return (mode === 'all' ? items : items[0] || null) as unknown as T;
  }

  // 6. Users query
  if (cleanSql.includes('FROM users') || cleanSql.includes('FROM users u')) {
    if (cleanSql.includes('WHERE phone = ?') || cleanSql.includes('WHERE u.phone = ?')) {
      const phoneNorm = normalizePhoneStr(params[0]);
      const match = memoryStore.users.find(u => normalizePhoneStr(u.phone) === phoneNorm);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('WHERE id = ?') || cleanSql.includes('WHERE u.id = ?')) {
      const id = Number(params[0]);
      const match = memoryStore.users.find(u => u.id === id);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    const userStats = memoryStore.users.map(u => {
      const userOrders = memoryStore.orders.filter(o => o.user_id === u.id);
      const paidOrders = userOrders.filter(o => o.payment_status === 'PAID');
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);
      return {
        id: u.id,
        phone: u.phone,
        created_at: u.created_at,
        total_orders: userOrders.length,
        total_spent: totalSpent,
        last_order_at: userOrders[userOrders.length - 1]?.created_at || null
      };
    });
    return (mode === 'all' ? userStats : userStats[0] || null) as unknown as T;
  }

  // 7. OTP Records query
  if (cleanSql.includes('FROM otp_records')) {
    if (cleanSql.includes('WHERE phone = ?')) {
      const phoneNorm = normalizePhoneStr(params[0]);
      const match = memoryStore.otp_records.find(o => normalizePhoneStr(o.phone) === phoneNorm);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
  }

  // 8. Orders query
  if (cleanSql.includes('FROM orders') || cleanSql.includes('FROM orders o')) {
    if (cleanSql.includes('WHERE public_order_number = ? AND user_id = ?')) {
      const [num, uid] = params;
      const match = memoryStore.orders.find(o => o.public_order_number === num && o.user_id === Number(uid));
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('WHERE public_order_number = ?') || cleanSql.includes('WHERE o.public_order_number = ?')) {
      const num = params[0];
      const match = memoryStore.orders.find(o => o.public_order_number === num);
      if (match) {
        const user = memoryStore.users.find(u => u.id === match.user_id);
        const table = memoryStore.tables.find(t => t.id === match.table_id);
        const res = {
          ...match,
          user_phone: user?.phone || '',
          internal_table_code: table?.internal_table_code || ''
        };
        return (mode === 'get' ? res : [res]) as unknown as T;
      }
      return (mode === 'get' ? null : []) as unknown as T;
    }
    if (cleanSql.includes('WHERE id = ?') || cleanSql.includes('WHERE o.id = ?')) {
      const id = Number(params[0]);
      const match = memoryStore.orders.find(o => o.id === id);
      return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
    }
    if (cleanSql.includes('WHERE user_id = ?')) {
      const uid = Number(params[0]);
      const list = memoryStore.orders.filter(o => o.user_id === uid).reverse();
      return (mode === 'all' ? list : list[0] || null) as unknown as T;
    }
    if (cleanSql.includes('COUNT(*)')) {
      if (cleanSql.includes("order_status = 'PENDING'")) {
        const count = memoryStore.orders.filter(o => o.order_status === 'PENDING').length;
        return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
      }
      if (cleanSql.includes("order_status IN ('ACCEPTED', 'PREPARING')")) {
        const count = memoryStore.orders.filter(o => ['ACCEPTED', 'PREPARING'].includes(o.order_status)).length;
        return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
      }
      if (cleanSql.includes("order_status = 'COMPLETED'")) {
        const count = memoryStore.orders.filter(o => o.order_status === 'COMPLETED').length;
        return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
      }
      const count = memoryStore.orders.length;
      return (mode === 'get' ? { count } : [{ count }]) as unknown as T;
    }
    if (cleanSql.includes('SUM(total)') || cleanSql.includes('SUM(o.total)')) {
      if (cleanSql.includes("payment_status = 'PAID'")) {
        const total = memoryStore.orders.filter(o => o.payment_status === 'PAID').reduce((sum, o) => sum + o.total, 0);
        return (mode === 'get' ? { total } : [{ total }]) as unknown as T;
      }
      if (cleanSql.includes("payment_status = 'PENDING'")) {
        const total = memoryStore.orders.filter(o => o.payment_status === 'PENDING' && o.order_status !== 'CANCELLED').reduce((sum, o) => sum + o.total, 0);
        return (mode === 'get' ? { total } : [{ total }]) as unknown as T;
      }
    }

    // Reports totals
    if (cleanSql.includes('total_revenue') || cleanSql.includes('total_orders')) {
      const total_orders = memoryStore.orders.length;
      const total_revenue = memoryStore.orders.filter(o => o.payment_status === 'PAID').reduce((sum, o) => sum + o.total, 0);
      const upi_revenue = memoryStore.orders.filter(o => o.payment_status === 'PAID' && o.payment_method === 'UPI').reduce((sum, o) => sum + o.total, 0);
      const cash_revenue = memoryStore.orders.filter(o => o.payment_status === 'PAID' && o.payment_method === 'CASH').reduce((sum, o) => sum + o.total, 0);
      const pending_payments_count = memoryStore.orders.filter(o => o.payment_status === 'PENDING' && o.order_status !== 'CANCELLED').length;
      const summary = { total_orders, total_revenue, upi_revenue, cash_revenue, pending_payments_count };
      return (mode === 'get' ? summary : [summary]) as unknown as T;
    }

    // Admin list
    const adminOrders = memoryStore.orders.map(o => {
      const user = memoryStore.users.find(u => u.id === o.user_id);
      const table = memoryStore.tables.find(t => t.id === o.table_id);
      return {
        ...o,
        user_phone: user?.phone || '',
        internal_table_code: table?.internal_table_code || ''
      };
    }).reverse();
    return (mode === 'all' ? adminOrders : adminOrders[0] || null) as unknown as T;
  }

  // 9. Order Items query
  if (cleanSql.includes('FROM order_items') || cleanSql.includes('FROM order_items oi')) {
    if (cleanSql.includes('WHERE order_id = ?')) {
      const orderId = Number(params[0]);
      const list = memoryStore.order_items.filter(oi => oi.order_id === orderId);
      return (mode === 'all' ? list : list[0] || null) as unknown as T;
    }
    if (cleanSql.includes('top_dishes') || cleanSql.includes('SUM(oi.quantity)')) {
      const counts: Record<string, { quantity_sold: number; total_revenue: number }> = {};
      memoryStore.order_items.forEach(oi => {
        if (!counts[oi.item_name_snapshot]) counts[oi.item_name_snapshot] = { quantity_sold: 0, total_revenue: 0 };
        counts[oi.item_name_snapshot].quantity_sold += oi.quantity;
        counts[oi.item_name_snapshot].total_revenue += oi.total;
      });
      const topDishes = Object.entries(counts).map(([name, stat]) => ({ name, ...stat }));
      return (mode === 'all' ? topDishes : topDishes[0] || null) as unknown as T;
    }
  }

  // 10. Payments query
  if (cleanSql.includes('FROM payments') || cleanSql.includes('FROM payments p')) {
    const list = memoryStore.payments.map(p => {
      const order = memoryStore.orders.find(o => o.id === p.order_id);
      const verifier = memoryStore.admin_users.find(u => u.id === p.verified_by);
      return {
        ...p,
        public_order_number: order?.public_order_number || '',
        verifier_email: verifier?.email || null
      };
    }).reverse();
    return (mode === 'all' ? list : list[0] || null) as unknown as T;
  }

  // 11. Idempotency keys query
  if (cleanSql.includes('FROM idempotency_keys')) {
    const key = params[0];
    const match = memoryStore.idempotency_keys.find(k => k.idempotency_key === key);
    return (mode === 'get' ? match || null : (match ? [match] : [])) as unknown as T;
  }

  return (mode === 'get' ? null : []) as unknown as T;
}

function executeMemoryRun(sql: string, params: any[]): { lastInsertRowid: number; changes: number } {
  const cleanSql = sql.replace(/\s+/g, ' ').trim().toUpperCase();

  // Reset / Clear
  if (cleanSql.startsWith('DELETE FROM')) {
    if (cleanSql.includes('ORDER_ITEMS')) { memoryStore.order_items = []; memoryStore.nextId.order_items = 1; }
    if (cleanSql.includes('PAYMENTS')) { memoryStore.payments = []; memoryStore.nextId.payments = 1; }
    if (cleanSql.includes('ORDERS')) { memoryStore.orders = []; memoryStore.nextId.orders = 1; }
    if (cleanSql.includes('TABLE_SESSIONS')) {
      if (cleanSql.includes('WHERE TABLE_ID = ?')) {
        const tableId = Number(params[0]);
        memoryStore.table_sessions = memoryStore.table_sessions.filter(s => s.table_id !== tableId);
      } else if (cleanSql.includes('WHERE SESSION_TOKEN_HASH = ?')) {
        const hash = params[0];
        memoryStore.table_sessions = memoryStore.table_sessions.filter(s => s.session_token_hash !== hash);
      } else {
        memoryStore.table_sessions = [];
        memoryStore.nextId.table_sessions = 1;
      }
    }
    if (cleanSql.includes('OTP_RECORDS')) {
      if (cleanSql.includes('WHERE PHONE = ?')) {
        const phoneNorm = normalizePhoneStr(params[0]);
        memoryStore.otp_records = memoryStore.otp_records.filter(o => normalizePhoneStr(o.phone) !== phoneNorm);
      } else if (cleanSql.includes('WHERE ID = ?')) {
        const id = Number(params[0]);
        memoryStore.otp_records = memoryStore.otp_records.filter(o => o.id !== id);
      } else {
        memoryStore.otp_records = [];
        memoryStore.nextId.otp_records = 1;
      }
    }
    if (cleanSql.includes('MENU_ITEMS')) {
      if (cleanSql.includes('WHERE ID = ?')) {
        const id = Number(params[0]);
        memoryStore.menu_items = memoryStore.menu_items.filter(m => m.id !== id);
      } else {
        memoryStore.menu_items = [];
        memoryStore.nextId.menu_items = 1;
      }
    }
    if (cleanSql.includes('MENU_CATEGORIES')) { memoryStore.menu_categories = []; memoryStore.nextId.menu_categories = 1; }
    if (cleanSql.includes('TABLES')) { memoryStore.tables = []; memoryStore.nextId.tables = 1; }
    if (cleanSql.includes('ADMIN_USERS')) { memoryStore.admin_users = []; memoryStore.nextId.admin_users = 1; }
    if (cleanSql.includes('USERS')) { memoryStore.users = []; memoryStore.nextId.users = 1; }
    if (cleanSql.includes('IDEMPOTENCY_KEYS')) { memoryStore.idempotency_keys = []; memoryStore.nextId.idempotency_keys = 1; }
    return { lastInsertRowid: 0, changes: 1 };
  }

  // 1. INSERT INTO users
  if (cleanSql.startsWith('INSERT INTO USERS')) {
    const phone = String(params[0]);
    const phoneNorm = normalizePhoneStr(phone);
    const existing = memoryStore.users.find(u => normalizePhoneStr(u.phone) === phoneNorm);
    if (existing) return { lastInsertRowid: existing.id, changes: 0 };
    const id = memoryStore.nextId.users++;
    memoryStore.users.push({ id, phone: phoneNorm, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 2. INSERT INTO admin_users
  if (cleanSql.startsWith('INSERT INTO ADMIN_USERS')) {
    const [email, password_hash, role] = params;
    const id = memoryStore.nextId.admin_users++;
    memoryStore.admin_users.push({ id, email, password_hash, role, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 3. INSERT INTO tables
  if (cleanSql.startsWith('INSERT INTO TABLES')) {
    const [internal_table_code, secure_token_hash, status] = params;
    const id = memoryStore.nextId.tables++;
    memoryStore.tables.push({ id, internal_table_code, secure_token_hash, status: status || 'AVAILABLE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 4. INSERT INTO menu_categories
  if (cleanSql.startsWith('INSERT INTO MENU_CATEGORIES')) {
    const [name, display_order] = params;
    const id = memoryStore.nextId.menu_categories++;
    memoryStore.menu_categories.push({ id, name, display_order: Number(display_order) || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 5. INSERT INTO menu_items
  if (cleanSql.startsWith('INSERT INTO MENU_ITEMS')) {
    const [category_id, name, description, price, image_url, available, is_veg, is_spicy] = params;
    const id = memoryStore.nextId.menu_items++;
    memoryStore.menu_items.push({
      id,
      category_id: Number(category_id),
      name,
      description,
      price: Number(price),
      image_url,
      available: available !== undefined ? Number(available) : 1,
      is_veg: is_veg !== undefined ? Number(is_veg) : 1,
      is_spicy: is_spicy !== undefined ? Number(is_spicy) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 6. INSERT INTO table_sessions
  if (cleanSql.startsWith('INSERT INTO TABLE_SESSIONS')) {
    const [session_id, session_token_hash, table_id, expires_param] = params;
    const expires_at = typeof expires_param === 'string' && expires_param.includes('T')
      ? expires_param
      : new Date(Date.now() + 12 * 3600000).toISOString();
    const id = memoryStore.nextId.table_sessions++;
    memoryStore.table_sessions.push({
      id,
      session_id,
      session_token_hash,
      table_id: Number(table_id),
      expires_at,
      created_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 7. INSERT INTO otp_records
  if (cleanSql.includes('INSERT INTO OTP_RECORDS') || cleanSql.includes('INSERT OR REPLACE INTO OTP_RECORDS')) {
    const phone = String(params[0]);
    const phoneNorm = normalizePhoneStr(phone);
    const otp_hash = String(params[1] || 'dummyhash');
    const isExpired = cleanSql.includes("'-10 MINUTES'") || cleanSql.includes("-10 MINUTES");
    const expires_at = isExpired ? new Date(Date.now() - 600000).toISOString() : (typeof params[3] === 'string' && params[3].includes('T') ? params[3] : new Date(Date.now() + 300000).toISOString());
    const last_sent_at = isExpired ? new Date(Date.now() - 600000).toISOString() : (typeof params[4] === 'string' && params[4].includes('T') ? params[4] : new Date().toISOString());

    const existingIdx = memoryStore.otp_records.findIndex(o => normalizePhoneStr(o.phone) === phoneNorm);
    if (existingIdx >= 0) {
      memoryStore.otp_records[existingIdx] = {
        ...memoryStore.otp_records[existingIdx],
        otp_hash,
        attempts: 0,
        max_attempts: 5,
        expires_at,
        last_sent_at
      };
      return { lastInsertRowid: memoryStore.otp_records[existingIdx].id, changes: 1 };
    }

    const id = memoryStore.nextId.otp_records++;
    memoryStore.otp_records.push({
      id,
      phone: phoneNorm,
      otp_hash,
      attempts: 0,
      max_attempts: 5,
      expires_at,
      last_sent_at,
      created_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 8. INSERT INTO orders
  if (cleanSql.startsWith('INSERT INTO ORDERS')) {
    const [public_order_number, user_id, table_id, subtotal, tax, total, payment_method, notes] = params;
    const id = memoryStore.nextId.orders++;
    const orderRecord: Order = {
      id,
      public_order_number,
      user_id: Number(user_id),
      table_id: Number(table_id),
      subtotal: Number(subtotal),
      tax: Number(tax),
      total: Number(total),
      payment_method,
      payment_status: 'PENDING',
      order_status: 'PENDING',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.orders.push(orderRecord);
    return { lastInsertRowid: id, changes: 1 };
  }

  // 9. INSERT INTO order_items
  if (cleanSql.startsWith('INSERT INTO ORDER_ITEMS')) {
    const [order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total] = params;
    const id = memoryStore.nextId.order_items++;
    memoryStore.order_items.push({
      id,
      order_id: Number(order_id),
      menu_item_id: menu_item_id ? Number(menu_item_id) : null,
      item_name_snapshot,
      unit_price_snapshot: Number(unit_price_snapshot),
      quantity: Number(quantity),
      total: Number(total),
      created_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 10. INSERT INTO payments
  if (cleanSql.startsWith('INSERT INTO PAYMENTS')) {
    const [order_id, method, amount] = params;
    const id = memoryStore.nextId.payments++;
    memoryStore.payments.push({
      id,
      order_id: Number(order_id),
      method,
      amount: Number(amount),
      status: 'PENDING',
      transaction_reference: null,
      verified_by: null,
      verified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 11. INSERT INTO idempotency_keys
  if (cleanSql.startsWith('INSERT INTO IDEMPOTENCY_KEYS')) {
    const id = memoryStore.nextId.idempotency_keys++;
    const key = String(params[0]);
    const body = params.length === 2 ? String(params[1]) : String(params[2]);
    const status = params.length === 3 ? Number(params[1]) : 201;
    memoryStore.idempotency_keys.push({
      id,
      idempotency_key: key,
      response_status: status,
      response_body: body,
      created_at: new Date().toISOString()
    });
    return { lastInsertRowid: id, changes: 1 };
  }

  // 12. UPDATE orders
  if (cleanSql.startsWith('UPDATE ORDERS')) {
    if (cleanSql.includes('SET ORDER_STATUS = ?')) {
      const [nextStatus, orderId] = params;
      const order = memoryStore.orders.find(o => o.id === Number(orderId));
      if (order) {
        order.order_status = nextStatus;
        order.updated_at = new Date().toISOString();
        return { lastInsertRowid: order.id, changes: 1 };
      }
    }
    if (cleanSql.includes("SET PAYMENT_STATUS = 'PAID'")) {
      const orderId = Number(params[0]);
      const order = memoryStore.orders.find(o => o.id === orderId);
      if (order) {
        order.payment_status = 'PAID';
        order.updated_at = new Date().toISOString();
        return { lastInsertRowid: order.id, changes: 1 };
      }
    }
  }

  // 13. UPDATE payments
  if (cleanSql.startsWith('UPDATE PAYMENTS')) {
    const orderId = Number(params[params.length - 1]);
    const payment = memoryStore.payments.find(p => p.order_id === orderId);
    if (payment) {
      if (cleanSql.includes("STATUS = 'PAID'")) {
        payment.status = 'PAID';
        payment.verified_at = new Date().toISOString();
        payment.verified_by = Number(params[0]) || 1;
      }
      if (cleanSql.includes('TRANSACTION_REFERENCE =')) {
        payment.transaction_reference = params[0] || payment.transaction_reference;
      }
      return { lastInsertRowid: payment.id, changes: 1 };
    }
  }

  // 14. UPDATE tables
  if (cleanSql.startsWith('UPDATE TABLES')) {
    const tableId = Number(params[params.length - 1]);
    const table = memoryStore.tables.find(t => t.id === tableId);
    if (table) {
      if (cleanSql.includes('STATUS = ?')) table.status = params[0];
      if (cleanSql.includes('SECURE_TOKEN_HASH = ?')) table.secure_token_hash = params[0];
      return { lastInsertRowid: table.id, changes: 1 };
    }
  }

  // 15. UPDATE menu_items
  if (cleanSql.startsWith('UPDATE MENU_ITEMS')) {
    if (cleanSql.includes('PRICE = 500')) {
      const item = memoryStore.menu_items.find(m => m.id === 1);
      if (item) item.price = 500;
      return { lastInsertRowid: 1, changes: 1 };
    }
    if (cleanSql.includes('AVAILABLE = 0')) {
      const item = memoryStore.menu_items.find(m => m.id === 3);
      if (item) item.available = 0;
      return { lastInsertRowid: 3, changes: 1 };
    }
    const itemId = Number(params[params.length - 1]);
    const item = memoryStore.menu_items.find(m => m.id === itemId);
    if (item) {
      if (params[3] !== null && params[3] !== undefined) item.price = Number(params[3]);
      if (params[5] !== null && params[5] !== undefined) item.available = Number(params[5]);
      return { lastInsertRowid: item.id, changes: 1 };
    }
  }

  // 16. UPDATE otp_records
  if (cleanSql.includes('UPDATE OTP_RECORDS')) {
    let match: OtpRecord | undefined;
    if (cleanSql.includes('WHERE ID = ?')) {
      const id = Number(params[params.length - 1]);
      match = memoryStore.otp_records.find(o => o.id === id);
    } else {
      const phoneNorm = normalizePhoneStr(params[params.length - 1]);
      match = memoryStore.otp_records.find(o => normalizePhoneStr(o.phone) === phoneNorm);
    }
    if (match) {
      if (cleanSql.includes('ATTEMPTS = ?')) {
        match.attempts = Number(params[0]);
      } else {
        match.attempts += 1;
      }
      return { lastInsertRowid: match.id, changes: 1 };
    }
  }

  return { lastInsertRowid: 0, changes: 1 };
}

export async function initDatabase(): Promise<void> {
  await memoryStore.initSeed();
}

export default db;
