import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { hashToken } from '../utils/crypto';
import { z, ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.SESSION_SECRET || 'cafe-super-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    phone: string;
  };
  admin?: {
    id: number;
    email: string;
    role: 'ADMIN' | 'STAFF';
  };
  tableSession?: {
    sessionId: string;
    tableId: number;
  };
}

/**
 * Validates request body using Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Rate Limiter for OTP Requests (Prevents SMS abuse & spam)
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per IP per window
  message: { error: 'Too many OTP requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false }
});

/**
 * Rate Limiter for OTP Verification attempts
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15,
  message: { error: 'Too many verification attempts. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false }
});

/**
 * Rate Limiter for Admin Login
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false }
});

/**
 * Middleware: Verify Table Session (Opaque Session Cookie or Header)
 * Ensures the customer is ordering from an active, verified table.
 * Attaches tableSession.tableId internally without exposing it to the client.
 */
export async function requireTableSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionToken = req.cookies?.table_session || req.headers['x-table-session'];

  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.status(403).json({
      error: 'No active table session found. Please scan your table QR code to begin ordering.'
    });
  }

  const sessionHash = hashToken(sessionToken);

  const session = await db.get<{ session_id: string; table_id: number; expires_at: string; table_status: string }>(`
    SELECT ts.session_id, ts.table_id, ts.expires_at, t.status as table_status
    FROM table_sessions ts
    JOIN tables t ON t.id = ts.table_id
    WHERE ts.session_token_hash = ?
  `, [sessionHash]);

  if (!session) {
    return res.status(403).json({
      error: 'Invalid or expired table session. Please re-scan your table QR code.'
    });
  }

  // Check expiration
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.run('DELETE FROM table_sessions WHERE session_token_hash = ?', [sessionHash]);
    return res.status(403).json({
      error: 'Table session has expired. Please scan your table QR code again.'
    });
  }

  if (session.table_status === 'INACTIVE') {
    return res.status(403).json({
      error: 'This table is currently not in service. Please contact cafe staff.'
    });
  }

  req.tableSession = {
    sessionId: session.session_id,
    tableId: session.table_id
  };

  next();
}

/**
 * Middleware: Authenticate Customer User (JWT cookie or Bearer token)
 */
export async function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.customer_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please enter your mobile number and OTP to proceed.'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; phone: string; type: string };
    
    if (payload.type !== 'customer') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verify user exists in database
    const user = await db.get<{ id: number; phone: string }>('SELECT id, phone FROM users WHERE id = ?', [payload.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

/**
 * Middleware: Optional Customer Auth (Loads user if logged in, does not block if guest)
 */
export async function optionalCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.customer_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; phone: string; type: string };
    if (payload.type === 'customer') {
      const user = await db.get<{ id: number; phone: string }>('SELECT id, phone FROM users WHERE id = ?', [payload.userId]);
      if (user) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid optional token
  }
  next();
}

/**
 * Middleware: Authenticate Admin / Staff User
 */
export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { adminId: number; email: string; role: 'ADMIN' | 'STAFF'; type: string };

    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admin credentials required.' });
    }

    const adminUser = await db.get<{ id: number; email: string; role: 'ADMIN' | 'STAFF' }>(
      'SELECT id, email, role FROM admin_users WHERE id = ?',
      [payload.adminId]
    );
    if (!adminUser) {
      return res.status(401).json({ error: 'Admin account not found.' });
    }

    req.admin = adminUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Admin session expired or invalid. Please log in again.' });
  }
}

/**
 * Middleware: Require Super Admin Role
 */
export function requireAdminRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.admin || req.admin.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Action requires super-administrator privileges.' });
  }
  next();
}
