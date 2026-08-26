import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TableProvider, useTable } from './context/TableContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { AdminAuthProvider } from './context/AdminAuthContext';

// Customer Pages
import { EntryPage } from './pages/customer/EntryPage';
import { MenuPage } from './pages/customer/MenuPage';
import { OrderTrackingPage } from './pages/customer/OrderTrackingPage';
import { OrderHistoryPage } from './pages/customer/OrderHistoryPage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { LiveOrdersPage } from './pages/admin/LiveOrdersPage';
import { TableManagementPage } from './pages/admin/TableManagementPage';
import { MenuManagementPage } from './pages/admin/MenuManagementPage';
import { PaymentManagementPage } from './pages/admin/PaymentManagementPage';
import { CustomerLookupPage } from './pages/admin/CustomerLookupPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

const RootRedirect: React.FC = () => {
  const { hasTableSession, isVerifying } = useTable();
  if (isVerifying) return null;
  return hasTableSession ? <Navigate to="/menu" replace /> : <Navigate to="/entry" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <TableProvider>
        <AuthProvider>
          <CartProvider>
            <AdminAuthProvider>
              <Routes>
                {/* Customer Routes */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="/entry" element={<EntryPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/orders" element={<OrderHistoryPage />} />
                <Route path="/orders/:publicOrderNumber" element={<OrderTrackingPage />} />

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="orders" element={<LiveOrdersPage />} />
                  <Route path="tables" element={<TableManagementPage />} />
                  <Route path="menu" element={<MenuManagementPage />} />
                  <Route path="payments" element={<PaymentManagementPage />} />
                  <Route path="customers" element={<CustomerLookupPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AdminAuthProvider>
          </CartProvider>
        </AuthProvider>
      </TableProvider>
    </BrowserRouter>
  );
};

export default App;
