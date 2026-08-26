import { Router, Request, Response } from 'express';
import { TableService } from '../services/tableService';
import { AuthenticatedRequest, requireTableSession, validateBody } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const tokenSessionSchema = z.object({
  token: z.string().min(1, 'Table token is required')
});

/**
 * POST /api/table/session
 * Validates opaque table token and issues secure HttpOnly table session cookie.
 * NEVER returns internal table ID or internal table code.
 */
router.post('/session', validateBody(tokenSessionSchema), async (req: Request, res: Response) => {
  const { token } = req.body;
  const result = await TableService.validateAndCreateSession(token);

  if (!result.success || !result.sessionToken) {
    return res.status(403).json({
      error: result.message,
      sessionActive: false
    });
  }

  // Set secure HttpOnly cookie for table session
  res.cookie('table_session', result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000 // 12 hours
  });

  return res.json({
    success: true,
    message: result.message,
    sessionActive: true,
    sessionToken: result.sessionToken // Also returned for mobile web client fallback header
  });
});

/**
 * GET /api/table/session
 * Verifies active table session.
 * Safe public response: table verified confirmation ONLY.
 */
router.get('/session', requireTableSession, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    valid: true,
    message: 'Table verified successfully.',
    sessionActive: true
  });
});

/**
 * POST /api/table/session/clear
 */
router.post('/session/clear', (req: Request, res: Response) => {
  res.clearCookie('table_session');
  return res.json({ message: 'Table session cleared successfully.' });
});

export default router;
