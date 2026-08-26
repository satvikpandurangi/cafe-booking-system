import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { AdminTable, TableStatus } from '../../../shared/types';
import QRCode from 'qrcode';
import {
  QrCode,
  Plus,
  RefreshCw,
  Download,
  Printer,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Coffee
} from 'lucide-react';

const STATUS_COLORS: Record<TableStatus, { bg: string; text: string; border: string }> = {
  'AVAILABLE': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'OCCUPIED': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  'ORDER_PENDING': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  'PAYMENT_PENDING': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  'CLEANING': { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  'INACTIVE': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
};

export const TableManagementPage: React.FC = () => {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(true);

  // QR Modal
  const [selectedTable, setSelectedTable] = useState<AdminTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // New Table Modal
  const [newTableCode, setNewTableCode] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Print Mode
  const [printMode, setPrintMode] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ tables: AdminTable[] }>('/admin/tables');
      setTables(res.tables);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleUpdateStatus = async (tableId: number, newStatus: TableStatus) => {
    try {
      await api.patch(`/admin/tables/${tableId}`, { status: newStatus });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    } catch (err: any) {
      alert(err.data?.error || 'Failed to update table status');
    }
  };

  const handleRegenerateToken = async (table: AdminTable) => {
    const confirmRegen = window.confirm(
      `⚠️ WARNING: Regenerating the token for ${table.internal_table_code} will immediately REVOKE the current physical QR code and invalidate all active customer sessions on this table. Proceed?`
    );

    if (!confirmRegen) return;

    try {
      const res = await api.post<{ message: string; tableCode: string; rawToken: string; qrDataUrl: string }>(
        `/admin/tables/${table.id}/regenerate-token`
      );

      setSelectedTable(table);
      setRawToken(res.rawToken);
      setQrDataUrl(res.qrDataUrl);
      setQrModalOpen(true);
      await fetchTables();
    } catch (err: any) {
      alert(err.data?.error || 'Failed to regenerate token');
    }
  };

  const handlePreviewQr = async (table: AdminTable) => {
    // Generate QR using current entry format
    // Since hash is stored, regenerating gives a new active QR, or we can prompt to regenerate
    handleRegenerateToken(table);
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableCode.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; table: AdminTable; rawToken: string; qrDataUrl: string }>(
        '/admin/tables',
        { internal_table_code: newTableCode.trim().toUpperCase() }
      );

      setAddModalOpen(false);
      setNewTableCode('');
      await fetchTables();

      setSelectedTable(res.table);
      setRawToken(res.rawToken);
      setQrDataUrl(res.qrDataUrl);
      setQrModalOpen(true);
    } catch (err: any) {
      alert(err.data?.error || 'Failed to create table');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQrCode = () => {
    if (!qrDataUrl || !selectedTable) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `Cafe_QR_${selectedTable.internal_table_code}.png`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cafe-950">Table & QR Code Management</h1>
          <p className="text-xs sm:text-sm text-cafe-600 mt-0.5">
            Manage physical cafe dining tables, monitor occupancy, and generate cryptographic QR standees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrintMode(!printMode)}
            className="px-3.5 py-2 bg-white border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-800 hover:bg-cafe-50 shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{printMode ? 'Exit Standees View' : 'Printable Standees'}</span>
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Physical Table</span>
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
        <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Cryptographic Opaque Token Guarantee</p>
          <p className="text-amber-800 leading-relaxed">
            QR codes contain random 256-bit opaque tokens that map to physical tables exclusively server-side. Internal database table identifiers and table numbers are NEVER exposed to customers in URLs, responses, or scripts.
          </p>
        </div>
      </div>

      {/* Printable Standees View */}
      {printMode ? (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-cafe-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-cafe-800">
              🖨️ Printable Table Standee Cards (Click &quot;Regenerate / View QR&quot; on any table to print its custom standee)
            </p>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-cafe-800 text-white text-xs font-bold rounded-xl"
            >
              Print All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {tables.map(table => (
              <div
                key={table.id}
                className="p-6 bg-white rounded-3xl border-2 border-cafe-800 shadow-card text-center space-y-3 flex flex-col items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-amber-700" />
                  <span className="font-serif font-bold text-base text-cafe-950">Artisan Bistro</span>
                </div>

                <div className="p-3 bg-cafe-50 rounded-2xl border border-cafe-200">
                  <QrCode className="w-32 h-32 text-cafe-800 mx-auto" />
                </div>

                <div>
                  <h3 className="text-xl font-bold font-mono text-cafe-950">{table.internal_table_code}</h3>
                  <p className="text-[11px] text-cafe-600">Scan to View Menu & Order</p>
                </div>

                <button
                  onClick={() => handleRegenerateToken(table)}
                  className="w-full py-2 bg-cafe-800 text-white rounded-xl text-xs font-semibold hover:bg-cafe-900"
                >
                  Regenerate QR Standee
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Regular Table Management Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map(table => {
            const colors = STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE;

            return (
              <div
                key={table.id}
                className="p-5 bg-white rounded-3xl border border-cafe-200 shadow-soft hover:shadow-card transition-all space-y-4 flex flex-col justify-between"
              >
                {/* Table Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-cafe-100 flex items-center justify-center font-mono font-bold text-cafe-900 text-sm shadow-inner">
                      {table.internal_table_code}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-cafe-950">Table {table.internal_table_code}</h3>
                      <p className="text-[11px] text-cafe-500 font-mono">DB ID: #{table.id}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
                    {table.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-cafe-600">
                    Change Status
                  </label>
                  <select
                    value={table.status}
                    onChange={e => handleUpdateStatus(table.id, e.target.value as TableStatus)}
                    className="w-full px-3 py-1.5 bg-cafe-50 border border-cafe-200 rounded-xl text-xs font-semibold text-cafe-900 focus:outline-none focus:ring-2 focus:ring-cafe-600"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="ORDER_PENDING">Order Pending</option>
                    <option value="PAYMENT_PENDING">Payment Pending</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                {/* QR Actions */}
                <div className="pt-3 border-t border-cafe-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRegenerateToken(table)}
                    className="py-2 px-2.5 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl text-[11px] font-bold shadow-xs flex items-center justify-center gap-1 transition-all"
                    title="Generate brand new QR and revoke previous token"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-300" />
                    <span>Regen QR</span>
                  </button>

                  <button
                    onClick={() => handleRegenerateToken(table)}
                    className="py-2 px-2.5 bg-cafe-50 hover:bg-cafe-100 text-cafe-800 border border-cafe-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>View QR</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Preview & Download Modal */}
      {qrModalOpen && selectedTable && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-center space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-serif font-bold text-cafe-950">
                  Table {selectedTable.internal_table_code} QR
                </h3>
              </div>
              <button
                onClick={() => setQrModalOpen(false)}
                className="p-1.5 text-cafe-400 hover:text-cafe-700 rounded-lg hover:bg-cafe-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white border-2 border-cafe-900 rounded-3xl inline-block shadow-card">
              <img src={qrDataUrl} alt="Table QR" className="w-52 h-52 mx-auto" />
              <p className="text-xs font-mono font-bold text-cafe-900 mt-2">
                {selectedTable.internal_table_code}
              </p>
            </div>

            <div className="p-3 bg-cafe-50 rounded-2xl text-left text-[11px] text-cafe-700 space-y-1">
              <p className="font-semibold text-cafe-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                New Token Generated & Active
              </p>
              <p className="font-mono text-[10px] text-cafe-500 truncate">
                Token: {rawToken}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={downloadQrCode}
                className="flex-1 py-2.5 bg-cafe-800 hover:bg-cafe-900 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2.5 bg-cafe-100 hover:bg-cafe-200 text-cafe-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Table Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm overflow-hidden bg-white rounded-3xl shadow-2xl border border-cafe-200 p-6 text-left space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-cafe-100">
              <h3 className="text-base font-serif font-bold text-cafe-950">Add Physical Dining Table</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 text-cafe-400 hover:text-cafe-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cafe-800 mb-1">
                  Internal Table Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. T-11, PATIO-01, ROOF-04"
                  value={newTableCode}
                  onChange={e => setNewTableCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cafe-50 border border-cafe-200 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-cafe-600"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-cafe-500 mt-1">
                  A unique cryptographic 256-bit token and QR standee will be generated automatically.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-cafe-800 hover:bg-cafe-900 disabled:opacity-50 text-white font-bold rounded-xl shadow text-xs flex items-center justify-center gap-1.5"
              >
                {submitting ? 'Creating Table...' : 'Create Table & Generate QR'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
