import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Coffee, ShieldCheck, AlertCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [cafeName, setCafeName] = useState('Artisan Coffee & Bistro');
  const [upiId, setUpiId] = useState('artisan.cafe@okaxis');
  const [taxRate, setTaxRate] = useState(5.0);
  const [isOpen, setIsOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-cafe-950">Cafe & Billing Settings</h1>
        <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
          Configure cafe branding, GST billing rules, and digital UPI payment channels.
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Cafe settings updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Cafe Info */}
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
          <h2 className="text-base font-serif font-bold text-cafe-950 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-amber-700" />
            <span>Store Profile & Operations</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-cafe-800 mb-1">Cafe / Restaurant Name</label>
              <input
                type="text"
                value={cafeName}
                onChange={e => setCafeName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cafe-800 mb-1">Dine-In Kitchen Status</label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isOpen ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {isOpen ? '🟢 Open for Orders' : '🔴 Kitchen Closed'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Taxes & UPI Billing */}
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
          <h2 className="text-base font-serif font-bold text-cafe-950 flex items-center gap-2">
            <Settings className="w-5 h-5 text-cafe-800" />
            <span>Taxes & UPI Payment Configuration</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-cafe-800 mb-1">GST Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="28"
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                required
              />
              <p className="text-[11px] text-cafe-500 mt-1">Standard restaurant GST is 5.0%.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cafe-800 mb-1">Merchant UPI ID (VPA)</label>
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-mono font-bold text-cafe-900 focus:ring-2 focus:ring-cafe-600"
                required
              />
              <p className="text-[11px] text-cafe-500 mt-1">Directly integrated with customer QR dynamic payments.</p>
            </div>
          </div>
        </div>

        {/* Security Summary */}
        <div className="p-4 bg-cafe-50 rounded-2xl border border-cafe-200 text-xs text-cafe-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>All server price computations and table tokens remain cryptographically protected.</span>
        </div>

        <button
          type="submit"
          className="py-3.5 px-6 bg-cafe-800 hover:bg-cafe-900 text-white font-bold rounded-2xl shadow text-xs flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </form>
    </div>
  );
};
