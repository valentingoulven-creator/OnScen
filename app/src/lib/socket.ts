import { io, Socket } from 'socket.io-client';

const AUTH_TOKEN_HEADER = 'X-Auth-Token';

let socket: Socket | null = null;
let registeredUserId: string | null = null;
let authToken: string | null = null;
const onConnectHandlers = new Set<() => void>();

function createSocket(token: string): Socket {
  return io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    extraHeaders: { [AUTH_TOKEN_HEADER]: token },
  });
}

function ensureSocket(): Socket {
  if (!authToken) {
    throw new Error('Socket requires authentication token');
  }
  if (!socket) {
    socket = createSocket(authToken);
    socket.on('connect', () => {
      if (registeredUserId) {
        socket!.emit('register', registeredUserId);
      }
      onConnectHandlers.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore listener errors */
        }
      });
    });
  }
  return socket;
}

export function getSocket(): Socket {
  return ensureSocket();
}

export function registerUser(userId: string, token?: string | null): void {
  registeredUserId = userId;
  if (token) {
    if (authToken && authToken !== token && socket) {
      socket.disconnect();
      socket = null;
    }
    authToken = token;
  }
  if (!authToken) return;
  const s = ensureSocket();
  if (s.connected) {
    s.emit('register', userId);
  } else {
    s.connect();
  }
}

export function clearSocketUser(): void {
  registeredUserId = null;
  authToken = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Re-run join_salon / join_live (etc.) after reconnect; also runs once if already connected. */
export function onSocketConnect(fn: () => void): () => void {
  ensureSocket();
  onConnectHandlers.add(fn);
  if (socket?.connected) fn();
  return () => {
    onConnectHandlers.delete(fn);
  };
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
