import { Router, Response } from 'express';
import { OrderService } from '../services/orderService';
import { AuthenticatedRequest, requireCustomerAuth, requireTableSession, validateBody } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const createOrderSchema = z.object({
  items: z.array(z.object({
    menu_item_id: z.number().int().positive('Menu item ID must be a positive integer'),
    quantity: z.number().int().positive('Quantity must be at least 1').max(50)
  })).min(1, 'Order must contain at least one item'),
  payment_method: z.enum(['UPI', 'CASH'], { errorMap: () => ({ message: 'Payment method must be UPI or CASH' }) }),
  notes: z.string().max(250).optional(),
  idempotency_key: z.string().max(64).optional()
});

/**
 * POST /api/orders
 * Protected by both Table Session and Customer Auth.
 * Authoritative price calculation performed on backend.
 */
router.post(
  '/',
  requireTableSession,
  requireCustomerAuth,
  validateBody(createOrderSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { items, payment_method, notes, idempotency_key } = req.body;
    const userId = req.user!.id;
    const tableId = req.tableSession!.tableId;

    const result = await OrderService.createOrder({
      userId,
      tableId,
      items,
      paymentMethod: payment_method,
      notes,
      idempotencyKey: idempotency_key
    });

    if (!result.success || !result.order) {
      return res.status(400).json({ error: result.message || 'Failed to create order.' });
    }

    return res.status(201).json({
      message: 'Order placed successfully!',
      order: result.order
    });
  }
);

/**
 * GET /api/orders
 * Returns customer's own order history.
 */
router.get('/', requireCustomerAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orders = await OrderService.getCustomerOrderHistory(userId);
  return res.json({ orders });
});

/**
 * GET /api/orders/:publicOrderNumber
 * Strict customer ownership authorization check.
 */
router.get('/:publicOrderNumber', requireCustomerAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { publicOrderNumber } = req.params;
  const userId = req.user!.id;

  const order = await OrderService.getCustomerOrderByPublicNumber(publicOrderNumber, userId);

  if (!order) {
    return res.status(404).json({
      error: 'Order not found or you do not have permission to view this order.'
    });
  }

  return res.json({ order });
});

export default router;
