import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_SALT = process.env.SESSION_SECRET || 'cafe-otp-salt-secret-string';

/**
 * Generate a cryptographically secure 256-bit opaque table token.
 * This is given to the client / encoded in QR, but NEVER stored in plaintext in the DB.
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash an opaque token with SHA-256 for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generate a secure 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP using SHA-256 and secret salt.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(`${otp}:${OTP_SALT}`).digest('hex');
}

/**
 * Verify an entered OTP against the stored hash.
 */
export function verifyOtpHash(enteredOtp: string, storedHash: string): boolean {
  const enteredHash = hashOtp(enteredOtp);
  return crypto.timingSafeEqual(Buffer.from(enteredHash), Buffer.from(storedHash));
}

/**
 * Generate a unique, user-friendly public order identifier.
 * Format: ORD-XXXXXX (e.g. ORD-738291)
 */
export function generatePublicOrderNumber(): string {
  const num = crypto.randomInt(100000, 999999);
  return `ORD-${num}`;
}

/**
 * Hash admin password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify admin password using bcrypt.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
