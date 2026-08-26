import { createClient as createWebClient, Client } from '@libsql/client/web';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
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

let sqlJsDbInstance: SqlJsDatabase | null = null;
let sqlJsPromise: Promise<SqlJsDatabase> | null = null;

async function getSqlJsDb(): Promise<SqlJsDatabase> {
  if (sqlJsDbInstance) return sqlJsDbInstance;
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const SQL = await initSqlJs();
      const sqliteDb = new SQL.Database();
      sqlJsDbInstance = sqliteDb;
      await initSchemaAndSeed(sqliteDb);
      return sqliteDb;
    })();
  }
  return await sqlJsPromise;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_table_code TEXT NOT NULL UNIQUE,
  secure_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  session_token_hash TEXT NOT NULL UNIQUE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  image_url TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  is_veg INTEGER NOT NULL DEFAULT 1,
  is_spicy INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  table_id INTEGER NOT NULL REFERENCES tables(id),
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  order_status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  unit_price_snapshot REAL NOT NULL,
  quantity INTEGER NOT NULL,
  total REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  transaction_reference TEXT,
  verified_by INTEGER REFERENCES admin_users(id),
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

async function initSchemaAndSeed(sqliteDb: SqlJsDatabase) {
  sqliteDb.run(SCHEMA_SQL);

  // Check if admin exists
  const check = sqliteDb.exec('SELECT COUNT(*) as count FROM admin_users');
  const count = (check[0]?.values[0]?.[0] as number) || 0;
  if (count > 0) return;

  const adminPasswordHash = await hashPassword('Admin@12345');
  const staffPasswordHash = await hashPassword('Staff@12345');

  sqliteDb.run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)', ['admin@cafe.local', adminPasswordHash, 'ADMIN']);
  sqliteDb.run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)', ['staff@cafe.local', staffPasswordHash, 'STAFF']);

  // Seed 10 tables
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

  for (let i = 1; i <= 10; i++) {
    const tableCode = `T-${i < 10 ? '0' + i : i}`;
    const rawToken = defaultTokens[i - 1] || generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    sqliteDb.run('INSERT INTO tables (internal_table_code, secure_token_hash, status) VALUES (?, ?, ?)', [tableCode, tokenHash, 'AVAILABLE']);
  }

  // Seed categories
  sqliteDb.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Starters', 1]);
  sqliteDb.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Main Course', 2]);
  sqliteDb.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Snacks', 3]);
  sqliteDb.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Beverages', 4]);
  sqliteDb.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Desserts', 5]);

  const sampleItems = [
    { cat: 1, name: 'Artisan Garlic Bruschetta', desc: 'Toasted sourdough rubbed with garlic, tomatoes, basil, and balsamic glaze.', price: 240, img: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
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

  for (const it of sampleItems) {
    sqliteDb.run('INSERT INTO menu_items (category_id, name, description, price, image_url, available, is_veg, is_spicy) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [
      it.cat, it.name, it.desc, it.price, it.img, it.veg, it.spicy
    ]);
  }

  // Seed sample users and orders
  sqliteDb.run('INSERT INTO users (phone) VALUES (?)', ['+919876543210']);
  sqliteDb.run('INSERT INTO users (phone) VALUES (?)', ['+919123456789']);

  sqliteDb.run(
    "INSERT INTO orders (public_order_number, user_id, table_id, subtotal, tax, total, payment_method, payment_status, order_status, notes, created_at) VALUES (?, 1, 1, 620, 31, 651, 'UPI', 'PAID', 'COMPLETED', 'Extra napkins', datetime('now', '-2 hours'))",
    ['ORD-582914']
  );
  sqliteDb.run('INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (1, 1, \'Artisan Garlic Bruschetta\', 240, 1, 240)');
  sqliteDb.run('INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (1, 5, \'Creamy Alfredo Fettuccine\', 380, 1, 380)');
  sqliteDb.run("INSERT INTO payments (order_id, method, amount, status, transaction_reference, verified_by, verified_at, created_at) VALUES (1, 'UPI', 651, 'PAID', 'UPI-REF-9928374', 1, datetime('now'), datetime('now', '-2 hours'))");

  sqliteDb.run(
    "INSERT INTO orders (public_order_number, user_id, table_id, subtotal, tax, total, payment_method, payment_status, order_status, notes, created_at) VALUES (?, 2, 2, 530, 26.5, 556.5, 'CASH', 'PENDING', 'PREPARING', 'Serve coffee first', datetime('now', '-20 minutes'))",
    ['ORD-918234']
  );
  sqliteDb.run('INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (2, 12, \'Hazelnut Iced Latte\', 240, 1, 240)');
  sqliteDb.run('INSERT INTO order_items (order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total) VALUES (2, 14, \'Molten Belgian Chocolate Lava Cake\', 290, 1, 290)');
  sqliteDb.run("INSERT INTO payments (order_id, method, amount, status, created_at) VALUES (2, 'CASH', 556.5, 'PENDING', datetime('now', '-20 minutes'))");
}

export const db = {
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return res.rows as unknown as T[];
    }
    const sqliteDb = await getSqlJsDb();
    const stmt = sqliteDb.prepare(sql);
    try {
      if (params.length > 0) stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as unknown as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  },

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return (!res.rows || res.rows.length === 0) ? null : (res.rows[0] as unknown as T);
    }
    const sqliteDb = await getSqlJsDb();
    const stmt = sqliteDb.prepare(sql);
    try {
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject() as unknown as T;
      }
      return null;
    } finally {
      stmt.free();
    }
  },

  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
    if (remoteClient) {
      const res = await remoteClient.execute({ sql, args: params });
      return {
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
        changes: res.rowsAffected
      };
    }
    const sqliteDb = await getSqlJsDb();
    sqliteDb.run(sql, params);
    const lastRowIdRes = sqliteDb.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = (lastRowIdRes[0]?.values[0]?.[0] as number) || 0;
    const changes = sqliteDb.getRowsModified();
    return { lastInsertRowid, changes };
  },

  async exec(sql: string): Promise<void> {
    if (remoteClient) {
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await remoteClient.execute(stmt);
      }
      return;
    }
    const sqliteDb = await getSqlJsDb();
    sqliteDb.run(sql);
  },

  async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<void> {
    if (remoteClient) {
      const stmts = statements.map(s => (typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.args || [] }));
      await remoteClient.batch(stmts, 'write');
      return;
    }
    const sqliteDb = await getSqlJsDb();
    for (const s of statements) {
      if (typeof s === 'string') {
        sqliteDb.run(s);
      } else {
        sqliteDb.run(s.sql, s.args || []);
      }
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

    const sqliteDb = await getSqlJsDb();
    sqliteDb.run('BEGIN TRANSACTION');
    try {
      const tx = {
        execute: async ({ sql, args }: { sql: string; args?: any[] }) => {
          if (sql.trim().toUpperCase().startsWith('SELECT')) {
            const stmt = sqliteDb.prepare(sql);
            try {
              if (args && args.length > 0) stmt.bind(args);
              const rows: any[] = [];
              while (stmt.step()) {
                rows.push(stmt.getAsObject());
              }
              return { rows, rowsAffected: 0, lastInsertRowid: 0 };
            } finally {
              stmt.free();
            }
          } else {
            sqliteDb.run(sql, args || []);
            const lastRowIdRes = sqliteDb.exec('SELECT last_insert_rowid() as id');
            const lastInsertRowid = (lastRowIdRes[0]?.values[0]?.[0] as number) || 0;
            return { rows: [], rowsAffected: sqliteDb.getRowsModified(), lastInsertRowid };
          }
        }
      };

      const result = await fn(tx);
      sqliteDb.run('COMMIT');
      return result;
    } catch (err) {
      try { sqliteDb.run('ROLLBACK'); } catch (_) {}
      throw err;
    }
  }
};

export async function initDatabase(): Promise<void> {
  if (remoteClient) {
    // Run schema on Turso
    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try { await remoteClient.execute(stmt); } catch (_) {}
    }
    return;
  }
  await getSqlJsDb();
}

export default db;
