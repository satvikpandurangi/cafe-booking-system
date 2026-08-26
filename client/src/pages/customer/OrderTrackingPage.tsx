import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { CustomerOrderView, OrderStatus } from '../../../shared/types';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Bell,
  Utensils,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  CreditCard,
  Banknote,
  AlertCircle,
  ShieldCheck,
  QrCode as QrIcon,
  ExternalLink,
  Hourglass
} from 'lucide-react';

const STATUS_STEPS: Array<{ key: OrderStatus; label: string; desc: string; icon: any }> = [
  { key: 'PENDING', label: 'Order Placed', desc: 'Sent to cafe kitchen', icon: Clock },
  { key: 'ACCEPTED', label: 'Accepted', desc: 'Kitchen confirmed order', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'Preparing', desc: 'Chef is crafting your meal', icon: ChefHat },
  { key: 'READY', label: 'Ready', desc: 'Being plated for service', icon: Bell },
  { key: 'SERVED', label: 'Served', desc: 'Enjoy your meal!', icon: Utensils },
  { key: 'COMPLETED', label: 'Completed', desc: 'Thank you for dining!', icon: Sparkles }
];

export const OrderTrackingPage: React.FC = () => {
  const { publicOrderNumber } = useParams<{ publicOrderNumber: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<CustomerOrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // UPI Payment flow state
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiDetails, setUpiDetails] = useState<{
    upiUrl?: string;
    qrDataUrl?: string;
    amount?: number;
    upiId?: string;
    cafeName?: string;
    transactionReference?: string;
  } | null>(null);
  const [upiSubmittedForVerification, setUpiSubmittedForVerification] = useState(false);

  // Confetti on initial order placement
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [searchParams]);

  // Fetch & poll order status
  const fetchOrder = async (isInitial = false) => {
    if (!publicOrderNumber) return;
    if (isInitial) setLoading(true);

    try {
      const res = await api.get<{ order: CustomerOrderView }>(`/orders/${publicOrderNumber}`);
      
      // Trigger confetti if order transitioned to PAID during polling
      if (order && order.payment_status === 'PENDING' && res.order.payment_status === 'PAID') {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      }

      setOrder(res.order);
      setError(null);
    } catch (err: any) {
      setError(err.data?.error || err.message || 'Unable to fetch order details.');
      setIsPolling(false);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder(true);
    const interval = setInterval(() => {
      if (isPolling) {
        fetchOrder(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [publicOrderNumber, isPolling, order?.payment_status]);

  // Load UPI Payment Details (Authoritative Server Pricing)
  const handleOpenUpiModal = async () => {
    if (!publicOrderNumber) return;
    try {
      const res = await api.get<{
        upiUrl: string;
        qrDataUrl: string;
        amount: number;
        upiId: string;
        cafeName: string;
        transactionReference: string;
      }>(`/payments/${publicOrderNumber}/upi`);

      setUpiDetails(res);
      setShowUpiModal(true);
    } catch (err: any) {
      alert(err.data?.error || 'Failed to generate UPI payment.');
    }
  };

  const handleConfirmUpiAppPayment = () => {
    setShowUpiModal(false);
    setUpiSubmittedForVerification(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cafe-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-cafe-200 border border-cafe-300 flex items-center justify-center animate-pulse">
            <Clock className="w-6 h-6 text-cafe-800 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-cafe-800">Loading live order tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-cafe-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-xl border border-cafe-200 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-serif font-bold text-cafe-900">Order Not Found</h2>
          <p className="text-xs text-cafe-600">{error || 'You do not have permission to view this order.'}</p>
          <button
            onClick={() => navigate('/menu')}
            className="w-full py-3 bg-cafe-800 text-white rounded-xl text-xs font-semibold hover:bg-cafe-900"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order.order_status);

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-espresso-800 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cafe-200 px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/menu')}
            className="flex items-center gap-1 text-xs font-semibold text-cafe-800 hover:text-cafe-950 p-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu</span>
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-cafe-500">Live Dine-In Tracker</p>
            <p className="text-xs font-mono font-bold text-cafe-900">{order.public_order_number}</p>
          </div>
          <button
            onClick={() => fetchOrder(false)}
            className="p-1.5 text-cafe-600 hover:text-cafe-900 rounded-lg hover:bg-cafe-100"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Order Status Banner */}
        <div className="p-6 bg-gradient-to-br from-cafe-900 via-cafe-800 to-cafe-950 text-white rounded-3xl shadow-xl border border-cafe-700 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-amber-200 border border-white/10 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Order #{order.public_order_number}
            </span>

            {/* Payment badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              order.payment_status === 'PAID'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
            }`}>
              {order.payment_status === 'PAID' ? 'Payment Confirmed ✓' : `${order.payment_method} • Payment Pending`}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1">
            {order.order_status === 'PENDING' && 'Order Received ⏳'}
            {order.order_status === 'ACCEPTED' && 'Kitchen Confirmed 👍'}
            {order.order_status === 'PREPARING' && 'Chef is Cooking 🍳'}
            {order.order_status === 'READY' && 'Plated & Ready 🔔'}
            {order.order_status === 'SERVED' && 'Served at Your Table 🍽️'}
            {order.order_status === 'COMPLETED' && 'Meal Completed ✨'}
            {order.order_status === 'CANCELLED' && 'Order Cancelled ❌'}
          </h2>
          <p className="text-xs text-cafe-200/80 max-w-md">
            {order.order_status === 'COMPLETED'
              ? 'We hope you enjoyed dining with us! Have a wonderful day.'
              : 'Our barista and chef are working on your order. Status updates automatically in real-time.'}
          </p>

          {/* Payment action prompt if PENDING */}
          {order.payment_status === 'PENDING' && (
            <div className="mt-4 pt-4 border-t border-white/15 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-cafe-200">
                  <span>Authoritative Total: </span>
                  <span className="text-base font-bold text-white">₹{order.total.toFixed(2)}</span>
                </div>

                {order.payment_method === 'UPI' && (
                  <button
                    onClick={handleOpenUpiModal}
                    className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-cafe-950 font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay ₹{order.total.toFixed(2)} via UPI</span>
                  </button>
                )}

                {order.payment_method === 'CASH' && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-200 font-semibold bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                    <Banknote className="w-4 h-4" />
                    <span>Pay cash at counter • Staff will confirm payment</span>
                  </div>
                )}
              </div>

              {/* UPI Verification Pending Notice */}
              {order.payment_method === 'UPI' && (upiSubmittedForVerification || searchParams.get('new') === 'true') && (
                <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl text-xs text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Hourglass className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Payment submitted for verification</span>
                  </div>
                  <p className="text-[11px] text-cafe-300 leading-relaxed">
                    Your order has been placed. The cafe staff will verify the UPI transfer on the cafe terminal shortly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Confirmed Banner */}
          {order.payment_status === 'PAID' && (
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center gap-2 text-xs text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Payment Confirmed ✓ (Verified by Cafe Staff)</span>
            </div>
          )}
        </div>

        {/* Live Timeline Step Bar */}
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-6">
          <h3 className="text-sm font-serif font-bold text-cafe-950 uppercase tracking-wider">
            Preparation Timeline
          </h3>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-cafe-200">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              const Icon = step.icon;

              return (
                <div key={step.key} className="relative flex items-start gap-4">
                  {/* Step Dot / Icon */}
                  <div
                    className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                      isPast
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                        : isCurrent
                        ? 'bg-cafe-800 text-amber-300 ring-4 ring-cafe-100 animate-pulse'
                        : 'bg-cafe-100 text-cafe-400'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                  </div>

                  <div className="pl-3">
                    <h4
                      className={`text-sm font-bold leading-none ${
                        isCurrent
                          ? 'text-cafe-950 font-serif text-base'
                          : isPast
                          ? 'text-cafe-800'
                          : 'text-cafe-400'
                      }`}
                    >
                      {step.label}
                    </h4>
                    <p className="text-xs text-cafe-500 mt-1">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Receipt / Items Breakdown */}
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cafe-100">
            <h3 className="text-sm font-serif font-bold text-cafe-950">Order Summary</h3>
            <span className="text-xs text-cafe-500 font-mono">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="divide-y divide-cafe-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-cafe-800 bg-cafe-100 px-2 py-0.5 rounded-md">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-cafe-950">{item.item_name_snapshot}</span>
                </div>
                <span className="font-bold text-cafe-900">₹{item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="p-3 bg-cafe-50 rounded-xl text-xs text-cafe-700">
              <span className="font-bold text-cafe-900">Special Instructions: </span>
              {order.notes}
            </div>
          )}

          {/* Pricing Totals */}
          <div className="pt-3 border-t border-cafe-200 space-y-1.5 text-xs text-cafe-700">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-cafe-900">₹{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (5%)</span>
              <span className="font-semibold text-cafe-900">₹{order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-cafe-950 pt-2 border-t border-cafe-200">
              <span>Total Amount</span>
              <span className="text-cafe-900">₹{order.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-1 text-[11px] text-cafe-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted dine-in order snapshot</span>
          </div>
        </div>

      </main>

      {/* Direct UPI Payment Intent Modal */}
      {showUpiModal && upiDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-center space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <h3 className="text-lg font-serif font-bold text-cafe-950 flex items-center gap-1.5">
                <QrIcon className="w-5 h-5 text-cafe-800" /> Pay via UPI
              </h3>
              <button
                onClick={() => setShowUpiModal(false)}
                className="text-cafe-400 hover:text-cafe-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-cafe-600">
              Complete payment in your UPI app (Google Pay, PhonePe, Paytm, BHIM)
            </div>

            {/* Dynamic Scannable UPI QR */}
            {upiDetails.qrDataUrl && (
              <div className="p-3 bg-white border border-cafe-200 rounded-2xl inline-block shadow-inner">
                <img src={upiDetails.qrDataUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
              </div>
            )}

            <div className="p-2.5 bg-cafe-50 rounded-xl text-xs space-y-0.5 text-left">
              <div className="flex justify-between">
                <span className="text-cafe-500 font-medium">Merchant VPA:</span>
                <span className="font-mono font-bold text-cafe-950">{upiDetails.upiId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cafe-500 font-medium">Order Ref:</span>
                <span className="font-mono text-cafe-700 text-[11px]">{upiDetails.transactionReference}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-cafe-200 text-sm font-bold text-cafe-950">
                <span>Exact Total:</span>
                <span>₹{upiDetails.amount?.toFixed(2)}</span>
              </div>
            </div>

            {/* Direct Deep Link Button for Mobile */}
            {upiDetails.upiUrl && (
              <a
                href={upiDetails.upiUrl}
                onClick={handleConfirmUpiAppPayment}
                className="block w-full py-3 bg-cafe-800 hover:bg-cafe-900 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center justify-center gap-1.5"
              >
                <span>Pay ₹{upiDetails.amount?.toFixed(2)} via UPI App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={handleConfirmUpiAppPayment}
              className="w-full py-2.5 bg-cafe-100 hover:bg-cafe-200 text-cafe-800 text-xs font-bold rounded-xl transition-all"
            >
              I Have Completed the Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
