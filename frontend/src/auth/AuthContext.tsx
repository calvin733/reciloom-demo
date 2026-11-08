import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getMe, login as loginApi, logout as logoutApi, register as registerApi, type User } from '../api/auth';
import { ApiError, resetCsrf } from '../api/http';
import RequestMessage from '../components/RequestMessage';

type Auth = {
  user: User | null; restoring: boolean; error: string; retry: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>; expire: () => void;
};
const Context = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const expire = useCallback(() => { setUser(null); setError(''); resetCsrf(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setRestoring(true); setError('');
    getMe(controller.signal).then(value => {
      if (!controller.signal.aborted) setUser(value);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setUser(null);
      if (!(reason instanceof ApiError && reason.status === 401)) setError('Could not check your session. Check your connection and try again.');
    }).finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [attempt]);
  const value: Auth = {
    user, restoring, error, retry: () => setAttempt(value => value + 1), expire,
    login: async (email, password) => { setUser(await loginApi(email, password)); setError(''); },
    register: async (name, email, password) => { setUser(await registerApi(name, email, password)); setError(''); },
    logout: async () => {
      try { await logoutApi(); }
      catch (reason) { if (!(reason instanceof ApiError && reason.status === 401)) throw reason; }
      expire();
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.restoring) return <div className="page-width loading-state" role="status">Checking session</div>;
  if (auth.error) return <div className="page-width"><RequestMessage title="Account unavailable" onRetry={auth.retry}><p>{auth.error}</p></RequestMessage></div>;
  if (!auth.user) return <Navigate replace to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} />;
  return children;
}
// Tujuan setelah login selalu path lokal; tidak menerima URL dari situs luar.
export function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x1f]/.test(value)
    && !/^\/(login|register)(?:[/?#]|$)/.test(value) ? value : '/my-recipes';
}
