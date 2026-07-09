import type { Socket } from 'socket.io-client';
import { SOCKET_ORIGIN } from './nativeServer';
import { showErrorPopup } from './errorPopups';
import i18n from '../i18n';

const AUTH_TOKEN_HEADER = 'X-Auth-Token';
/** Délai de grâce avant d'afficher un avertissement — évite de signaler les micro-coupures
 * (veille d'onglet, changement de réseau) que socket.io reconnecte tout seul en < 1-2 s. */
const DISCONNECT_WARNING_DELAY_MS = 6000;
let disconnectWarningTimer: ReturnType<typeof setTimeout> | null = null;

type IoFn = typeof import('socket.io-client').io;

let ioFn: IoFn | null = null;
let ioLoadPromise: Promise<void> | null = null;

let socket: Socket | null = null;
let registeredUserId: string | null = null;
let authToken: string | null = null;
const onConnectHandlers = new Set<() => void>();
const pendingConnectHandlers = new Set<() => void>();

export function ensureSocketClientLoaded(): Promise<void> {
  if (ioFn) return Promise.resolve();
  if (!ioLoadPromise) {
    ioLoadPromise = import('socket.io-client').then((mod) => {
      ioFn = mod.io;
    });
  }
  return ioLoadPromise;
}

function createSocket(token: string): Socket {
  if (!ioFn) {
    throw new Error('socket.io-client not loaded');
  }
  const opts = {
    path: '/socket.io',
    transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    autoConnect: false,
    auth: { token },
    extraHeaders: { [AUTH_TOKEN_HEADER]: token },
  };
  const s = SOCKET_ORIGIN ? ioFn(SOCKET_ORIGIN, opts) : ioFn(opts);
  s.on('connect', () => {
    if (disconnectWarningTimer) {
      clearTimeout(disconnectWarningTimer);
      disconnectWarningTimer = null;
    }
    if (registeredUserId) {
      s.emit('register', registeredUserId);
    }
    onConnectHandlers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore listener errors */
      }
    });
  });
  s.on('disconnect', (reason: string) => {
    // 'io client disconnect' = déconnexion volontaire (logout, changement de token) : pas d'alerte.
    if (reason === 'io client disconnect') return;
    if (disconnectWarningTimer) clearTimeout(disconnectWarningTimer);
    disconnectWarningTimer = setTimeout(() => {
      showErrorPopup(i18n.t('errors.connectionLost'), { kind: 'warning' });
    }, DISCONNECT_WARNING_DELAY_MS);
  });
  s.on('connect_error', (err: Error) => {
    console.warn('[socket] connect_error:', err.message);
  });
  return s;
}

function migratePendingConnectHandlers(): void {
  if (pendingConnectHandlers.size === 0) return;
  for (const fn of pendingConnectHandlers) {
    onConnectHandlers.add(fn);
  }
  pendingConnectHandlers.clear();
}

function connectIfRegistered(): void {
  if (!registeredUserId || !authToken) return;
  const s = ensureSocket();
  if (!s) return;
  migratePendingConnectHandlers();
  if (s.connected) {
    s.emit('register', registeredUserId);
    onConnectHandlers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore listener errors */
      }
    });
  } else {
    s.connect();
  }
}

function ensureSocket(): Socket | null {
  if (!authToken) return null;
  if (!ioFn) {
    void ensureSocketClientLoaded().then(() => {
      if (!authToken || socket) return;
      socket = createSocket(authToken);
      migratePendingConnectHandlers();
      connectIfRegistered();
    });
    return null;
  }
  if (!socket) {
    socket = createSocket(authToken);
  }
  return socket;
}

export function setSocketAuthToken(token: string | null): void {
  if (!token) {
    clearSocketUser();
    return;
  }
  const tokenChanged = authToken !== null && authToken !== token;
  authToken = token;
  if (tokenChanged && socket) {
    socket.disconnect();
    socket = null;
  }
  if (ioFn) {
    ensureSocket();
    migratePendingConnectHandlers();
  } else {
    void ensureSocketClientLoaded().then(() => {
      if (!authToken) return;
      if (tokenChanged && socket) {
        socket.disconnect();
        socket = null;
      }
      ensureSocket();
      migratePendingConnectHandlers();
      connectIfRegistered();
    });
  }
}

export function isSocketAuthReady(): boolean {
  return authToken !== null;
}

export function getSocket(): Socket | null {
  return ensureSocket();
}

export function registerUser(userId: string, token?: string | null): void {
  registeredUserId = userId;
  if (token) {
    setSocketAuthToken(token);
  }
  if (!authToken) return;
  connectIfRegistered();
}

export function clearSocketUser(): void {
  registeredUserId = null;
  authToken = null;
  pendingConnectHandlers.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitOnSocket(event: string, payload?: unknown): void {
  const s = ensureSocket();
  if (s?.connected) s.emit(event, payload);
}

export function onSocketConnect(fn: () => void): () => void {
  if (!authToken) {
    pendingConnectHandlers.add(fn);
    return () => {
      pendingConnectHandlers.delete(fn);
    };
  }
  const s = ensureSocket();
  if (!s) {
    pendingConnectHandlers.add(fn);
    return () => {
      pendingConnectHandlers.delete(fn);
    };
  }
  onConnectHandlers.add(fn);
  if (s.connected) fn();
  return () => {
    onConnectHandlers.delete(fn);
  };
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
