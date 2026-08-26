import { createClient, Client, Transaction } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

function getDatabaseConfig(): { url: string; authToken?: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: tursoToken
    };
  }

  // Local file-based fallback for local dev / offline testing
  const localDbPath = process.env.DATABASE_PATH || './data/cafe.db';
  const absoluteDbPath = path.resolve(process.cwd(), localDbPath);
  const dbDir = path.dirname(absoluteDbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return {
    url: `file:${absoluteDbPath.replace(/\\/g, '/')}`
  };
}

const config = getDatabaseConfig();
export const client: Client = createClient(config);

/**
 * Serverless & LibSQL/Turso Database Abstraction
 */
export const db = {
  client,

  /**
   * Execute single query and return all matching rows as typed objects
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await client.execute({ sql, args: params });
    return res.rows as unknown as T[];
  },

  /**
   * Execute single query and return the first matching row or null
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const res = await client.execute({ sql, args: params });
    if (!res.rows || res.rows.length === 0) {
      return null;
    }
    return res.rows[0] as unknown as T;
  },

  /**
   * Execute INSERT/UPDATE/DELETE query and return lastInsertRowid and affected rows count
   */
  async run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
    const res = await client.execute({ sql, args: params });
    return {
      lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      changes: res.rowsAffected
    };
  },

  /**
   * Execute raw SQL string (can contain multiple statements)
   */
  async exec(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await client.execute(stmt);
    }
  },

  /**
   * Execute multiple statements in an atomic batch
   */
  async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<void> {
    const stmts = statements.map(s => (typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.args || [] }));
    await client.batch(stmts, 'write');
  },

  /**
   * Interactive atomic transaction with rollback support
   */
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = await client.transaction('write');
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
 * Initializes database tables, indexes, and applies non-destructive migrations.
 */
export async function initDatabase(): Promise<void> {
  const schemaCandidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(process.cwd(), 'server', 'db', 'schema.sql'),
    path.resolve(__dirname, '..', '..', 'server', 'db', 'schema.sql')
  ];
  const schemaPath = schemaCandidates.find(p => fs.existsSync(p)) || schemaCandidates[0];
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split and execute schema statements
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (err: any) {
      // Ignore if table/index already exists
      if (!err.message?.includes('already exists')) {
        console.warn(`[Schema Warning]: ${err.message}`);
      }
    }
  }

  // Safe schema migrations
  try {
    await client.execute('ALTER TABLE payments ADD COLUMN verified_by INTEGER REFERENCES admin_users(id)');
  } catch (e) {
    // Column already exists
  }

  try {
    await client.execute('ALTER TABLE payments ADD COLUMN verified_at DATETIME');
  } catch (e) {
    // Column already exists
  }
}

export default db;
