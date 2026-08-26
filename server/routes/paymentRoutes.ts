import { Router, Response } from 'express';
import { PaymentService } from '../services/paymentService';
import { AuthenticatedRequest, requireCustomerAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/payments/:publicOrderNumber/upi
 * Returns direct UPI intent URL and scannable QR generated from authoritative server calculation.
 */
router.get('/:publicOrderNumber/upi', requireCustomerAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { publicOrderNumber } = req.params;
  const userId = req.user!.id;

  const result = await PaymentService.getUpiPaymentDetails(publicOrderNumber, userId);

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json(result);
});

export default router;
