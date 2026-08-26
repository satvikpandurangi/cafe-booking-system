import React, { useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { Coffee, Lock, Mail, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { login, isAdminAuthenticated } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAdminAuthenticated) {
      navigate('/admin');
    }
  }, [isAdminAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      navigate('/admin');
    } else {
      setError(res.message);
    }
  };

  const fillDemoCredentials = (role: 'admin' | 'staff') => {
    if (role === 'admin') {
      setEmail('admin@cafe.local');
      setPassword('Admin@12345');
    } else {
      setEmail('staff@cafe.local');
      setPassword('Staff@12345');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cafe-950 via-espresso-900 to-cafe-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-cafe-700/50 overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-8 bg-gradient-to-b from-cafe-900 to-cafe-950 text-white text-center border-b border-cafe-800">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 shadow-inner">
            <Coffee className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-wide">
            Staff & Admin Portal
          </h1>
          <p className="text-xs text-cafe-300 mt-1">
            Artisan Cafe Management Console
          </p>
        </div>

        {/* Form */}
        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-cafe-800 uppercase tracking-wider mb-1.5">
                Staff Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="admin@cafe.local"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cafe-600"
                  required
                />
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-cafe-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cafe-800 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-cafe-50 border border-cafe-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cafe-600"
                  required
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-cafe-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-4 border-t border-cafe-100">
            <p className="text-[11px] font-semibold text-cafe-500 uppercase tracking-wider mb-2 text-center">
              Quick Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemoCredentials('admin')}
                className="p-2 border border-cafe-200 rounded-xl bg-cafe-50 hover:bg-cafe-100 font-semibold text-cafe-800 text-center"
              >
                Demo Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('staff')}
                className="p-2 border border-cafe-200 rounded-xl bg-cafe-50 hover:bg-cafe-100 font-semibold text-cafe-800 text-center"
              >
                Demo Staff
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-cafe-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Server-Side Role Enforcement</span>
          </div>
        </div>
      </div>
    </div>
  );
};
