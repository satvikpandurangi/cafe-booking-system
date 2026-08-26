import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { AdminUser } from '../../../shared/types';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await api.get<{ admin: AdminUser }>('/admin/me');
        if (res.admin) {
          setAdmin(res.admin);
        }
      } catch (err) {
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdmin();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post<{ message: string; admin: AdminUser; token: string }>('/admin/login', { email, password });
      setAdmin(res.admin);
      return { success: true, message: res.message };
    } catch (err: any) {
      return {
        success: false,
        message: err.data?.error || err.message || 'Invalid credentials'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/admin/logout');
    } catch (err) {
      // Ignore
    }
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAdminAuthenticated: !!admin,
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
