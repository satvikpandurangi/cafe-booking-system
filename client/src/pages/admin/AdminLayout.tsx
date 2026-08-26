import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  LayoutDashboard,
  Bell,
  UtensilsCrossed,
  QrCode,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  Coffee,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Volume2,
  VolumeX
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { admin, isAdminAuthenticated, isLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [audioAlerts, setAudioAlerts] = useState(true);

  React.useEffect(() => {
    if (!isLoading && !isAdminAuthenticated) {
      navigate('/admin/login');
    }
  }, [isLoading, isAdminAuthenticated, navigate]);

  if (isLoading || !admin) {
    return (
      <div className="min-h-screen bg-cafe-950 flex items-center justify-center text-white">
        <div className="text-center space-y-2">
          <Coffee className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
          <p className="text-xs text-cafe-300 font-semibold">Loading Admin Console...</p>
        </div>
      </div>
    );
  }

  const navLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/orders', label: 'Live Orders', icon: Bell },
    { to: '/admin/tables', label: 'Tables & QR', icon: QrCode },
    { to: '/admin/menu', label: 'Menu Management', icon: UtensilsCrossed },
    { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    { to: '/admin/customers', label: 'Customers', icon: Users },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-cafe-50 flex flex-col md:flex-row">
      {/* Mobile Nav Top Bar */}
      <div className="md:hidden bg-cafe-900 text-white p-4 flex items-center justify-between border-b border-cafe-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-300">
            <Coffee className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-sm tracking-wide">Artisan Admin</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 text-cafe-300 hover:text-white rounded-lg bg-white/5"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-cafe-950 text-cafe-100 flex flex-col justify-between border-r border-cafe-900 transition-transform duration-300 ease-in-out ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="p-6 border-b border-cafe-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-base text-white tracking-wide leading-tight">
                  Artisan Cafe
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  {admin.role} Portal
                </span>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1">
            {navLinks.map(link => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                        : 'text-cafe-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-cafe-900/80 space-y-3">
          {/* Quick toggle for alerts */}
          <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-[11px] text-cafe-300">
            <span className="flex items-center gap-1.5">
              {audioAlerts ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-cafe-500" />}
              Audio Alerts
            </span>
            <button
              onClick={() => setAudioAlerts(!audioAlerts)}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                audioAlerts ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-cafe-400'
              }`}
            >
              {audioAlerts ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="truncate max-w-[140px]">
              <p className="text-xs font-semibold text-white truncate">{admin.email}</p>
              <p className="text-[10px] text-cafe-400 capitalize">{admin.role.toLowerCase()}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                navigate('/admin/login');
              }}
              className="p-2 text-cafe-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <a
            href="/menu"
            target="_blank"
            rel="noreferrer"
            className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] text-cafe-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
          >
            <span>Open Customer View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 min-w-0 overflow-y-auto max-h-screen">
        <Outlet context={{ audioAlerts }} />
      </main>
    </div>
  );
};
