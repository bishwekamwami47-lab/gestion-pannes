/* eslint-disable react/only-export-components */
import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import API from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (username, password) => {
    const res = await API.post('auth/login/', { username, password });
    localStorage.setItem('access_token', res.data.access);
    localStorage.setItem('refresh_token', res.data.refresh);

    const me = await API.get('auth/me/');
    localStorage.setItem('user', JSON.stringify(me.data));
    setUser(me.data);
    return me.data;
  }, []);

  const logout = useCallback(() => {
    const lang = localStorage.getItem('lang');
    localStorage.clear();
    if (lang) localStorage.setItem('lang', lang);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  }
  return ctx;
}
