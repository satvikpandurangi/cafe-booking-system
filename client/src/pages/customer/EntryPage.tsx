import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTable } from '../../context/TableContext';
import { Coffee, QrCode, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

export const EntryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyTableToken, hasTableSession, tableVerifiedMessage } = useTable();

  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read ?token= from URL on load
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      handleVerify(tokenParam);
    }
  }, [searchParams]);

  const handleVerify = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setError('Please enter or scan a table QR code token.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    const res = await verifyTableToken(tokenToVerify.trim());
    setLoading(false);

    if (res.success) {
      setStatusMessage('Table verified successfully! Redirecting to menu...');
      setTimeout(() => {
        navigate('/menu');
      }, 1200);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cafe-100 via-cafe-50 to-[#fdfbf7] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-cafe-200 overflow-hidden text-center">
        {/* Header Hero */}
        <div className="relative p-8 bg-gradient-to-br from-cafe-900 via-cafe-800 to-cafe-950 text-cafe-50 overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-cafe-500/10 blur-2xl pointer-events-none" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-cafe-300 shadow-inner">
            <Coffee className="w-8 h-8 text-amber-200" />
          </div>
          <span className="px-3 py-1 text-xs font-semibold bg-cafe-500/20 text-cafe-200 border border-cafe-400/20 rounded-full inline-flex items-center gap-1 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Table Dining & Ordering
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
            Artisan Coffee & Bistro
          </h1>
          <p className="text-sm text-cafe-200/80 mt-1 max-w-xs mx-auto">
            Scan your table QR code to view the live menu, place orders, and pay seamlessly.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {statusMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-medium flex items-center gap-2 text-left animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasTableSession && !statusMessage && (
            <div className="p-4 bg-cafe-50 border border-cafe-200 rounded-2xl text-cafe-800 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-bold text-xs text-emerald-800">Active Table Session</p>
                  <p className="text-[11px] text-cafe-600">{tableVerifiedMessage || 'Table verified'}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/menu')}
                className="px-3.5 py-1.5 bg-cafe-800 text-white text-xs font-semibold rounded-xl hover:bg-cafe-900 transition-all flex items-center gap-1"
              >
                Go to Menu <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Token verification input */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleVerify(tokenInput);
            }}
            className="space-y-4 text-left"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-cafe-800 mb-1.5">
                Table QR Entry Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste or enter opaque table token"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  className="w-full px-4 py-3 bg-cafe-50 border border-cafe-200 rounded-2xl text-xs sm:text-sm font-mono text-espresso-900 focus:outline-none focus:ring-2 focus:ring-cafe-500 focus:border-transparent transition-all placeholder:text-cafe-400 placeholder:font-sans"
                />
                <QrCode className="absolute right-3.5 top-3.5 w-5 h-5 text-cafe-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3.5 px-4 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-cafe-900/10 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Verify Table & Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Assurance Card */}
          <div className="p-4 bg-cafe-50/60 rounded-2xl border border-cafe-100 text-left space-y-1.5 text-xs text-cafe-700">
            <div className="flex items-center gap-1.5 font-semibold text-cafe-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Zero ID Exposure Guarantee</span>
            </div>
            <p className="text-[11px] text-cafe-600 leading-relaxed">
              Our system uses 256-bit cryptographic opaque tokens. Internal database table identifiers and other customers&apos; dining information are never exposed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
