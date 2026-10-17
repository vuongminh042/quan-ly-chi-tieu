import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { http, get, setDemoMode } from './api';
import type { User } from '../types';
import { useToast } from '../components/Toast';

const DEMO_USER: User = { id: 'demo-user', name: 'Linh Nguyễn', email: 'linh@example.com' };
const SIGNED_OUT_KEY = 'chitieu-signed-out';
const SESSION_EXPIRY_KEY = 'chitieu-session-expires-at';
const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập của bạn đã hết hạn';
type AuthValue = { user: User | null; ready: boolean; demo: boolean; setUser: (user: User | null, sessionExpiresAt?: number) => void; setDemo: (demo: boolean) => void };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const showToast = useToast();
  const [user, setUserState] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const expiredHandled = useRef(false);

  const clearSessionExpiry = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_EXPIRY_KEY);
    } catch {
      // The current tab still clears its in-memory session.
    }
    setSessionExpiresAt(null);
  }, []);

  const setUser = useCallback((nextUser: User | null, expiry?: number) => {
    setUserState(nextUser);
    if (nextUser) expiredHandled.current = false;
    try {
      if (nextUser) {
        localStorage.removeItem(SIGNED_OUT_KEY);
        if (expiry !== undefined) localStorage.setItem(SESSION_EXPIRY_KEY, String(expiry));
      } else {
        localStorage.setItem(SIGNED_OUT_KEY, 'true');
        localStorage.removeItem(SESSION_EXPIRY_KEY);
      }
    } catch {
      // The in-memory session remains usable if browser storage is blocked.
    }
    if (expiry !== undefined && nextUser) setSessionExpiresAt(expiry);
    if (!nextUser) setSessionExpiresAt(null);
  }, []);

  const expireSession = useCallback(() => {
    if (expiredHandled.current) return;
    expiredHandled.current = true;
    setUser(null);
    showToast(SESSION_EXPIRED_MESSAGE, 'error');
  }, [setUser, showToast]);

  useEffect(() => {
    const interceptor = http.interceptors.response.use(
      response => response,
      error => {
        if (
          axios.isAxiosError<{ code?: string }>(error) &&
          error.response?.data?.code === 'SESSION_EXPIRED'
        ) {
          expireSession();
        }
        return Promise.reject(error);
      },
    );
    return () => http.interceptors.response.eject(interceptor);
  }, [expireSession]);

  useEffect(() => {
    if (!user || demo || sessionExpiresAt === null) return;
    const delay = sessionExpiresAt - Date.now();
    if (delay <= 0) {
      expireSession();
      return;
    }
    const timer = window.setTimeout(expireSession, delay);
    return () => window.clearTimeout(timer);
  }, [user, demo, sessionExpiresAt, expireSession]);

  useEffect(() => {
    let active = true;
    (async () => {
      let signedOut = false;
      let storedExpiry: number | null = null;
      try {
        signedOut = localStorage.getItem(SIGNED_OUT_KEY) === 'true';
        const value = Number(localStorage.getItem(SESSION_EXPIRY_KEY));
        if (Number.isFinite(value) && value > 0) storedExpiry = value;
      } catch {
        // Continue with the server-side session when browser storage is blocked.
      }
      if (!signedOut && storedExpiry !== null && storedExpiry <= Date.now()) {
        if (active) {
          expireSession();
          setReady(true);
        }
        return;
      }
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
        if (isDemo) {
          if (active) setUser(signedOut ? null : DEMO_USER);
        } else {
          try {
            const result = await get<{ user: User; sessionExpiresAt?: number }>('/auth/me');
            if (active) setUser(result.user, result.sessionExpiresAt);
          } catch (error) {
            if (!axios.isAxiosError(error) || error.response?.status !== 401) {
              console.error('Không thể khôi phục phiên đăng nhập:', error);
            }
            if (active) {
              setUserState(null);
              clearSessionExpiry();
            }
          }
        }
      } finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [clearSessionExpiry, expireSession, setUser]);
  const value = useMemo(() => ({ user, ready, demo, setUser, setDemo }), [user, ready, demo]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải nằm trong AuthProvider');
  return value;
}
