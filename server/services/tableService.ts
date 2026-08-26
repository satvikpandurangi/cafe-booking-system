import { db } from '../db/database';
import { generateOpaqueToken, hashToken } from '../utils/crypto';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { AdminTable, TableStatus } from '../../shared/types';

export class TableService {
  /**
   * Validate an opaque table entry token scanned by a customer.
   * NEVER returns internal table_id or internal_table_code.
   * Creates a secure table session and returns the raw session token to be stored in an HttpOnly cookie.
   */
  static async validateAndCreateSession(rawOpaqueToken: string): Promise<{
    success: boolean;
    sessionToken?: string;
    message: string;
  }> {
    if (!rawOpaqueToken || typeof rawOpaqueToken !== 'string') {
      return { success: false, message: 'Invalid table QR token provided.' };
    }

    const tokenHash = hashToken(rawOpaqueToken);

    const table = await db.get<{ id: number; status: TableStatus }>(`
      SELECT id, status FROM tables WHERE secure_token_hash = ?
    `, [tokenHash]);

    if (!table) {
      return { success: false, message: 'Invalid or revoked table token. Please check with cafe staff.' };
    }

    if (table.status === 'INACTIVE') {
      return { success: false, message: 'This table is currently inactive.' };
    }

    // Generate a secure session token
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = hashToken(rawSessionToken);
    const sessionId = crypto.randomUUID();
    
    // Session valid for 12 hours
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    // Store in table_sessions table
    await db.run(`
      INSERT INTO table_sessions (session_id, session_token_hash, table_id, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, sessionTokenHash, table.id, expiresAt]);

    return {
      success: true,
      sessionToken: rawSessionToken,
      message: 'Table verified successfully.'
    };
  }

  /**
   * Admin: List all physical tables with status and session information.
   */
  static async getAdminTables(): Promise<AdminTable[]> {
    const rows = await db.all<{
      id: number;
      internal_table_code: string;
      status: TableStatus;
      created_at: string;
      updated_at: string;
      session_count: number;
    }>(`
      SELECT 
        t.id,
        t.internal_table_code,
        t.status,
        t.created_at,
        t.updated_at,
        COUNT(ts.id) as session_count
      FROM tables t
      LEFT JOIN table_sessions ts ON ts.table_id = t.id AND datetime(ts.expires_at) > datetime('now')
      GROUP BY t.id
      ORDER BY t.id ASC
    `);

    return rows.map(r => ({
      id: r.id,
      internal_table_code: r.internal_table_code,
      status: r.status,
      has_active_session: r.session_count > 0,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  /**
   * Admin: Create a new physical table.
   */
  static async createTable(internalTableCode: string): Promise<{
    id: number;
    internalTableCode: string;
    rawToken: string;
  }> {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);

    const result = await db.run(`
      INSERT INTO tables (internal_table_code, secure_token_hash, status)
      VALUES (?, ?, 'AVAILABLE')
    `, [internalTableCode, tokenHash]);

    return {
      id: Number(result.lastInsertRowid),
      internalTableCode,
      rawToken
    };
  }

  /**
   * Admin: Regenerate table token (Revokes old QR and immediately invalidates all active sessions for this table).
   */
  static async regenerateTableToken(tableId: number): Promise<{
    success: boolean;
    rawToken?: string;
    tableCode?: string;
  }> {
    const table = await db.get<{ id: number; internal_table_code: string }>(
      'SELECT id, internal_table_code FROM tables WHERE id = ?',
      [tableId]
    );
    if (!table) {
      return { success: false };
    }

    const newRawToken = generateOpaqueToken();
    const newTokenHash = hashToken(newRawToken);

    await db.transaction(async (tx) => {
      // 1. Update table record with new token hash
      await tx.execute({
        sql: `
          UPDATE tables 
          SET secure_token_hash = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `,
        args: [newTokenHash, tableId]
      });

      // 2. Invalidate all previous table sessions
      await tx.execute({
        sql: 'DELETE FROM table_sessions WHERE table_id = ?',
        args: [tableId]
      });
    });

    return {
      success: true,
      rawToken: newRawToken,
      tableCode: table.internal_table_code
    };
  }

  /**
   * Admin: Update table status (e.g. AVAILABLE, OCCUPIED, CLEANING, INACTIVE).
   */
  static async updateTableStatus(tableId: number, status: TableStatus): Promise<boolean> {
    const result = await db.run(`
      UPDATE tables 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, tableId]);

    return result.changes > 0;
  }

  /**
   * Admin: Generate QR code image (Data URL) for a table's opaque token.
   */
  static async generateQrCodeDataUrl(rawToken: string, hostUrl?: string): Promise<string> {
    const base = hostUrl || 'http://localhost:5173';
    const entryUrl = `${base}/entry?token=${encodeURIComponent(rawToken)}`;
    
    return QRCode.toDataURL(entryUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: {
        dark: '#342218',
        light: '#FFFFFF'
      }
    });
  }

  /**
   * Admin: Fetch a table's QR info by regenerating or retrieving if token is provided.
   */
  static async getTableById(tableId: number) {
    return await db.get('SELECT id, internal_table_code, status, created_at, updated_at FROM tables WHERE id = ?', [tableId]);
  }
}
