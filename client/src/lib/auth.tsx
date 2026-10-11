import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import { http, get, setDemoMode } from './api';
import type { User } from '../types';

const DEMO_USER: User = { id: 'demo-user', name: 'Linh Nguyễn', email: 'linh@example.com' };
const SIGNED_OUT_KEY = 'chitieu-signed-out';
type AuthValue = { user: User | null; ready: boolean; demo: boolean; setUser: (user: User | null) => void; setDemo: (demo: boolean) => void };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const setUser = useCallback((nextUser: User | null) => {
    setUserState(nextUser);
    try {
      if (nextUser) localStorage.removeItem(SIGNED_OUT_KEY);
      else localStorage.setItem(SIGNED_OUT_KEY, 'true');
    } catch { /* storage may be blocked; the current tab still works */ }
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      let signedOut = false;
      try { signedOut = localStorage.getItem(SIGNED_OUT_KEY) === 'true'; } catch { /* storage may be blocked */ }
      try {
        let databaseAvailable: boolean;
        try {
          const health = await http.get<{ database: boolean }>('/health');
          databaseAvailable = health.data.database;
        } catch (error) {
          console.warn('Không thể kiểm tra máy chủ; chuyển sang chế độ xem thử.', error);
          setDemoMode(true);
          if (active) {
            setDemo(true);
            setUserState(signedOut ? null : DEMO_USER);
          }
          return;
        }
        const isDemo = !databaseAvailable;
        setDemoMode(isDemo);
        if (active) setDemo(isDemo);
        if (signedOut) {
          if (active) setUserState(null);
        } else if (isDemo) {
          if (active) setUser(DEMO_USER);
        } else {
          try {
            const result = await get<{ user: User }>('/auth/me');
            if (active) setUserState(result.user);
          } catch (error) {
            if (!axios.isAxiosError(error) || error.response?.status !== 401) {
              console.error('Không thể khôi phục phiên đăng nhập:', error);
            }
            if (active) setUserState(null);
          }
        }
      } finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, []);
  const value = useMemo(() => ({ user, ready, demo, setUser, setDemo }), [user, ready, demo]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải nằm trong AuthProvider');
  return value;
}
