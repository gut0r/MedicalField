import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../api';
import type { AuthResult, Professional } from '../types';
import { createUuid } from '../uuid';

interface AuthContextValue {
  professional: Professional | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SIGNED_OUT_KEY = 'medicalfield.portal.signedOut';

function deviceId(): string {
  const existing = localStorage.getItem('medicalfield.portal.deviceId');
  if (existing) return existing;
  const created = createUuid();
  localStorage.setItem('medicalfield.portal.deviceId', created);
  return created;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(SIGNED_OUT_KEY) === 'true') {
      setLoading(false);
      return;
    }
    api<{ access_token: string }>('/auth/refresh', { method: 'POST' })
      .then(async (result) => {
        setAccessToken(result.access_token);
        const current = await api<Professional>('/auth/me');
        if (!current.roles.includes('ADMIN')) throw new Error('Portal exclusivo para administradores');
        setProfessional(current);
      })
      .catch(() => {
        setAccessToken(null);
        setProfessional(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const result = await api<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, device_id: deviceId(), device_name: navigator.userAgent.slice(0, 120) }),
    });
    setAccessToken(result.access_token);
    if (!result.professional.roles.includes('ADMIN')) {
      try { await api('/auth/logout', { method: 'POST' }); } finally { setAccessToken(null); }
      throw new Error('Acesso permitido somente para administradores');
    }
    localStorage.removeItem(SIGNED_OUT_KEY);
    setProfessional(result.professional);
  }

  async function logout() {
    localStorage.setItem(SIGNED_OUT_KEY, 'true');
    try { await api('/auth/logout', { method: 'POST' }); } catch {
      // A interface deve encerrar a sessão local mesmo se a rede falhar.
    } finally {
      setAccessToken(null);
      setProfessional(null);
    }
  }

  const value = useMemo(() => ({ professional, loading, login, logout }), [professional, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}

