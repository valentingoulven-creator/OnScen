import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import i18n from '../i18n';
import { api } from '../lib/api';
import { clearStoredToken, getStoredToken, persistToken } from '../lib/authStorage';
import { clearPersistedSalonSession } from '../lib/activeSalonSession';
import { clearSocketUser, registerUser } from '../lib/socket';
import type { User } from '../types';

interface AuthCtx {
  authBootError: string | null;
  clearAuthBootError: () => void;
  user: User | null;
  token: string | null;
  isNewUser: boolean;
  clearNewUser: () => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    acceptTerms: boolean,
    termsVersion: string,
    inviteCode?: string
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserFromProfile: (user: User) => void;
  setSession: (token: string, user: User, rememberMe?: boolean, isNew?: boolean) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [authBootError, setAuthBootError] = useState<string | null>(null);
  const clearAuthBootError = () => setAuthBootError(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const clearNewUser = () => setIsNewUser(false);
  const logoutRef = useRef<() => void>(null!);

  const logout = () => {
    clearStoredToken();
    clearPersistedSalonSession();
    clearSocketUser();
    setToken(null);
    setUser(null);
  };
  logoutRef.current = logout;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setAuthBootError(
        i18n.t('errors.serverUnreachable')
      );
      if (cancelled) return;
      clearStoredToken();
      setToken(null);
      setUser(null);
    }, 20000);

    api.me(token)
      .then((r) => {
        if (cancelled) return;
        setUser(r.user);
        registerUser(r.user.id, token);
      })
      .catch((e: Error) => {
        setAuthBootError(
          e.message ||
            'Erreur lors du chargement de la session. Déconnectez-vous ou actualisez la page (Ctrl+Shift+R).'
        );
        if (cancelled) return;
        if (
          e.message?.includes('Session expirée') ||
          e.message?.includes('Token invalide') ||
          e.message?.includes('Token manquant')
        ) {
          logoutRef.current();
        }
        // Erreur réseau (serveur arrêté, cert, etc.) : on conserve le token.
        // L'authBootError guide l'utilisateur ; le timeout de 20 s déconnecte si nécessaire.
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [token]);

  const login = async (email: string, password: string, rememberMe = true) => {
    const r = await api.login(email, password, rememberMe);
    persistToken(r.token, rememberMe);
    setToken(r.token);
    setUser(r.user);
    registerUser(r.user.id, r.token);
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    acceptTerms: boolean,
    termsVersion: string,
    inviteCode?: string
  ) => {
    const r = await api.register(username, email, password, acceptTerms, termsVersion, inviteCode);
    if (r.pending) {
      throw new Error(
        r.message ||
          'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.'
      );
    }
    if (!r.token || !r.user) {
      throw new Error('Réponse d’inscription invalide');
    }
    persistToken(r.token, true);
    setToken(r.token);
    setUser(r.user);
    setIsNewUser(true);
    registerUser(r.user.id, r.token);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const r = await api.me(token);
      setUser(r.user);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (
        msg.includes('Session expirée') ||
        msg.includes('Token invalide') ||
        msg.includes('Token manquant')
      ) {
        logoutRef.current();
      }
    }
  };

  const setUserFromProfile = (u: User) =>
    setUser((prev) => {
      // API uses null to signal "field cleared" — JSON cannot represent undefined.
      // Convert null back to undefined to keep state consistent with the User type.
      const raw = u as unknown as Record<string, unknown>;
      const next: User = {
        ...prev,
        ...u,
        isGhostMode: u.isGhostMode ?? prev?.isGhostMode ?? false,
      } as User;
      if (raw.usernameColor === null) next.usernameColor = undefined;
      if (raw.usernameWaveFrom === null) next.usernameWaveFrom = undefined;
      if (raw.usernameWaveTo === null) next.usernameWaveTo = undefined;
      return next;
    });

  const setSession = (t: string, u: User, rememberMe = true, isNew = false) => {
    persistToken(t, rememberMe);
    setToken(t);
    setUser(u);
    if (isNew) setIsNewUser(true);
    registerUser(u.id, t);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isNewUser, clearNewUser, login, register, logout, refreshUser, setUserFromProfile, setSession, authBootError, clearAuthBootError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
