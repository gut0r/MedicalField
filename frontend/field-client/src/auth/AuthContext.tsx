import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../api';
import { connectivity } from '../connectivity';
import { isOfflineSecurityAvailable, saveOfflineSession, unlockOfflineSession } from '../security/offlineSession';
import type { Professional } from '../types';
import { createUuid } from '../uuid';

interface Value {
  professional: Professional | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  unlock(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const Context = createContext<Value | null>(null);
const PROFESSIONAL_KEY = 'medicalfield.field.professional';
const SIGNED_OUT_KEY = 'medicalfield.field.signedOut';

function deviceId() {
  let id = localStorage.getItem('medicalfield.field.deviceId');
  if (!id) {
    id = createUuid();
    localStorage.setItem('medicalfield.field.deviceId', id);
  }
  return id;
}

function cachedProfessional(): Professional | null {
  try {
    const raw = localStorage.getItem(PROFESSIONAL_KEY);
    return raw ? JSON.parse(raw) as Professional : null;
  } catch {
    localStorage.removeItem(PROFESSIONAL_KEY);
    return null;
  }
}

function remember(professional: Professional | null) {
  if (professional) localStorage.setItem(PROFESSIONAL_KEY, JSON.stringify(professional));
  else localStorage.removeItem(PROFESSIONAL_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(SIGNED_OUT_KEY) === 'true') {
      setLoading(false);
      return;
    }

    const cached = cachedProfessional();
    if (!connectivity.getSnapshot().effectiveOnline) {
      setProfessional(cached);
      setLoading(false);
      return;
    }

    api<{ access_token: string }>('/auth/refresh', { method: 'POST' })
      .then(async result => {
        setAccessToken(result.access_token);
        const current = await api<Professional>('/auth/me');
        remember(current);
        setProfessional(current);
      })
      .catch(() => {
        setAccessToken(null);
        remember(null);
        setProfessional(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const result = await api<{ access_token: string; offline_grant: string; offline_grant_expires_at: string; professional: Professional }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, device_id: deviceId(), device_name: `${window.medicalFieldDesktop ? 'Desktop' : 'PWA'} ${navigator.platform}`.slice(0, 120) }),
    });
    setAccessToken(result.access_token);
    if (isOfflineSecurityAvailable()) {
      await saveOfflineSession(username, password, result.professional, result.offline_grant, result.offline_grant_expires_at);
    }
    localStorage.removeItem(SIGNED_OUT_KEY);
    remember(result.professional);
    setProfessional(result.professional);
  }

  async function unlock(username: string, password: string) {
    setAccessToken(null);
    const unlocked = await unlockOfflineSession(username, password);
    localStorage.removeItem(SIGNED_OUT_KEY);
    remember(unlocked);
    setProfessional(unlocked);
  }

  async function logout() {
    localStorage.setItem(SIGNED_OUT_KEY, 'true');
    try {
      if (connectivity.getSnapshot().effectiveOnline) await api('/auth/logout', { method: 'POST' });
    } catch {
      // A limpeza local continua válida mesmo se a rede cair durante o logout.
    } finally {
      setAccessToken(null);
      remember(null);
      setProfessional(null);
    }
  }

  const value = useMemo(() => ({ professional, loading, login, unlock, logout }), [professional, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
