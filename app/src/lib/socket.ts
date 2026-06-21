import { io, Socket } from 'socket.io-client';

const AUTH_TOKEN_HEADER = 'X-Auth-Token';

let socket: Socket | null = null;
let registeredUserId: string | null = null;
let authToken: string | null = null;
const onConnectHandlers = new Set<() => void>();
const pendingConnectHandlers = new Set<() => void>();

function createSocket(token: string): Socket {
  const s = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    // withCredentials sends the httpOnly auth cookie on the HTTP upgrade handshake (web).
    // Mobile clients (Capacitor) also pass the token explicitly via auth / extraHeaders.
    withCredentials: true,
    auth: { token },
    extraHeaders: { [AUTH_TOKEN_HEADER]: token },
  });
  s.on('connect', () => {
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

function ensureSocket(): Socket | null {
  if (!authToken) return null;
  if (!socket) {
    socket = createSocket(authToken);
  }
  return socket;
}

/** Sync JWT from AuthContext before user profile / registerUser is ready. */
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
  ensureSocket();
  migratePendingConnectHandlers();
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
  const s = ensureSocket();
  if (!s) return;
  migratePendingConnectHandlers();
  if (s.connected) {
    s.emit('register', userId);
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

export function clearSocketUser(): void {
  registeredUserId = null;
  authToken = null;
  pendingConnectHandlers.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Emit only when socket exists and is connected — never throws. */
export function emitOnSocket(event: string, payload?: unknown): void {
  const s = ensureSocket();
  if (s?.connected) s.emit(event, payload);
}

/** Re-run join_salon / join_live (etc.) after reconnect; also runs once if already connected. */
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
