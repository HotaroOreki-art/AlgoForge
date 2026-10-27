import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, isApiError } from '../api/client.ts';
import type { ThemeName, User } from '../api/types.ts';
import { useTheme } from '../theme/ThemeContext.tsx';

interface AuthContextValue {
  user: User | null;
  /** true until the initial /me probe resolves */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'displayName' | 'theme' | 'learningGoals'>>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: User }>('/api/auth/me');
      setUser(res.user);
    } catch (err) {
      if (isApiError(err) && err.status === 401) setUser(null);
      // On network/5xx errors keep whatever we had — don't bounce the user to login.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Sync the server-stored theme preference when a user signs in (local choice wins while signed out).
  useEffect(() => {
    if (user && user.theme && user.theme !== theme) setTheme(user.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist theme changes for signed-in users (debounced by React batching; cheap PATCH).
  useEffect(() => {
    if (!user || user.theme === theme) return;
    const t = setTimeout(() => {
      api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: { theme } })
        .then((res) => setUser(res.user))
        .catch(() => {
          /* non-critical */
        });
    }, 300);
    return () => clearTimeout(t);
  }, [theme, user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { email, password } });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api<{ user: User }>('/api/auth/register', { method: 'POST', body: { email, password, displayName } });
      // A brand-new account adopts the theme chosen on the login screen.
      const themed = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: { theme: theme as ThemeName } }).catch(() => res);
      setUser(themed.user);
      return themed.user;
    },
    [theme],
  );

  const logout = useCallback(async () => {
    try {
      await api<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Pick<User, 'displayName' | 'theme' | 'learningGoals'>>) => {
    const res = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: patch });
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, updateProfile }),
    [user, loading, login, register, logout, refresh, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
