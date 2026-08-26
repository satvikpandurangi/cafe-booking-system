import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Users, Search, Phone, Calendar, ShoppingBag, CreditCard, ArrowRight } from 'lucide-react';

interface CustomerRecord {
  id: number;
  phone: string;
  created_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
}

export const CustomerLookupPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const endpoint = searchQuery.trim() ? `/admin/customers?search=${encodeURIComponent(searchQuery.trim())}` : '/admin/customers';
      const res = await api.get<{ customers: CustomerRecord[] }>(endpoint);
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-cafe-950">Customer Directory & Insights</h1>
        <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
          Lookup customer order histories, lifetime dining spend, and contact records.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search customer by mobile number (e.g. 98765)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-cafe-200 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-cafe-600 placeholder:text-cafe-400 shadow-sm"
        />
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-cafe-400 pointer-events-none" />
      </div>

      {/* Grid of customer records */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white rounded-3xl border border-cafe-200 animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-cafe-200 shadow-soft">
          <Users className="w-10 h-10 text-cafe-300 mx-auto mb-2" />
          <h3 className="text-base font-serif font-bold text-cafe-900">No customer records found</h3>
          <p className="text-xs text-cafe-500 mt-1">Try another phone number query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(customer => (
            <div
              key={customer.id}
              className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft hover:shadow-card transition-all space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cafe-100 border border-cafe-200 flex items-center justify-center text-cafe-800 font-bold font-mono text-sm shadow-inner">
                    {customer.phone.slice(-4)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-cafe-950 font-mono">{customer.phone}</h3>
                    <p className="text-[11px] text-cafe-500">Joined {new Date(customer.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cafe-100 text-xs">
                <div className="p-2.5 bg-cafe-50 rounded-xl">
                  <p className="text-[10px] uppercase font-semibold text-cafe-500">Total Orders</p>
                  <p className="text-base font-bold text-cafe-900 mt-0.5">{customer.total_orders}</p>
                </div>
                <div className="p-2.5 bg-cafe-50 rounded-xl">
                  <p className="text-[10px] uppercase font-semibold text-cafe-500">Lifetime Spend</p>
                  <p className="text-base font-bold text-cafe-900 mt-0.5">₹{Number(customer.total_spent).toFixed(2)}</p>
                </div>
              </div>

              {customer.last_order_at && (
                <div className="text-[11px] text-cafe-500 flex items-center gap-1 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-cafe-400" />
                  <span>Last order: {new Date(customer.last_order_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
