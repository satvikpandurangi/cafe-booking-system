import { db } from '../db/database';
import { generateOtp, hashOtp, verifyOtpHash, comparePassword } from '../utils/crypto';
import jwt from 'jsonwebtoken';
import { AdminUser, User } from '../../shared/types';

const JWT_SECRET = process.env.SESSION_SECRET || 'cafe-super-secret-key-change-in-production';
const OTP_DEV_CODE = process.env.OTP_DEV_CODE || '123456';
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Ensures Dev OTP mode is strictly forbidden in production
 */
function isDevOtpActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_MODE === 'true';
}

export class AuthService {
  /**
   * Normalizes mobile phone number to standard format.
   */
  static normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s-]/g, '').trim();
    if (/^\d{10}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (/^\+91\d{10}$/.test(cleaned)) {
      return cleaned;
    }
    if (/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Request OTP for customer phone number.
   * Enforces 60-second resend cooldown and 5-minute expiry.
   */
  static async requestCustomerOtp(rawPhone: string): Promise<{
    success: boolean;
    message: string;
    cooldownRemaining?: number;
    devOtp?: string;
  }> {
    const phone = this.normalizePhone(rawPhone);

    if (!/^\+91\d{10}$/.test(phone) && !/^\+[1-9]\d{8,14}$/.test(phone)) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
    }

    const existing = await db.get<{
      id: number;
      last_sent_at: string;
      attempts: number;
    }>('SELECT * FROM otp_records WHERE phone = ?', [phone]);

    const now = Date.now();

    if (existing) {
      const lastSentTime = new Date(existing.last_sent_at).getTime();
      const elapsedSeconds = Math.floor((now - lastSentTime) / 1000);

      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        const remaining = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
        return {
          success: false,
          message: `Please wait ${remaining} seconds before requesting a new OTP.`,
          cooldownRemaining: remaining
        };
      }
    }

    const devActive = isDevOtpActive();
    const otp = devActive ? OTP_DEV_CODE : generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const lastSentAt = new Date(now).toISOString();

    await db.run(`
      INSERT INTO otp_records (phone, otp_hash, attempts, max_attempts, expires_at, last_sent_at)
      VALUES (?, ?, 0, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        otp_hash = excluded.otp_hash,
        attempts = 0,
        expires_at = excluded.expires_at,
        last_sent_at = excluded.last_sent_at
    `, [phone, otpHash, MAX_OTP_ATTEMPTS, expiresAt, lastSentAt]);

    // In production, send via SMS provider (Twilio / Msg91)
    // In dev mode, return devOtp so it's readily testable
    return {
      success: true,
      message: `OTP sent successfully to ${phone}`,
      devOtp: devActive ? otp : undefined
    };
  }

  /**
   * Verify OTP and issue Customer JWT.
   */
  static async verifyCustomerOtp(rawPhone: string, enteredOtp: string): Promise<{
    success: boolean;
    token?: string;
    user?: User;
    message: string;
    attemptsRemaining?: number;
  }> {
    const phone = this.normalizePhone(rawPhone);

    const record = await db.get<{
      id: number;
      phone: string;
      otp_hash: string;
      attempts: number;
      max_attempts: number;
      expires_at: string;
    }>('SELECT * FROM otp_records WHERE phone = ?', [phone]);

    if (!record) {
      return { success: false, message: 'No active OTP request found for this number. Please request a new OTP.' };
    }

    const now = Date.now();
    if (new Date(record.expires_at).getTime() < now) {
      await db.run('DELETE FROM otp_records WHERE id = ?', [record.id]);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (record.attempts >= record.max_attempts) {
      await db.run('DELETE FROM otp_records WHERE id = ?', [record.id]);
      return { success: false, message: 'Too many incorrect attempts. Please request a new OTP.' };
    }

    const devActive = isDevOtpActive();
    const isValid = verifyOtpHash(enteredOtp.trim(), record.otp_hash) || (devActive && enteredOtp.trim() === OTP_DEV_CODE);

    if (!isValid) {
      const newAttempts = record.attempts + 1;
      const remaining = record.max_attempts - newAttempts;

      if (remaining <= 0) {
        await db.run('DELETE FROM otp_records WHERE id = ?', [record.id]);
        return { success: false, message: 'Maximum attempts reached. Please request a new OTP.' };
      }

      await db.run('UPDATE otp_records SET attempts = ? WHERE id = ?', [newAttempts, record.id]);
      return {
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
        attemptsRemaining: remaining
      };
    }

    // OTP Verified! Clear OTP record immediately to prevent replay
    await db.run('DELETE FROM otp_records WHERE id = ?', [record.id]);

    // Upsert User
    const existingUser = await db.get<User>('SELECT id, phone, created_at, updated_at FROM users WHERE phone = ?', [phone]);
    let user: User;

    if (existingUser) {
      user = existingUser;
    } else {
      const insertResult = await db.run('INSERT INTO users (phone) VALUES (?)', [phone]);
      user = {
        id: Number(insertResult.lastInsertRowid),
        phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      success: true,
      token,
      user,
      message: 'Authentication successful.'
    };
  }

  /**
   * Admin Login with email and bcrypt password check.
   */
  static async adminLogin(email: string, password: string): Promise<{
    success: boolean;
    token?: string;
    admin?: AdminUser;
    message: string;
  }> {
    const admin = await db.get<{
      id: number;
      email: string;
      password_hash: string;
      role: 'ADMIN' | 'STAFF';
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM admin_users WHERE email = ?', [email.trim().toLowerCase()]);

    if (!admin) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const isValidPassword = await comparePassword(password, admin.password_hash);
    if (!isValidPassword) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role, type: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const safeAdmin: AdminUser = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      created_at: admin.created_at,
      updated_at: admin.updated_at
    };

    return {
      success: true,
      token,
      admin: safeAdmin,
      message: 'Admin login successful.'
    };
  }
}
