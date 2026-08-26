import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { Order, OrderStatus } from '../../../shared/types';
import {
  Bell,
  Search,
  CheckCircle2,
  ChefHat,
  Utensils,
  Sparkles,
  Clock,
  XCircle,
  RefreshCw,
  AlertCircle,
  Phone,
  CreditCard,
  Banknote,
  Volume2,
  ShieldCheck
} from 'lucide-react';

const STATUS_FILTERS: Array<{ key: OrderStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
  { key: 'SERVED', label: 'Served' },
  { key: 'COMPLETED', label: 'Completed' },
];

export const LiveOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [verifyingPaymentOrderId, setVerifyingPaymentOrderId] = useState<number | null>(null);

  const prevOrderCountRef = useRef<number>(0);

  const fetchOrders = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await api.get<{ orders: Order[] }>('/admin/orders');
      setOrders(res.orders);

      // Trigger web audio chime if new order arrived
      if (!initial && res.orders.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
        playNotificationBeep();
      }
      prevOrderCountRef.current = res.orders.length;
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (initial) setLoading(false);
    }
  };

  const playNotificationBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 3500);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: number, nextStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: nextStatus });
      await fetchOrders(false);
    } catch (err: any) {
      alert(err.data?.error || err.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleVerifyPayment = async (order: Order) => {
    const isUpi = order.payment_method === 'UPI';
    const confirmMsg = isUpi
      ? `Confirm receipt of ₹${order.total.toFixed(2)} via UPI for ${order.public_order_number}?`
      : `Confirm receipt of ₹${order.total.toFixed(2)} CASH at counter for ${order.public_order_number}?`;

    if (!window.confirm(confirmMsg)) return;

    setVerifyingPaymentOrderId(order.id);
    try {
      const endpoint = isUpi
        ? `/admin/payments/${order.id}/verify-upi`
        : `/admin/payments/${order.id}/verify-cash`;

      await api.post(endpoint, {});
      await fetchOrders(false);
    } catch (err: any) {
      alert(err.data?.error || err.message || 'Failed to verify payment.');
    } finally {
      setVerifyingPaymentOrderId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (selectedStatus !== 'ALL' && order.order_status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        order.public_order_number.toLowerCase().includes(q) ||
        (order.user_phone && order.user_phone.toLowerCase().includes(q)) ||
        (order.internal_table_code && order.internal_table_code.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusCount = (status: OrderStatus) => {
    return orders.filter(o => o.order_status === status).length;
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-2xl font-serif font-bold text-cafe-950">Live Kitchen & Table Orders</h1>
          </div>
          <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
            Real-time incoming orders with table binding and staff payment verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders(false)}
            className="px-3.5 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-700 hover:bg-cafe-50 shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Orders</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          {STATUS_FILTERS.map(f => {
            const count = f.key === 'ALL' ? orders.length : getStatusCount(f.key as OrderStatus);
            return (
              <button
                key={f.key}
                onClick={() => setSelectedStatus(f.key)}
                className={`px-4 py-2 rounded-2xl whitespace-nowrap transition-all shadow-xs flex items-center gap-1.5 ${
                  selectedStatus === f.key
                    ? 'bg-cafe-800 text-white shadow-md'
                    : 'bg-white text-cafe-700 border border-cafe-200 hover:bg-cafe-50'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedStatus === f.key ? 'bg-amber-400 text-cafe-950' : 'bg-cafe-100 text-cafe-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by Order # (e.g. ORD-582914), Customer Phone, or Table (e.g. T-01)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-cafe-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cafe-600 placeholder:text-cafe-400"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-cafe-400 pointer-events-none" />
        </div>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-white rounded-3xl border border-cafe-200 animate-pulse p-4" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-cafe-200 shadow-soft">
          <Bell className="w-10 h-10 text-cafe-300 mx-auto mb-2" />
          <h3 className="text-base font-serif font-bold text-cafe-900">No matching orders</h3>
          <p className="text-xs text-cafe-500 mt-1">There are currently no orders under this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map(order => {
            const isUpdating = updatingOrderId === order.id;
            const isVerifying = verifyingPaymentOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-cafe-200/90 shadow-soft hover:shadow-card transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 bg-cafe-50 border-b border-cafe-100 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-cafe-950">
                        {order.public_order_number}
                      </span>
                      <span className="px-2.5 py-0.5 bg-cafe-800 text-white font-mono font-bold text-xs rounded-lg shadow-xs">
                        {order.internal_table_code || `Table ${order.table_id}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-cafe-600 mt-1">
                      <Phone className="w-3 h-3 text-cafe-400" />
                      <span>{order.user_phone || 'Customer'}</span>
                      <span>•</span>
                      <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border ${
                    order.order_status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : order.order_status === 'CANCELLED'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                  }`}>
                    {order.order_status}
                  </span>
                </div>

                {/* Items Body */}
                <div className="p-4 flex-1 space-y-3">
                  <div className="divide-y divide-cafe-50 text-xs">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cafe-900 bg-cafe-100 px-1.5 py-0.5 rounded text-[11px]">
                            {item.quantity}x
                          </span>
                          <span className="font-medium text-cafe-950">{item.item_name_snapshot}</span>
                        </div>
                        <span className="font-semibold text-cafe-800">₹{item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900">
                      <span className="font-bold">Instructions: </span>
                      {order.notes}
                    </div>
                  )}

                  {/* Price Summary & Payment State */}
                  <div className="pt-2 border-t border-cafe-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-cafe-500 font-medium">Total: </span>
                      <span className="font-bold text-cafe-950 text-sm">₹{order.total.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                        order.payment_status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.payment_method === 'UPI' ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                        {order.payment_method} • {order.payment_status}
                      </span>
                    </div>
                  </div>

                  {/* Verification Action if Payment is PENDING */}
                  {order.payment_status === 'PENDING' && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleVerifyPayment(order)}
                        disabled={isVerifying}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{order.payment_method === 'UPI' ? 'Verify UPI Payment' : 'Verify Cash Payment'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Kitchen Status Action Buttons */}
                <div className="p-3 bg-cafe-50 border-t border-cafe-100 flex flex-wrap gap-2">
                  {order.order_status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'ACCEPTED')}
                        disabled={isUpdating}
                        className="flex-1 py-2 px-3 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" /> Accept Order
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                        disabled={isUpdating}
                        className="py-2 px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.order_status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                      disabled={isUpdating}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                    >
                      <ChefHat className="w-3.5 h-3.5" /> Start Preparing
                    </button>
                  )}

                  {order.order_status === 'PREPARING' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'READY')}
                      disabled={isUpdating}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                    >
                      <Bell className="w-3.5 h-3.5" /> Mark Ready for Service
                    </button>
                  )}

                  {order.order_status === 'READY' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'SERVED')}
                      disabled={isUpdating}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                    >
                      <Utensils className="w-3.5 h-3.5" /> Mark Served at Table
                    </button>
                  )}

                  {order.order_status === 'SERVED' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                      disabled={isUpdating}
                      className="w-full py-2 px-3 bg-cafe-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Complete Order
                    </button>
                  )}

                  {order.order_status === 'COMPLETED' && (
                    <div className="w-full text-center text-[11px] font-semibold text-emerald-700 py-1 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Order Completed & Closed
                    </div>
                  )}

                  {order.order_status === 'CANCELLED' && (
                    <div className="w-full text-center text-[11px] font-semibold text-red-600 py-1 flex items-center justify-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Order Cancelled
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
