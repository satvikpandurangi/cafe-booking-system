import { db } from '../db/database';
import { PaymentRecord, PaymentStatus } from '../../shared/types';
import QRCode from 'qrcode';
import crypto from 'crypto';

const UPI_ID = process.env.UPI_ID || 'artisan.cafe@okaxis';
const CAFE_NAME = process.env.CAFE_NAME || 'Artisan Coffee & Bistro';

export class PaymentService {
  /**
   * Generates UPI direct intent URL and scannable QR based on authoritative server total.
   * Client price or amount input is NEVER used.
   */
  static async getUpiPaymentDetails(publicOrderNumber: string, userId: number): Promise<{
    success: boolean;
    upiUrl?: string;
    qrDataUrl?: string;
    amount?: number;
    upiId?: string;
    cafeName?: string;
    transactionReference?: string;
    message?: string;
  }> {
    const order = await db.get<{ id: number; public_order_number: string; total: number; payment_status: string; user_id: number }>(`
      SELECT id, public_order_number, total, payment_status, user_id 
      FROM orders 
      WHERE public_order_number = ? AND user_id = ?
    `, [publicOrderNumber, userId]);

    if (!order) {
      return { success: false, message: 'Order not found or access denied.' };
    }

    if (order.payment_status === 'PAID') {
      return { success: false, message: 'This order is already marked as PAID.' };
    }

    const txRef = `UPI-${order.public_order_number}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const amount = Number(order.total.toFixed(2));
    
    // Standards-compliant direct UPI Intent URI (pa, pn, am, cu, tn, tr)
    const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(CAFE_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.public_order_number}`)}&tr=${encodeURIComponent(txRef)}`;

    // Generate Scannable QR Image
    const qrDataUrl = await QRCode.toDataURL(upiUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#342218',
        light: '#FFFFFF'
      }
    });

    // Store transaction reference in payment record if not already assigned
    await db.run(`
      UPDATE payments 
      SET transaction_reference = COALESCE(transaction_reference, ?) 
      WHERE order_id = ?
    `, [txRef, order.id]);

    return {
      success: true,
      upiUrl,
      qrDataUrl,
      amount,
      upiId: UPI_ID,
      cafeName: CAFE_NAME,
      transactionReference: txRef
    };
  }

  /**
   * Admin / Staff: Verify UPI payment after checking bank statement or cafe soundbox.
   * Transitions payment and order status from PENDING to PAID.
   */
  static async verifyUpiPayment(orderId: number, verifiedByAdminId: number, customTransactionReference?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const order = await db.get<{ id: number; payment_method: string; payment_status: string; total: number }>(`
      SELECT id, payment_method, payment_status, total 
      FROM orders 
      WHERE id = ?
    `, [orderId]);

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.payment_status === 'PAID') {
      return { success: true, message: 'Order is already marked as PAID.' };
    }

    await db.transaction(async (tx) => {
      await tx.execute({
        sql: `
          UPDATE payments 
          SET status = 'PAID',
              verified_by = ?,
              verified_at = CURRENT_TIMESTAMP,
              transaction_reference = COALESCE(?, transaction_reference),
              updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `,
        args: [verifiedByAdminId, customTransactionReference?.trim() || null, orderId]
      });

      await tx.execute({
        sql: 'UPDATE orders SET payment_status = \'PAID\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [orderId]
      });
    });

    return { success: true, message: 'UPI payment verified and marked as PAID.' };
  }

  /**
   * Admin / Staff: Confirms physical cash received at counter and marks payment PAID.
   */
  static async verifyCashPayment(orderId: number, verifiedByAdminId: number): Promise<{ success: boolean; message: string }> {
    const order = await db.get<{ id: number; payment_method: string; payment_status: string; total: number }>(`
      SELECT id, payment_method, payment_status, total 
      FROM orders 
      WHERE id = ?
    `, [orderId]);

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.payment_status === 'PAID') {
      return { success: true, message: 'Order is already marked as PAID.' };
    }

    await db.transaction(async (tx) => {
      await tx.execute({
        sql: `
          UPDATE payments 
          SET status = 'PAID',
              verified_by = ?,
              verified_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP 
          WHERE order_id = ?
        `,
        args: [verifiedByAdminId, orderId]
      });

      await tx.execute({
        sql: 'UPDATE orders SET payment_status = \'PAID\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [orderId]
      });
    });

    return { success: true, message: 'Cash payment confirmed and marked as PAID.' };
  }

  /**
   * Admin: List all payment records with filters.
   */
  static async getAdminPayments(filters?: {
    status?: PaymentStatus;
    method?: string;
  }): Promise<PaymentRecord[]> {
    let sql = `
      SELECT 
        p.id,
        p.order_id,
        o.public_order_number,
        p.method,
        p.amount,
        p.status,
        p.transaction_reference,
        p.verified_by,
        p.verified_at,
        u.email as verifier_email,
        p.created_at,
        p.updated_at
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN admin_users u ON u.id = p.verified_by
      WHERE 1=1
    `;

    const params: string[] = [];

    if (filters?.status) {
      sql += ' AND p.status = ?';
      params.push(filters.status);
    }

    if (filters?.method) {
      sql += ' AND p.method = ?';
      params.push(filters.method);
    }

    sql += ' ORDER BY p.id DESC';

    return await db.all<PaymentRecord>(sql, params);
  }
}
