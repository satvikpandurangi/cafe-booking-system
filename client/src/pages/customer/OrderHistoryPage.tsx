import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { CustomerOrderView } from '../../../shared/types';
import { useAuth } from '../../context/AuthContext';
import { useTable } from '../../context/TableContext';
import { Clock, ArrowLeft, ArrowRight, ShoppingBag, CheckCircle2, ChevronRight, AlertCircle, LogOut } from 'lucide-react';

export const OrderHistoryPage: React.FC = () => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const { hasTableSession } = useTable();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<CustomerOrderView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get<{ orders: CustomerOrderView[] }>('/orders');
        setOrders(res.orders);
      } catch (err) {
        console.error('Failed to load order history:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-espresso-800 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cafe-200 px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/menu')}
            className="flex items-center gap-1 text-xs font-semibold text-cafe-800 hover:text-cafe-950 p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu</span>
          </button>
          <h1 className="text-sm font-serif font-bold text-cafe-900">My Orders & Profile</h1>
          {isAuthenticated ? (
            <button
              onClick={async () => {
                await logout();
                navigate('/menu');
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          ) : (
            <button
              onClick={openAuthModal}
              className="text-xs font-semibold text-cafe-800 underline"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Profile Card */}
        {isAuthenticated && user && (
          <div className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
            <div>
              <p className="text-xs text-cafe-500 font-semibold uppercase tracking-wider">Logged In As</p>
              <p className="text-base font-bold text-cafe-950 font-mono mt-0.5">{user.phone}</p>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Customer Session Active
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cafe-100 border border-cafe-200 flex items-center justify-center text-cafe-800 font-bold font-serif text-lg">
              {user.phone.slice(-2)}
            </div>
          </div>
        )}

        {/* Orders List */}
        {!isAuthenticated ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-cafe-100 flex items-center justify-center text-cafe-600">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-serif font-bold text-cafe-900">Please Login to View Orders</h2>
            <p className="text-xs text-cafe-600 max-w-xs mx-auto">
              Enter your phone number and OTP to view your active and past dining orders.
            </p>
            <button
              onClick={openAuthModal}
              className="py-3 px-6 bg-cafe-800 text-white text-xs font-bold rounded-2xl shadow hover:bg-cafe-900 transition-all"
            >
              Login with Mobile OTP
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-3xl border border-cafe-200 animate-pulse p-4" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-cafe-100 flex items-center justify-center text-cafe-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-serif font-bold text-cafe-900">No Past Orders Found</h2>
            <p className="text-xs text-cafe-600 max-w-xs mx-auto">
              You haven&apos;t placed any orders yet. Scan your table QR and start ordering!
            </p>
            <button
              onClick={() => navigate('/menu')}
              className="py-3 px-6 bg-cafe-800 text-white text-xs font-bold rounded-2xl shadow hover:bg-cafe-900"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-serif font-bold text-cafe-950 uppercase tracking-wider">
              Order History ({orders.length})
            </h2>

            {orders.map(order => (
              <div
                key={order.public_order_number}
                onClick={() => navigate(`/orders/${order.public_order_number}`)}
                className="p-5 bg-white rounded-3xl border border-cafe-200/80 shadow-soft hover:shadow-card hover:border-cafe-300 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-cafe-950">
                      {order.public_order_number}
                    </span>
                    <span className="text-[11px] text-cafe-500 font-medium">
                      • {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                      order.order_status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order.order_status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800 animate-pulse'
                    }`}
                  >
                    {order.order_status}
                  </span>
                </div>

                <div className="text-xs text-cafe-700 divide-y divide-cafe-50">
                  {order.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="py-1 flex justify-between">
                      <span>{item.quantity}x {item.item_name_snapshot}</span>
                      <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="pt-1 text-[11px] text-cafe-500 italic">
                      + {order.items.length - 3} more items...
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-cafe-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-cafe-500 font-medium">Total: </span>
                    <span className="font-bold text-cafe-900 text-sm">₹{order.total.toFixed(2)}</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 bg-cafe-100 text-cafe-700 rounded-md font-semibold">
                      {order.payment_method} • {order.payment_status}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-cafe-800 flex items-center gap-0.5 hover:underline">
                    Track / View <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};
