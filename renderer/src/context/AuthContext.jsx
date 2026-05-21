import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/ipc';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // null = not logged in
  const [loading, setLoading] = useState(true); // true while checking session on startup

  // Check if a session already exists in the main process (survives hot-reloads in dev)
  useEffect(() => {
    invoke('auth:me')
      .then((res) => { if (res.success) setUser(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await invoke('auth:login', { username, password });
    if (res.success) setUser(res.data);
    return res;
  }, []);

  const logout = useCallback(async () => {
    await invoke('auth:logout');
    setUser(null);
  }, []);

  // Re-fetches the session from main — used after changePassword to clear mustChangePassword
  const refreshUser = useCallback(async () => {
    const res = await invoke('auth:me');
    if (res.success) setUser(res.data);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
