import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { DashboardStats, Order } from '../../../shared/types';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  CreditCard,
  QrCode,
  ArrowRight,
  RefreshCw,
  ChefHat,
  Bell
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [dashRes, ordersRes] = await Promise.all([
        api.get<{ stats: DashboardStats }>('/admin/dashboard'),
        api.get<{ orders: Order[] }>('/admin/orders')
      ]);
      setStats(dashRes.stats);
      setRecentOrders(ordersRes.orders.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-cafe-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-cafe-200 animate-pulse p-4" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: "Today's Orders",
      value: stats.today_orders_count,
      icon: ShoppingBag,
      color: 'from-amber-500 to-amber-600',
      textColor: 'text-amber-600',
      bgLight: 'bg-amber-50'
    },
    {
      title: "Today's Sales",
      value: `₹${stats.today_sales_total.toFixed(2)}`,
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-600',
      textColor: 'text-emerald-600',
      bgLight: 'bg-emerald-50'
    },
    {
      title: 'Active / Preparing',
      value: stats.preparing_orders_count,
      icon: ChefHat,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgLight: 'bg-blue-50'
    },
    {
      title: 'Pending Payments',
      value: `₹${stats.pending_payments_total.toFixed(2)}`,
      icon: CreditCard,
      color: 'from-rose-500 to-rose-600',
      textColor: 'text-rose-600',
      bgLight: 'bg-rose-50'
    },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-cafe-950">
            Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-cafe-600 mt-1">
            Real-time live monitoring of cafe dining, orders, tables, and payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboardData()}
            className="p-2.5 bg-white border border-cafe-200 rounded-xl text-cafe-700 hover:bg-cafe-50 shadow-xs flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-4 h-4 text-cafe-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => navigate('/admin/orders')}
            className="py-2.5 px-4 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl shadow text-xs font-bold flex items-center gap-1.5"
          >
            <Bell className="w-4 h-4 text-amber-300" />
            <span>Open Live Kitchen Board</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft hover:shadow-card transition-all flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cafe-500">{kpi.title}</p>
                <p className="text-2xl font-bold text-cafe-950 mt-1">{kpi.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${kpi.bgLight} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${kpi.textColor}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/admin/orders')}
          className="p-6 bg-gradient-to-br from-cafe-900 to-cafe-950 text-white rounded-3xl shadow-md hover:shadow-xl transition-all cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
              Kitchen Workflow
            </span>
            <h3 className="text-lg font-serif font-bold text-white mt-2">Live Orders ({stats.pending_orders_count + stats.preparing_orders_count})</h3>
            <p className="text-xs text-cafe-300 mt-0.5">Accept, prepare & serve dine-in meals</p>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
        </div>

        <div
          onClick={() => navigate('/admin/tables')}
          className="p-6 bg-white border border-cafe-200 rounded-3xl shadow-soft hover:shadow-card transition-all cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-cafe-100 text-cafe-800 rounded-full">
              Table QR System
            </span>
            <h3 className="text-lg font-serif font-bold text-cafe-950 mt-2">Tables ({stats.active_tables_count} Active)</h3>
            <p className="text-xs text-cafe-600 mt-0.5">Regenerate QR tokens & table status</p>
          </div>
          <ArrowRight className="w-5 h-5 text-cafe-700 group-hover:translate-x-1 transition-transform" />
        </div>

        <div
          onClick={() => navigate('/admin/payments')}
          className="p-6 bg-white border border-cafe-200 rounded-3xl shadow-soft hover:shadow-card transition-all cursor-pointer flex items-center justify-between group"
        >
          <div>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
              Cash & UPI
            </span>
            <h3 className="text-lg font-serif font-bold text-cafe-950 mt-2">Payment Ledger</h3>
            <p className="text-xs text-cafe-600 mt-0.5">Verify cash payments at counter</p>
          </div>
          <ArrowRight className="w-5 h-5 text-cafe-700 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Recent Orders Preview */}
      <div className="bg-white rounded-3xl border border-cafe-200 shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cafe-100">
          <div>
            <h2 className="text-base font-serif font-bold text-cafe-950">Recent Customer Orders</h2>
            <p className="text-xs text-cafe-500">Live order queue</p>
          </div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="text-xs font-bold text-cafe-800 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-cafe-500">No orders placed today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-cafe-500 uppercase tracking-wider font-semibold border-b border-cafe-100">
                  <th className="pb-3 pl-2">Order #</th>
                  <th className="pb-3">Table</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Items</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3">Payment</th>
                  <th className="pb-3 pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-50">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-cafe-50/60 transition-colors">
                    <td className="py-3 pl-2 font-mono font-bold text-cafe-900">{order.public_order_number}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-cafe-100 text-cafe-800 font-bold rounded-md text-[11px]">
                        {order.internal_table_code || `T-${order.table_id}`}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-cafe-700">{order.user_phone || 'Customer'}</td>
                    <td className="py-3 text-cafe-600">{order.items?.length || 1} items</td>
                    <td className="py-3 font-bold text-cafe-900">₹{order.total.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.payment_method} • {order.payment_status}
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cafe-800 text-white">
                        {order.order_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
