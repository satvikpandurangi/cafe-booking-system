import { Router, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest, requireCustomerAuth, validateBody, otpRequestLimiter, otpVerifyLimiter } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const requestOtpSchema = z.object({
  phone: z.string().min(10, 'Mobile number must be at least 10 digits').max(15)
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

/**
 * POST /api/auth/request-otp
 */
router.post('/request-otp', otpRequestLimiter, validateBody(requestOtpSchema), async (req, res) => {
  const result = await AuthService.requestCustomerOtp(req.body.phone);
  if (!result.success) {
    return res.status(400).json({ error: result.message, cooldownRemaining: result.cooldownRemaining });
  }
  return res.json({
    message: result.message,
    devOtp: result.devOtp
  });
});

/**
 * POST /api/auth/verify-otp
 */
router.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), async (req, res) => {
  const result = await AuthService.verifyCustomerOtp(req.body.phone, req.body.otp);
  if (!result.success) {
    return res.status(400).json({
      error: result.message,
      attemptsRemaining: result.attemptsRemaining
    });
  }

  // Set HttpOnly JWT cookie
  res.cookie('customer_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({
    message: result.message,
    user: result.user,
    token: result.token
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('customer_token');
  return res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireCustomerAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

export default router;
