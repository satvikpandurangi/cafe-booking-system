import { createClient as createWebClient, Client, Transaction } from '@libsql/client/web';
import { createClient as createNodeClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { hashPassword, hashToken, generateOpaqueToken } from '../utils/crypto';

dotenv.config();

let clientInstance: Client | null = null;

export function getClient(): Client {
  if (clientInstance) {
    return clientInstance;
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    // Pure HTTPS web client — zero native binaries, works 100% on Vercel / AWS Lambda
    clientInstance = createWebClient({
      url: tursoUrl,
      authToken: tursoToken
    });
    return clientInstance;
  }

  // Local development fallback
  if (!process.env.VERCEL) {
    const localDbPath = process.env.DATABASE_PATH || './data/cafe.db';
    const absoluteDbPath = path.resolve(process.cwd(), localDbPath);
    const dbDir = path.dirname(absoluteDbPath);
    
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      clientInstance = createNodeClient({
        url: `file:${absoluteDbPath.replace(/\\/g, '/')}`
      });
      return clientInstance;
    } catch (e) {
      // Fallback
    }
  }

  throw new Error('TURSO_DATABASE_URL is not configured in Vercel Environment Variables. Please set up your Turso database and add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your Vercel Project Settings.');
}

/**
 * Serverless & LibSQL/Turso Database Abstraction
 */
export const db = {
  /**
   * Execute single query and return all matching rows as typed objects
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const cl = getClient();
    const res = await cl.execute({ sql, args: params });
    return res.rows as unknown as T[];
  },

  /**
   * Execute single query and return the first matching row or null
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const cl = getClient();
    const res = await cl.execute({ sql, args: params });
    if (!res.rows || res.rows.length === 0) {
      return null;
    }
    return res.rows[0] as unknown as T;
  },

  /**
   * Execute INSERT/UPDATE/DELETE query and return lastInsertRowid and affected rows count
   */
  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
    const cl = getClient();
    const res = await cl.execute({ sql, args: params });
    return {
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      changes: res.rowsAffected
    };
  },

  /**
   * Execute raw SQL string (can contain multiple statements)
   */
  async exec(sql: string): Promise<void> {
    const cl = getClient();
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await cl.execute(stmt);
    }
  },

  /**
   * Execute multiple statements in an atomic batch
   */
  async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<void> {
    const cl = getClient();
    const stmts = statements.map(s => (typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.args || [] }));
    await cl.batch(stmts, 'write');
  },

  /**
   * Interactive atomic transaction with rollback support
   */
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const cl = getClient();
    const tx = await cl.transaction('write');
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch (rollbackErr) {
        // Rollback error ignored
      }
      throw err;
    }
  }
};

/**
 * Embedded Schema DDL for reliable serverless execution across all environments
 */
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

let isInitialized = false;

/**
 * Initializes database tables, indexes, and auto-seeds initial data if empty.
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  const cl = getClient();
  const statements = SCHEMA_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await cl.execute(statement);
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.warn(`[Schema Note]: ${err.message}`);
      }
    }
  }

  // Auto-seed if database is brand new
  try {
    const adminCheck = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM admin_users');
    if (!adminCheck || adminCheck.count === 0) {
      const adminPasswordHash = await hashPassword('Admin@12345');
      const staffPasswordHash = await hashPassword('Staff@12345');

      await db.run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)', ['admin@cafe.local', adminPasswordHash, 'ADMIN']);
      await db.run('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)', ['staff@cafe.local', staffPasswordHash, 'STAFF']);

      // Seed 10 tables with known tokens for easy testing
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
        await db.run('INSERT INTO tables (internal_table_code, secure_token_hash, status) VALUES (?, ?, ?)', [tableCode, tokenHash, 'AVAILABLE']);
      }

      // Seed categories
      const c1 = await db.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Starters', 1]);
      const c2 = await db.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Main Course', 2]);
      const c3 = await db.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Snacks', 3]);
      const c4 = await db.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Beverages', 4]);
      const c5 = await db.run('INSERT INTO menu_categories (name, display_order) VALUES (?, ?)', ['Desserts', 5]);

      // Seed menu items
      const sampleItems = [
        { cat: c1.lastInsertRowid, name: 'Artisan Garlic Bruschetta', desc: 'Toasted sourdough rubbed with garlic, tomatoes, basil, and balsamic glaze.', price: 240, img: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c1.lastInsertRowid, name: 'Crispy Peri Peri Fries', desc: 'Golden hand-cut fries in fiery African spices with cheesy dip.', price: 190, img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 1 },
        { cat: c2.lastInsertRowid, name: 'Creamy Alfredo Fettuccine', desc: 'Pasta ribbons in garlic parmesan cream with wild mushrooms.', price: 380, img: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c2.lastInsertRowid, name: 'Classic Margherita Pizza', desc: 'Wood-fired thin crust with San Marzano tomatoes, buffalo mozzarella, and fresh basil.', price: 420, img: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c3.lastInsertRowid, name: 'Gourmet Truffle Burger', desc: 'Portobello patty, caramelized onions, truffle aioli on brioche.', price: 340, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c4.lastInsertRowid, name: 'Velvet Cappuccino', desc: 'Espresso topped with velvety micro-foam dusted with cocoa powder.', price: 210, img: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c4.lastInsertRowid, name: 'Hazelnut Iced Latte', desc: 'Chilled espresso with roasted hazelnut syrup and fresh milk.', price: 240, img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 },
        { cat: c5.lastInsertRowid, name: 'Molten Belgian Lava Cake', desc: 'Warm chocolate cake with flowing center and vanilla gelato.', price: 290, img: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', veg: 1, spicy: 0 }
      ];

      for (const it of sampleItems) {
        await db.run('INSERT INTO menu_items (category_id, name, description, price, image_url, available, is_veg, is_spicy) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [
          Number(it.cat), it.name, it.desc, it.price, it.img, it.veg, it.spicy
        ]);
      }
    }
  } catch (e) {
    // Auto-seed note
  }

  isInitialized = true;
}

export default db;
