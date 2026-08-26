import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTable } from '../../context/TableContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { CreateOrderPayload, CustomerOrderView, PaymentMethod } from '../../../shared/types';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Loader2, CreditCard, Banknote, ShieldCheck, AlertCircle } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const { items, itemCount, subtotal, tax, total, notes, setNotes, updateQuantity, removeItem, clearCart, isCartOpen, closeCart } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { hasTableSession } = useTable();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0) return;

    if (!hasTableSession) {
      setError('Please scan your table QR code before placing an order.');
      return;
    }

    if (!isAuthenticated) {
      // Prompt user to verify phone number via OTP
      openAuthModal();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateOrderPayload = {
        items: items.map(i => ({
          menu_item_id: i.menuItem.id,
          quantity: i.quantity
        })),
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        idempotency_key: `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      };

      const res = await api.post<{ message: string; order: CustomerOrderView }>('/orders', payload);

      if (res.order) {
        clearCart();
        closeCart();
        navigate(`/orders/${res.order.public_order_number}?new=true`);
      }
    } catch (err: any) {
      setError(err.data?.error || err.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-cafe-200">
          
          {/* Header */}
          <div className="p-5 bg-cafe-900 text-cafe-50 flex items-center justify-between border-b border-cafe-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 text-cafe-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-white">Your Order</h2>
                <p className="text-xs text-cafe-300">{itemCount} {itemCount === 1 ? 'item' : 'items'} selected</p>
              </div>
            </div>
            <button
              onClick={closeCart}
              className="p-2 text-cafe-300 hover:text-white rounded-full bg-white/5 hover:bg-white/15 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 mb-4 rounded-full bg-cafe-100 flex items-center justify-center text-cafe-400">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-serif font-bold text-cafe-900 mb-1">Your cart is empty</h3>
              <p className="text-sm text-cafe-600 mb-6 max-w-xs">
                Explore our artisanal coffee and gourmet dishes to add items to your table order.
              </p>
              <button
                onClick={closeCart}
                className="py-3 px-6 bg-cafe-800 hover:bg-cafe-900 text-white font-semibold rounded-2xl shadow transition-all"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              {/* Item List */}
              <div className="flex-1 overflow-y-auto p-5 divide-y divide-cafe-100">
                {items.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="py-3.5 flex items-center gap-3">
                    <img
                      src={menuItem.image_url}
                      alt={menuItem.name}
                      className="w-16 h-16 rounded-2xl object-cover bg-cafe-100 shrink-0 border border-cafe-200"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-cafe-950 truncate">
                        {menuItem.name}
                      </h4>
                      <p className="text-xs font-bold text-cafe-700 mt-0.5">
                        ₹{(menuItem.price * quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-2 bg-cafe-50 p-1 rounded-xl border border-cafe-200">
                      <button
                        onClick={() => updateQuantity(menuItem.id, quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-cafe-800 shadow-xs hover:bg-cafe-100 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center font-bold text-xs text-cafe-900">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(menuItem.id, quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-cafe-800 shadow-xs hover:bg-cafe-100 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(menuItem.id)}
                      className="p-1.5 text-cafe-400 hover:text-red-600 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Special Instructions */}
                <div className="pt-4 mt-2">
                  <label className="block text-xs font-semibold text-cafe-800 mb-1.5">
                    Cooking / Special Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. Less sugar, extra ice, serve pasta first..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-cafe-50 border border-cafe-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cafe-500 placeholder:text-cafe-400"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="pt-4 mt-2">
                  <label className="block text-xs font-semibold text-cafe-800 mb-2">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all ${
                        paymentMethod === 'UPI'
                          ? 'border-cafe-800 bg-cafe-800/5 text-cafe-950 font-bold ring-2 ring-cafe-800/20'
                          : 'border-cafe-200 bg-white text-cafe-700 hover:bg-cafe-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cafe-900">
                        <CreditCard className="w-4 h-4 text-cafe-700" /> UPI (GPay/PhonePe)
                      </div>
                      <span className="text-[10px] text-cafe-500">Fast & Contactless</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-cafe-800 bg-cafe-800/5 text-cafe-950 font-bold ring-2 ring-cafe-800/20'
                          : 'border-cafe-200 bg-white text-cafe-700 hover:bg-cafe-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cafe-900">
                        <Banknote className="w-4 h-4 text-cafe-700" /> Cash at Counter
                      </div>
                      <span className="text-[10px] text-cafe-500">Pay after meal</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer / Summary */}
              <div className="p-5 bg-cafe-50 border-t border-cafe-200 space-y-3">
                {error && (
                  <div className="p-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-cafe-700">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-cafe-900">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-cafe-900">₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-cafe-950 pt-2 border-t border-cafe-200">
                    <span>Grand Total</span>
                    <span className="text-cafe-900">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-cafe-600 justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Authoritative total verified securely on server</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="w-full py-4 px-6 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-cafe-900/15 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !isAuthenticated ? (
                    <>
                      <span>Login with Mobile to Order • ₹{total.toFixed(2)}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Place Table Order • ₹{total.toFixed(2)}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
