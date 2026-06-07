import { io, Socket } from 'socket.io-client';
import { SOCKET_ORIGIN } from './nativeServer';

let socket: Socket | null = null;
let registeredUserId: string | null = null;
const onConnectHandlers = new Set<() => void>();

function ensureSocket(): Socket {
  if (!socket) {
    socket = SOCKET_ORIGIN
      ? io(SOCKET_ORIGIN, { path: '/socket.io', transports: ['websocket', 'polling'] })
      : io({ path: '/socket.io', transports: ['websocket', 'polling'] });
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

export function registerUser(userId: string): void {
  registeredUserId = userId;
  ensureSocket().emit('register', userId);
}

export function clearSocketUser(): void {
  registeredUserId = null;
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
