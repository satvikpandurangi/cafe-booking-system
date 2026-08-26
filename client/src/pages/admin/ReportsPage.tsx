import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ReportData } from '../../../shared/types';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Banknote,
  ShoppingBag,
  Award,
  Calendar,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days'>('all');

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = '';
      if (dateRange === '7days') {
        const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        query = `?startDate=${d}`;
      } else if (dateRange === '30days') {
        const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        query = `?startDate=${d}`;
      }

      const res = await api.get<{ report: ReportData }>(`/admin/reports${query}`);
      setReport(res.report);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  if (loading || !report) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-cafe-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-white rounded-3xl border border-cafe-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const totalRev = report.total_revenue;
  const upiPercent = totalRev > 0 ? ((report.upi_revenue / totalRev) * 100).toFixed(1) : '0';
  const cashPercent = totalRev > 0 ? ((report.cash_revenue / totalRev) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Date Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-950">Analytics & Sales Reports</h1>
          <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
            Detailed performance breakdown, AOV, top dishes and payment distributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-cafe-200 rounded-xl p-1 text-xs font-semibold shadow-xs">
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateRange === 'all' ? 'bg-cafe-800 text-white' : 'text-cafe-700 hover:bg-cafe-50'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateRange === '7days' ? 'bg-cafe-800 text-white' : 'text-cafe-700 hover:bg-cafe-50'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateRange('30days')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                dateRange === '30days' ? 'bg-cafe-800 text-white' : 'text-cafe-700 hover:bg-cafe-50'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          <button
            onClick={fetchReports}
            className="p-2 bg-white border border-cafe-200 rounded-xl text-cafe-700 hover:bg-cafe-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cafe-500">Gross Sales Revenue</p>
            <p className="text-2xl sm:text-3xl font-bold text-cafe-950 mt-1">₹{report.total_revenue.toFixed(2)}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">Settled & verified payments</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cafe-500">Total Orders Placed</p>
            <p className="text-2xl sm:text-3xl font-bold text-cafe-950 mt-1">{report.total_orders}</p>
            <p className="text-[11px] text-cafe-500 font-medium mt-1">Dine-in orders completed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cafe-500">Average Order Value (AOV)</p>
            <p className="text-2xl sm:text-3xl font-bold text-cafe-950 mt-1">₹{report.average_order_value.toFixed(2)}</p>
            <p className="text-[11px] text-blue-700 font-medium mt-1">Per dining table ticket</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Payment Method Distribution */}
      <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
        <h2 className="text-base font-serif font-bold text-cafe-950">Payment Channels Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-cafe-50 rounded-2xl border border-cafe-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cafe-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-cafe-700" /> UPI Digital Payments
              </span>
              <span className="text-xs font-bold text-cafe-800">{upiPercent}%</span>
            </div>
            <p className="text-lg font-bold text-cafe-950">₹{report.upi_revenue.toFixed(2)}</p>
            <div className="w-full bg-cafe-200 h-2 rounded-full overflow-hidden">
              <div className="bg-cafe-800 h-full rounded-full" style={{ width: `${upiPercent}%` }} />
            </div>
          </div>

          <div className="p-4 bg-cafe-50 rounded-2xl border border-cafe-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cafe-900 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-amber-700" /> Cash at Counter
              </span>
              <span className="text-xs font-bold text-cafe-800">{cashPercent}%</span>
            </div>
            <p className="text-lg font-bold text-cafe-950">₹{report.cash_revenue.toFixed(2)}</p>
            <div className="w-full bg-cafe-200 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full" style={{ width: `${cashPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Dishes Leaderboard */}
      <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cafe-100">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-serif font-bold text-cafe-950">Top Selling Dishes</h2>
          </div>
          <span className="text-xs text-cafe-500">By total volume sold</span>
        </div>

        {report.top_dishes.length === 0 ? (
          <p className="text-xs text-cafe-500 py-4 text-center">No dishes sold yet in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-cafe-500 uppercase tracking-wider font-semibold border-b border-cafe-100">
                  <th className="pb-3 pl-2">Rank</th>
                  <th className="pb-3">Dish Name</th>
                  <th className="pb-3">Quantity Sold</th>
                  <th className="pb-3 pr-2 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-50">
                {report.top_dishes.map((dish, i) => (
                  <tr key={i} className="hover:bg-cafe-50/50 transition-colors">
                    <td className="py-3 pl-2">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                        i === 0 ? 'bg-amber-400 text-cafe-950' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-amber-700 text-white' : 'bg-cafe-100 text-cafe-700'
                      }`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-cafe-950">{dish.name}</td>
                    <td className="py-3 font-bold text-cafe-800">{dish.quantity_sold} portions</td>
                    <td className="py-3 pr-2 text-right font-bold text-cafe-900">₹{dish.total_revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Trend Table */}
      {report.daily_trends.length > 0 && (
        <div className="p-6 bg-white rounded-3xl border border-cafe-200 shadow-soft space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-cafe-100">
            <Calendar className="w-5 h-5 text-cafe-700" />
            <h2 className="text-base font-serif font-bold text-cafe-950">Daily Sales Trends</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-cafe-500 uppercase tracking-wider font-semibold border-b border-cafe-100">
                  <th className="pb-3 pl-2">Date</th>
                  <th className="pb-3">Orders Count</th>
                  <th className="pb-3 pr-2 text-right">Daily Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-50">
                {report.daily_trends.map((t, i) => (
                  <tr key={i} className="hover:bg-cafe-50/50 transition-colors">
                    <td className="py-2.5 pl-2 font-mono text-cafe-800">{t.date}</td>
                    <td className="py-2.5 font-bold text-cafe-900">{t.orders_count} orders</td>
                    <td className="py-2.5 pr-2 text-right font-bold text-cafe-950">₹{t.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
