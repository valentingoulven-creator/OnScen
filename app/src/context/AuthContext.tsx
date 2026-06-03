import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { registerUser } from '../lib/socket';
import type { User } from '../types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserFromProfile: (user: User) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('melosong_token'));
  const [user, setUser] = useState<User | null>(null);
  const logoutRef = useRef<() => void>(null!);

  const logout = () => {
    localStorage.removeItem('melosong_token');
    setToken(null);
    setUser(null);
  };
  logoutRef.current = logout;

  useEffect(() => {
    if (!token) return;
    api.me(token).then((r) => {
      setUser(r.user);
      registerUser(r.user.id);
    }).catch((e: Error) => {
      if (e.message?.includes('Session expirée') || e.message?.includes('Token invalide')) {
        logoutRef.current();
      } else {
        localStorage.removeItem('melosong_token');
        setToken(null);
      }
    });
  }, [token]);

  const login = async (email: string, password: string) => {
    const r = await api.login(email, password);
    localStorage.setItem('melosong_token', r.token);
    setToken(r.token);
    setUser(r.user);
    registerUser(r.user.id);
  };

  const register = async (username: string, email: string, password: string) => {
    const r = await api.register(username, email, password);
    localStorage.setItem('melosong_token', r.token);
    setToken(r.token);
    setUser(r.user);
    registerUser(r.user.id);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const r = await api.me(token);
      setUser(r.user);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Session expirée') || msg.includes('Token invalide')) {
        logoutRef.current();
      }
    }
  };

  const setUserFromProfile = (u: User) =>
    setUser((prev) => ({
      ...prev,
      ...u,
      isGhostMode: u.isGhostMode ?? prev?.isGhostMode ?? false,
    }));

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, setUserFromProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
