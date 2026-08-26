import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Phone, KeyRound, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isAuthModalOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await requestOtp(phone);
    setLoading(false);

    if (res.success) {
      setStep('OTP');
      setCooldown(60);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
        setOtp(res.devOtp); // auto-fill in dev mode for convenience
      }
    } else {
      setError(res.message);
      if (res.cooldownRemaining) {
        setCooldown(res.cooldownRemaining);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await verifyOtp(phone, otp);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    } else {
      // Reset modal state
      setStep('PHONE');
      setPhone('');
      setOtp('');
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    const res = await requestOtp(phone);
    setLoading(false);
    if (res.success) {
      setCooldown(60);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
        setOtp(res.devOtp);
      }
    } else {
      setError(res.message);
      if (res.cooldownRemaining) setCooldown(res.cooldownRemaining);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 animate-scaleUp">
        {/* Header decoration */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-cafe-900 via-cafe-800 to-cafe-950 text-cafe-50">
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-2 text-cafe-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-cafe-500/30 text-cafe-200 border border-cafe-400/30 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cafe-300" /> Fast & Secure Login
            </span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-white tracking-wide">
            {step === 'PHONE' ? 'Welcome to Artisan Cafe' : 'Verify Your Mobile'}
          </h2>
          <p className="text-sm text-cafe-200/80 mt-1">
            {step === 'PHONE'
              ? 'Enter your mobile number to place orders & track your meal.'
              : `We sent a 6-digit verification code to ${phone}`}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="p-3 mb-4 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {error}
            </div>
          )}

          {devOtpHint && step === 'OTP' && (
            <div className="p-3 mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                Dev Mode OTP: <code className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono text-sm">{devOtpHint}</code>
              </span>
              <button
                type="button"
                onClick={() => setOtp(devOtpHint)}
                className="underline text-amber-900 font-semibold"
              >
                Auto-fill
              </button>
            </div>
          )}

          {step === 'PHONE' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-cafe-800 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-cafe-400 font-medium text-sm">
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-14 pr-4 py-3 bg-cafe-50 border border-cafe-200 rounded-2xl text-espresso-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-cafe-500 focus:border-transparent transition-all placeholder:text-cafe-300"
                    autoFocus
                  />
                  <Phone className="absolute right-3.5 top-3.5 w-5 h-5 text-cafe-400 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-3.5 px-4 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-md shadow-cafe-900/10 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-cafe-600">
                🔒 We protect your data. No spam, ever.
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-cafe-800 mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 text-center tracking-[0.6em] text-2xl font-bold bg-cafe-50 border border-cafe-200 rounded-2xl text-espresso-900 focus:outline-none focus:ring-2 focus:ring-cafe-500 focus:border-transparent transition-all placeholder:tracking-widest"
                    autoFocus
                  />
                  <KeyRound className="absolute right-3.5 top-3.5 w-5 h-5 text-cafe-400 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3.5 px-4 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-md shadow-cafe-900/10 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
              </button>

              <div className="flex items-center justify-between text-xs text-cafe-600 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="font-medium hover:underline text-cafe-800"
                >
                  Change number
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className="font-semibold text-cafe-700 disabled:opacity-50 hover:underline"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
