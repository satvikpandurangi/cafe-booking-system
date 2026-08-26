import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { User } from '../../../shared/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  requestOtp: (phone: string) => Promise<{ success: boolean; message: string; devOtp?: string; cooldownRemaining?: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message: string; user?: User }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get<{ user: User }>('/auth/me');
        if (res.user) {
          setUser(res.user);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const requestOtp = async (phone: string) => {
    try {
      const res = await api.post<{ message: string; devOtp?: string }>('/auth/request-otp', { phone });
      return { success: true, message: res.message, devOtp: res.devOtp };
    } catch (err: any) {
      return {
        success: false,
        message: err.data?.error || err.message || 'Failed to request OTP.',
        cooldownRemaining: err.data?.cooldownRemaining
      };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const res = await api.post<{ message: string; user: User; token: string }>('/auth/verify-otp', { phone, otp });
      setUser(res.user);
      setIsAuthModalOpen(false);
      return { success: true, message: res.message, user: res.user };
    } catch (err: any) {
      return {
        success: false,
        message: err.data?.error || err.message || 'Verification failed.'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        requestOtp,
        verifyOtp,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
