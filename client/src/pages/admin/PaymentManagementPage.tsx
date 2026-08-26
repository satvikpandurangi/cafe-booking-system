import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PaymentRecord, PaymentStatus } from '../../../shared/types';
import {
  CreditCard,
  Banknote,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  X
} from 'lucide-react';

export const PaymentManagementPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingOrderId, setVerifyingOrderId] = useState<number | null>(null);

  // UPI verification modal with optional UTR
  const [selectedUpiOrder, setSelectedUpiOrder] = useState<PaymentRecord | null>(null);
  const [customUtr, setCustomUtr] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let endpoint = '/admin/payments?';
      if (statusFilter !== 'ALL') endpoint += `status=${statusFilter}&`;
      if (methodFilter !== 'ALL') endpoint += `method=${methodFilter}&`;

      const res = await api.get<{ payments: PaymentRecord[] }>(endpoint);
      setPayments(res.payments);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, methodFilter]);

  const handleVerifyCashPayment = async (orderId: number) => {
    if (!window.confirm('Confirm receipt of physical cash from customer for this order?')) return;

    setVerifyingOrderId(orderId);
    try {
      await api.post(`/admin/payments/${orderId}/verify-cash`);
      await fetchPayments();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to verify cash payment');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleConfirmUpiVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUpiOrder) return;

    setVerifyingOrderId(selectedUpiOrder.order_id);
    try {
      await api.post(`/admin/payments/${selectedUpiOrder.order_id}/verify-upi`, {
        transaction_reference: customUtr.trim() || undefined
      });
      setSelectedUpiOrder(null);
      setCustomUtr('');
      await fetchPayments();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to verify UPI payment');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (p.public_order_number && p.public_order_number.toLowerCase().includes(q)) ||
        (p.transaction_reference && p.transaction_reference.toLowerCase().includes(q)) ||
        (p.verifier_email && p.verifier_email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCollected = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-950">Payment Ledger & Verification</h1>
          <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
            Audit and verify direct UPI bank transfers and counter cash collections.
          </p>
        </div>

        <button
          onClick={() => fetchPayments()}
          className="px-3.5 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-800 hover:bg-cafe-50 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Settled (PAID)</p>
            <p className="text-2xl font-bold text-cafe-950 mt-1">₹{totalCollected.toFixed(2)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Verification</p>
            <p className="text-2xl font-bold text-cafe-950 mt-1">₹{totalPending.toFixed(2)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Banknote className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by Order #, Transaction Ref, or Verifier Staff..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-cafe-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-cafe-600 placeholder:text-cafe-400"
          />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-cafe-400 pointer-events-none" />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-800"
          >
            <option value="ALL">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="h-64 bg-white rounded-3xl border border-cafe-200 animate-pulse" />
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-cafe-200 shadow-soft">
          <CreditCard className="w-10 h-10 text-cafe-300 mx-auto mb-2" />
          <h3 className="text-base font-serif font-bold text-cafe-900">No payment records found</h3>
          <p className="text-xs text-cafe-500 mt-1">Try clearing your search query or filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-cafe-200 shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-cafe-50 text-cafe-600 uppercase font-semibold tracking-wider border-b border-cafe-200">
                  <th className="py-3.5 pl-4">Order #</th>
                  <th className="py-3.5">Method</th>
                  <th className="py-3.5">Amount</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Transaction Ref / UTR</th>
                  <th className="py-3.5">Verified By</th>
                  <th className="py-3.5">Date & Time</th>
                  <th className="py-3.5 pr-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-100">
                {filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-cafe-50/50 transition-colors">
                    <td className="py-3 pl-4 font-mono font-bold text-cafe-950">
                      {payment.public_order_number || `#${payment.order_id}`}
                    </td>

                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-cafe-800">
                        {payment.method === 'UPI' ? <CreditCard className="w-3.5 h-3.5 text-cafe-600" /> : <Banknote className="w-3.5 h-3.5 text-amber-600" />}
                        {payment.method}
                      </span>
                    </td>

                    <td className="py-3 font-bold text-cafe-900 text-sm">
                      ₹{payment.amount.toFixed(2)}
                    </td>

                    <td className="py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        payment.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : payment.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>

                    <td className="py-3 font-mono text-cafe-600 text-[11px]">
                      {payment.transaction_reference || '—'}
                    </td>

                    <td className="py-3 text-cafe-600 text-[11px]">
                      {payment.verifier_email ? (
                        <span className="font-semibold text-cafe-800">{payment.verifier_email}</span>
                      ) : (
                        <span className="text-cafe-400">—</span>
                      )}
                    </td>

                    <td className="py-3 text-cafe-500 text-[11px]">
                      {new Date(payment.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 pr-4 text-right">
                      {payment.status === 'PENDING' ? (
                        payment.method === 'UPI' ? (
                          <button
                            onClick={() => {
                              setSelectedUpiOrder(payment);
                              setCustomUtr(payment.transaction_reference || '');
                            }}
                            disabled={verifyingOrderId === payment.order_id}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 ml-auto"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify UPI</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerifyCashPayment(payment.order_id)}
                            disabled={verifyingOrderId === payment.order_id}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify Cash</span>
                          </button>
                        )
                      ) : payment.status === 'PAID' ? (
                        <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified ✓
                        </span>
                      ) : (
                        <span className="text-[11px] text-cafe-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff UPI Verification Modal */}
      {selectedUpiOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-left space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <h3 className="text-base font-serif font-bold text-cafe-950">Verify Direct UPI Payment</h3>
              <button
                onClick={() => setSelectedUpiOrder(null)}
                className="p-1 text-cafe-400 hover:text-cafe-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-cafe-50 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-cafe-500">Order:</span>
                <span className="font-mono font-bold text-cafe-950">{selectedUpiOrder.public_order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cafe-500">Amount:</span>
                <span className="font-bold text-emerald-700">₹{selectedUpiOrder.amount.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmUpiVerification} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">
                  Bank UTR / Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 423984129841 or leave default"
                  value={customUtr}
                  onChange={e => setCustomUtr(e.target.value)}
                  className="w-full px-3 py-2 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-mono text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                />
                <p className="text-[11px] text-cafe-500 mt-1">
                  Confirm receipt on cafe phone/soundbox before marking as PAID.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow text-xs flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Mark as PAID</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
