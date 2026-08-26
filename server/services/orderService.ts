import { db } from '../db/database';
import { generatePublicOrderNumber } from '../utils/crypto';
import { CustomerOrderView, Order, OrderItem, OrderStatus, PaymentMethod } from '../../shared/types';

const TAX_RATE_PERCENT = parseFloat(process.env.TAX_RATE_PERCENT || '5.0');

export class OrderService {
  /**
   * Authoritative server-side price calculation and transactional order creation.
   * NEVER trusts client-submitted prices or totals.
   */
  static async createOrder(params: {
    userId: number;
    tableId: number;
    items: Array<{ menu_item_id: number; quantity: number }>;
    paymentMethod: PaymentMethod;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{
    success: boolean;
    order?: CustomerOrderView;
    message?: string;
  }> {
    const { userId, tableId, items, paymentMethod, notes, idempotencyKey } = params;

    if (!items || items.length === 0) {
      return { success: false, message: 'Order must contain at least one item.' };
    }

    // Check Idempotency Key if provided
    if (idempotencyKey) {
      const existingKey = await db.get<{ response_body: string }>(
        'SELECT response_body FROM idempotency_keys WHERE idempotency_key = ?',
        [idempotencyKey]
      );
      if (existingKey) {
        return {
          success: true,
          order: JSON.parse(existingKey.response_body)
        };
      }
    }

    // Step 1: Fetch and validate menu items & current prices from DB
    const validatedItems: Array<{
      menuItemId: number;
      name: string;
      unitPrice: number;
      quantity: number;
      itemTotal: number;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      const quantity = Math.floor(Number(item.quantity));
      if (isNaN(quantity) || quantity <= 0 || quantity > 50) {
        return { success: false, message: `Invalid quantity ${item.quantity} specified.` };
      }

      const menuItem = await db.get<{ id: number; name: string; price: number; available: number }>(`
        SELECT id, name, price, available 
        FROM menu_items 
        WHERE id = ?
      `, [item.menu_item_id]);

      if (!menuItem) {
        return { success: false, message: `Menu item #${item.menu_item_id} not found.` };
      }

      if (!menuItem.available) {
        return { success: false, message: `"${menuItem.name}" is currently unavailable.` };
      }

      const unitPrice = Number(menuItem.price);
      const itemTotal = Number((unitPrice * quantity).toFixed(2));
      subtotal += itemTotal;

      validatedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        unitPrice,
        quantity,
        itemTotal
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const tax = Number((subtotal * (TAX_RATE_PERCENT / 100)).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    const publicOrderNumber = generatePublicOrderNumber();

    // Execute atomic database transaction
    const createdCustomerOrder = await db.transaction<CustomerOrderView>(async (tx) => {
      // 1. Insert Order
      const orderInsert = await tx.execute({
        sql: `
          INSERT INTO orders (
            public_order_number, user_id, table_id, subtotal, tax, total, 
            payment_method, payment_status, order_status, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?)
        `,
        args: [
          publicOrderNumber,
          userId,
          tableId,
          subtotal,
          tax,
          total,
          paymentMethod,
          notes || null
        ]
      });

      const orderId = Number(orderInsert.lastInsertRowid);

      // 2. Insert Order Item Snapshots
      for (const valItem of validatedItems) {
        await tx.execute({
          sql: `
            INSERT INTO order_items (
              order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity, total
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          args: [
            orderId,
            valItem.menuItemId,
            valItem.name,
            valItem.unitPrice,
            valItem.quantity,
            valItem.itemTotal
          ]
        });
      }

      // 3. Insert Initial Payment Record
      await tx.execute({
        sql: `
          INSERT INTO payments (order_id, method, amount, status)
          VALUES (?, ?, ?, 'PENDING')
        `,
        args: [orderId, paymentMethod, total]
      });

      // 4. Update Table Status to OCCUPIED
      await tx.execute({
        sql: `
          UPDATE tables 
          SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND status != 'INACTIVE'
        `,
        args: [tableId]
      });

      const customerOrder: CustomerOrderView = {
        public_order_number: publicOrderNumber,
        subtotal,
        tax,
        total,
        payment_method: paymentMethod,
        payment_status: 'PENDING',
        order_status: 'PENDING',
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: validatedItems.map(vi => ({
          item_name_snapshot: vi.name,
          unit_price_snapshot: vi.unitPrice,
          quantity: vi.quantity,
          total: vi.itemTotal
        }))
      };

      // 5. Store Idempotency Key if provided
      if (idempotencyKey) {
        await tx.execute({
          sql: `
            INSERT INTO idempotency_keys (idempotency_key, response_status, response_body)
            VALUES (?, 201, ?)
          `,
          args: [idempotencyKey, JSON.stringify(customerOrder)]
        });
      }

      return customerOrder;
    });

    return {
      success: true,
      order: createdCustomerOrder
    };
  }

  /**
   * Customer: Get order details by Public Order Number with strict IDOR verification.
   * NEVER exposes internal table_id or table code.
   */
  static async getCustomerOrderByPublicNumber(publicOrderNumber: string, userId: number): Promise<CustomerOrderView | null> {
    const order = await db.get<Order>(`
      SELECT 
        id,
        public_order_number,
        user_id,
        subtotal,
        tax,
        total,
        payment_method,
        payment_status,
        order_status,
        notes,
        created_at,
        updated_at
      FROM orders
      WHERE public_order_number = ? AND user_id = ?
    `, [publicOrderNumber, userId]);

    if (!order) return null;

    const items = await db.all<{
      item_name_snapshot: string;
      unit_price_snapshot: number;
      quantity: number;
      total: number;
    }>(`
      SELECT 
        item_name_snapshot,
        unit_price_snapshot,
        quantity,
        total
      FROM order_items
      WHERE order_id = ?
    `, [order.id]);

    return {
      public_order_number: order.public_order_number,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items
    };
  }

  /**
   * Customer: Get all past orders for the authenticated user.
   */
  static async getCustomerOrderHistory(userId: number): Promise<CustomerOrderView[]> {
    const orders = await db.all<Order>(`
      SELECT 
        id,
        public_order_number,
        subtotal,
        tax,
        total,
        payment_method,
        payment_status,
        order_status,
        notes,
        created_at,
        updated_at
      FROM orders
      WHERE user_id = ?
      ORDER BY id DESC
    `, [userId]);

    const result: CustomerOrderView[] = [];

    for (const order of orders) {
      const items = await db.all<{
        item_name_snapshot: string;
        unit_price_snapshot: number;
        quantity: number;
        total: number;
      }>(`
        SELECT 
          item_name_snapshot,
          unit_price_snapshot,
          quantity,
          total
        FROM order_items
        WHERE order_id = ?
      `, [order.id]);

      result.push({
        public_order_number: order.public_order_number,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        order_status: order.order_status,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items
      });
    }

    return result;
  }

  /**
   * Admin: Get full order list with search filters.
   */
  static async getAdminOrders(filters?: {
    orderStatus?: OrderStatus;
    paymentStatus?: string;
    paymentMethod?: string;
    search?: string;
    date?: string;
  }): Promise<Order[]> {
    let sql = `
      SELECT 
        o.id,
        o.public_order_number,
        o.user_id,
        u.phone as user_phone,
        o.table_id,
        t.internal_table_code,
        o.subtotal,
        o.tax,
        o.total,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.notes,
        o.created_at,
        o.updated_at
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN tables t ON t.id = o.table_id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (filters?.orderStatus) {
      sql += ' AND o.order_status = ?';
      params.push(filters.orderStatus);
    }

    if (filters?.paymentStatus) {
      sql += ' AND o.payment_status = ?';
      params.push(filters.paymentStatus);
    }

    if (filters?.paymentMethod) {
      sql += ' AND o.payment_method = ?';
      params.push(filters.paymentMethod);
    }

    if (filters?.search && filters.search.trim()) {
      sql += ' AND (o.public_order_number LIKE ? OR u.phone LIKE ? OR t.internal_table_code LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }

    if (filters?.date) {
      sql += " AND date(o.created_at) = date(?)";
      params.push(filters.date);
    }

    sql += ' ORDER BY o.id DESC';

    const orders = await db.all<Order>(sql, params);

    for (const ord of orders) {
      ord.items = await db.all<OrderItem>(`
        SELECT * FROM order_items WHERE order_id = ?
      `, [ord.id]);
    }

    return orders;
  }

  /**
   * Admin: Update order status along its valid lifecycle.
   */
  static async updateOrderStatus(orderId: number, nextStatus: OrderStatus): Promise<{ success: boolean; message: string }> {
    const order = await db.get<{ id: number; table_id: number; order_status: OrderStatus }>(
      'SELECT id, table_id, order_status FROM orders WHERE id = ?',
      [orderId]
    );
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'PENDING': ['ACCEPTED', 'CANCELLED'],
      'ACCEPTED': ['PREPARING', 'CANCELLED'],
      'PREPARING': ['READY', 'CANCELLED'],
      'READY': ['SERVED', 'CANCELLED'],
      'SERVED': ['COMPLETED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    if (!validTransitions[order.order_status].includes(nextStatus)) {
      return {
        success: false,
        message: `Invalid status transition from ${order.order_status} to ${nextStatus}.`
      };
    }

    await db.run(`
      UPDATE orders 
      SET order_status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [nextStatus, orderId]);

    // If order completed, check if table should transition to AVAILABLE or CLEANING
    if (nextStatus === 'COMPLETED') {
      const otherActiveOrders = await db.get<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE table_id = ? AND order_status NOT IN ('COMPLETED', 'CANCELLED')
      `, [order.table_id]);

      if (otherActiveOrders && otherActiveOrders.count === 0) {
        await db.run("UPDATE tables SET status = 'AVAILABLE' WHERE id = ? AND status != 'INACTIVE'", [order.table_id]);
      }
    }

    return { success: true, message: `Order status updated to ${nextStatus}.` };
  }
}
