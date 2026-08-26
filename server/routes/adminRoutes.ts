import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { TableService } from '../services/tableService';
import { MenuService } from '../services/menuService';
import { OrderService } from '../services/orderService';
import { PaymentService } from '../services/paymentService';
import { AdminService } from '../services/adminService';
import { AuthenticatedRequest, requireAdminAuth, requireAdminRole, validateBody, adminLoginLimiter } from '../middleware/auth';
import { OrderStatus, TableStatus } from '../../shared/types';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'])
});

const updateTableStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'ORDER_PENDING', 'PAYMENT_PENDING', 'CLEANING', 'INACTIVE'])
});

const createTableSchema = z.object({
  internal_table_code: z.string().min(1, 'Table code is required')
});

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  display_order: z.number().int().default(0)
});

const menuItemSchema = z.object({
  category_id: z.number().int().positive(),
  name: z.string().min(1, 'Item name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be greater than 0'),
  image_url: z.string().url('Valid image URL is required'),
  available: z.boolean().optional(),
  is_veg: z.boolean().optional(),
  is_spicy: z.boolean().optional()
});

const updateMenuItemSchema = menuItemSchema.partial();

const verifyUpiSchema = z.object({
  transaction_reference: z.string().optional()
});

// -------------------------------------------------------------
// Admin Authentication Routes
// -------------------------------------------------------------

/**
 * POST /api/admin/login
 */
router.post('/login', adminLoginLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await AuthService.adminLogin(email, password);

  if (!result.success || !result.token) {
    return res.status(401).json({ error: result.message });
  }

  // Set HttpOnly Admin Token Cookie
  res.cookie('admin_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  return res.json({
    message: result.message,
    admin: result.admin,
    token: result.token
  });
});

/**
 * POST /api/admin/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.json({ message: 'Admin logged out successfully.' });
});

/**
 * GET /api/admin/me
 */
router.get('/me', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ admin: req.admin });
});

// -------------------------------------------------------------
// Dashboard & Analytics Routes (Protected)
// -------------------------------------------------------------

/**
 * GET /api/admin/dashboard
 */
router.get('/dashboard', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const stats = await AdminService.getDashboardStats();
  return res.json({ stats });
});

/**
 * GET /api/admin/reports
 */
router.get('/reports', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

  const report = await AdminService.getReports(startDate, endDate);
  return res.json({ report });
});

/**
 * GET /api/admin/customers
 */
router.get('/customers', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const customers = await AdminService.getCustomerList(search);
  return res.json({ customers });
});

// -------------------------------------------------------------
// Live Orders Management
// -------------------------------------------------------------

/**
 * GET /api/admin/orders
 */
router.get('/orders', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const filters = {
    orderStatus: req.query.status as OrderStatus | undefined,
    paymentStatus: typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus : undefined,
    paymentMethod: typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    date: typeof req.query.date === 'string' ? req.query.date : undefined
  };

  const orders = await OrderService.getAdminOrders(filters);
  return res.json({ orders });
});

/**
 * PATCH /api/admin/orders/:id/status
 */
router.patch(
  '/orders/:id/status',
  requireAdminAuth,
  validateBody(updateOrderStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const result = await OrderService.updateOrderStatus(orderId, req.body.status);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ message: result.message });
  }
);

// -------------------------------------------------------------
// Table & QR Management
// -------------------------------------------------------------

/**
 * GET /api/admin/tables
 */
router.get('/tables', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const tables = await TableService.getAdminTables();
  return res.json({ tables });
});

/**
 * POST /api/admin/tables (Requires ADMIN role)
 */
router.post('/tables', requireAdminAuth, requireAdminRole, validateBody(createTableSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const table = await TableService.createTable(req.body.internal_table_code);
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const qrDataUrl = await TableService.generateQrCodeDataUrl(table.rawToken, hostUrl);

    return res.status(201).json({
      message: 'Table created successfully',
      table: {
        id: table.id,
        internal_table_code: table.internalTableCode,
        status: 'AVAILABLE'
      },
      rawToken: table.rawToken,
      qrDataUrl
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create table';
    return res.status(400).json({ error: errorMsg });
  }
});

/**
 * PATCH /api/admin/tables/:id
 */
router.patch(
  '/tables/:id',
  requireAdminAuth,
  validateBody(updateTableStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const tableId = Number(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ error: 'Invalid table ID' });
    }

    const success = await TableService.updateTableStatus(tableId, req.body.status as TableStatus);
    if (!success) {
      return res.status(404).json({ error: 'Table not found' });
    }

    return res.json({ message: 'Table status updated successfully.' });
  }
);

/**
 * POST /api/admin/tables/:id/regenerate-token (Requires ADMIN role)
 */
router.post('/tables/:id/regenerate-token', requireAdminAuth, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const tableId = Number(req.params.id);
  if (isNaN(tableId)) {
    return res.status(400).json({ error: 'Invalid table ID' });
  }

  const result = await TableService.regenerateTableToken(tableId);
  if (!result.success || !result.rawToken) {
    return res.status(404).json({ error: 'Table not found' });
  }

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const qrDataUrl = await TableService.generateQrCodeDataUrl(result.rawToken, hostUrl);

  return res.json({
    message: `Table token regenerated successfully. Previous QR has been revoked.`,
    tableCode: result.tableCode,
    rawToken: result.rawToken,
    qrDataUrl
  });
});

/**
 * GET /api/admin/tables/:id/qr
 */
router.get('/tables/:id/qr', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const tableId = Number(req.params.id);
  if (isNaN(tableId)) {
    return res.status(400).json({ error: 'Invalid table ID' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (!token) {
    return res.status(400).json({ error: 'Token query parameter required, or use regenerate-token endpoint.' });
  }

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const qrDataUrl = await TableService.generateQrCodeDataUrl(token, hostUrl);

  return res.json({ qrDataUrl });
});

// -------------------------------------------------------------
// Menu & Category Management
// -------------------------------------------------------------

/**
 * POST /api/admin/menu/categories
 */
router.post('/menu/categories', requireAdminAuth, validateBody(categorySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = await MenuService.createCategory(req.body.name, req.body.display_order);
    return res.status(201).json({ category });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Category already exists or invalid data';
    return res.status(400).json({ error: errorMsg });
  }
});

/**
 * PATCH /api/admin/menu/categories/:id
 */
router.patch('/menu/categories/:id', requireAdminAuth, validateBody(categorySchema), async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const success = await MenuService.updateCategory(id, req.body.name, req.body.display_order);
  if (!success) {
    return res.status(404).json({ error: 'Category not found' });
  }
  return res.json({ message: 'Category updated successfully' });
});

/**
 * DELETE /api/admin/menu/categories/:id (Requires ADMIN role)
 */
router.delete('/menu/categories/:id', requireAdminAuth, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const result = await MenuService.deleteCategory(id);
  if (!result.success) {
    return res.status(400).json({ error: result.message || 'Cannot delete category' });
  }
  return res.json({ message: 'Category deleted successfully' });
});

/**
 * POST /api/admin/menu
 */
router.post('/menu', requireAdminAuth, validateBody(menuItemSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = await MenuService.createMenuItem(req.body);
    return res.status(201).json({ item });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create menu item';
    return res.status(400).json({ error: errorMsg });
  }
});

/**
 * PATCH /api/admin/menu/:id
 */
router.patch('/menu/:id', requireAdminAuth, validateBody(updateMenuItemSchema), async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const item = await MenuService.updateMenuItem(id, req.body);
  if (!item) {
    return res.status(404).json({ error: 'Menu item not found' });
  }
  return res.json({ item });
});

/**
 * DELETE /api/admin/menu/:id (Requires ADMIN role)
 */
router.delete('/menu/:id', requireAdminAuth, requireAdminRole, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const success = await MenuService.deleteMenuItem(id);
  if (!success) {
    return res.status(404).json({ error: 'Menu item not found' });
  }
  return res.json({ message: 'Menu item deleted successfully' });
});

// -------------------------------------------------------------
// Payments Management & Verification
// -------------------------------------------------------------

/**
 * GET /api/admin/payments
 */
router.get('/payments', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const filters = {
    status: req.query.status as any,
    method: typeof req.query.method === 'string' ? req.query.method : undefined
  };

  const payments = await PaymentService.getAdminPayments(filters);
  return res.json({ payments });
});

/**
 * POST /api/admin/payments/:orderId/verify-upi
 * Staff verifies receipt of UPI transfer (via bank app/soundbox/SMS) and marks payment PAID.
 */
router.post(
  '/payments/:orderId/verify-upi',
  requireAdminAuth,
  validateBody(verifyUpiSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const adminId = req.admin!.id;
    const result = await PaymentService.verifyUpiPayment(orderId, adminId, req.body.transaction_reference);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ message: result.message });
  }
);

/**
 * POST /api/admin/payments/:orderId/verify-cash
 * Staff confirms receipt of physical cash at counter and marks payment PAID.
 */
router.post('/payments/:orderId/verify-cash', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orderId = Number(req.params.orderId);
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }

  const adminId = req.admin!.id;
  const result = await PaymentService.verifyCashPayment(orderId, adminId);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({ message: result.message });
});

export default router;
