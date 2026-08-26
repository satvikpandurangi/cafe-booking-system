import { db } from '../db/database';
import { DashboardStats, ReportData } from '../../shared/types';

export class AdminService {
  /**
   * Get Live Dashboard statistics and counters.
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const todayOrders = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE date(created_at) = date('now')
    `);

    const pendingOrders = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE order_status = 'PENDING'
    `);

    const preparingOrders = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE order_status IN ('ACCEPTED', 'PREPARING')
    `);

    const completedOrders = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE order_status = 'COMPLETED' AND date(created_at) = date('now')
    `);

    const todaySales = await db.get<{ total: number }>(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM orders 
      WHERE payment_status = 'PAID' AND date(created_at) = date('now')
    `);

    const pendingPayments = await db.get<{ total: number }>(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM orders 
      WHERE payment_status = 'PENDING' AND order_status != 'CANCELLED'
    `);

    const activeTables = await db.get<{ count: number }>(`
      SELECT COUNT(*) as count 
      FROM tables 
      WHERE status NOT IN ('AVAILABLE', 'INACTIVE')
    `);

    return {
      today_orders_count: Number(todayOrders?.count ?? 0),
      pending_orders_count: Number(pendingOrders?.count ?? 0),
      preparing_orders_count: Number(preparingOrders?.count ?? 0),
      completed_orders_count: Number(completedOrders?.count ?? 0),
      today_sales_total: Number(Number(todaySales?.total ?? 0).toFixed(2)),
      pending_payments_total: Number(Number(pendingPayments?.total ?? 0).toFixed(2)),
      active_tables_count: Number(activeTables?.count ?? 0)
    };
  }

  /**
   * Get comprehensive sales & performance reporting analytics.
   */
  static async getReports(startDate?: string, endDate?: string): Promise<ReportData> {
    let dateFilter = '';
    const params: string[] = [];

    if (startDate && endDate) {
      dateFilter = ' AND date(created_at) >= date(?) AND date(created_at) <= date(?)';
      params.push(startDate, endDate);
    } else if (startDate) {
      dateFilter = ' AND date(created_at) >= date(?)';
      params.push(startDate);
    }

    // Totals & AOV
    const summary = await db.get<{
      total_orders: number;
      total_revenue: number;
      upi_revenue: number;
      cash_revenue: number;
      pending_payments_count: number;
    }>(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND payment_method = 'UPI' THEN total ELSE 0 END), 0) as upi_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND payment_method = 'CASH' THEN total ELSE 0 END), 0) as cash_revenue,
        COUNT(CASE WHEN payment_status = 'PENDING' AND order_status != 'CANCELLED' THEN 1 END) as pending_payments_count
      FROM orders
      WHERE 1=1 ${dateFilter}
    `, params);

    const totalOrders = Number(summary?.total_orders ?? 0);
    const totalRevenue = Number(summary?.total_revenue ?? 0);
    const avgOrderVal = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

    // Top Selling Dishes
    const topDishes = await db.all<{ name: string; quantity_sold: number; total_revenue: number }>(`
      SELECT 
        oi.item_name_snapshot as name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_status != 'CANCELLED' ${dateFilter}
      GROUP BY oi.item_name_snapshot
      ORDER BY quantity_sold DESC
      LIMIT 10
    `, params);

    // Daily Trends (last 14 days or filtered)
    const dailyTrends = await db.all<{ date: string; orders_count: number; revenue: number }>(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as orders_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total ELSE 0 END), 0) as revenue
      FROM orders
      WHERE 1=1 ${dateFilter}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
      LIMIT 30
    `, params);

    return {
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_orders: totalOrders,
      average_order_value: avgOrderVal,
      upi_revenue: Number(Number(summary?.upi_revenue ?? 0).toFixed(2)),
      cash_revenue: Number(Number(summary?.cash_revenue ?? 0).toFixed(2)),
      pending_payments_count: Number(summary?.pending_payments_count ?? 0),
      top_dishes: topDishes.map(d => ({
        name: d.name,
        quantity_sold: Number(d.quantity_sold),
        total_revenue: Number(Number(d.total_revenue).toFixed(2))
      })),
      daily_trends: dailyTrends.map(t => ({
        date: t.date,
        orders_count: Number(t.orders_count),
        revenue: Number(Number(t.revenue).toFixed(2))
      }))
    };
  }

  /**
   * Get Customer list with order statistics.
   */
  static async getCustomerList(search?: string) {
    let sql = `
      SELECT 
        u.id,
        u.phone,
        u.created_at,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total ELSE 0 END), 0) as total_spent,
        MAX(o.created_at) as last_order_at
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      WHERE 1=1
    `;

    const params: string[] = [];
    if (search && search.trim()) {
      sql += ' AND u.phone LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    sql += ' GROUP BY u.id ORDER BY total_orders DESC, u.id DESC';

    return await db.all(sql, params);
  }
}
