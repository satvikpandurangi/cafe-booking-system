import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

interface TableContextType {
  hasTableSession: boolean;
  isVerifying: boolean;
  tableVerifiedMessage: string | null;
  verifyTableToken: (token: string) => Promise<{ success: boolean; message: string }>;
  clearTableSession: () => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasTableSession, setHasTableSession] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [tableVerifiedMessage, setTableVerifiedMessage] = useState<string | null>(null);

  // Check existing table session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await api.get<{ valid: boolean; message: string }>('/table/session');
        if (res.valid) {
          setHasTableSession(true);
          setTableVerifiedMessage(res.message);
        } else {
          setHasTableSession(false);
        }
      } catch (err) {
        setHasTableSession(false);
      } finally {
        setIsVerifying(false);
      }
    }

    checkSession();
  }, []);

  const verifyTableToken = async (token: string): Promise<{ success: boolean; message: string }> => {
    setIsVerifying(true);
    try {
      const res = await api.post<{ success: boolean; message: string; sessionToken?: string }>('/table/session', { token });
      if (res.success) {
        setHasTableSession(true);
        setTableVerifiedMessage(res.message);
        if (res.sessionToken) {
          localStorage.setItem('cafe_table_session', res.sessionToken);
        }
        return { success: true, message: res.message };
      }
      return { success: false, message: res.message || 'Invalid table token' };
    } catch (err: any) {
      setHasTableSession(false);
      const msg = err.data?.error || err.message || 'Failed to verify table.';
      return { success: false, message: msg };
    } finally {
      setIsVerifying(false);
    }
  };

  const clearTableSession = async () => {
    try {
      await api.post('/table/session/clear');
    } catch (err) {
      // Ignore
    }
    localStorage.removeItem('cafe_table_session');
    setHasTableSession(false);
    setTableVerifiedMessage(null);
  };

  return (
    <TableContext.Provider
      value={{
        hasTableSession,
        isVerifying,
        tableVerifiedMessage,
        verifyTableToken,
        clearTableSession
      }}
    >
      {children}
    </TableContext.Provider>
  );
};

export function useTable() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
}
