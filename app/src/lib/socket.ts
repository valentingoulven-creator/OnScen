import { io, Socket } from 'socket.io-client';
import { isOfflineDemo } from './offlineDemo';

let socket: Socket | null = null;

function createOfflineSocket(): Socket {
  const noop = () => undefined;
  return {
    on: noop,
    off: noop,
    emit: noop,
    connect: noop,
    disconnect: noop,
  } as unknown as Socket;
}

export function getSocket(): Socket {
  if (isOfflineDemo()) {
    if (!socket) socket = createOfflineSocket();
    return socket;
  }
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function registerUser(userId: string): void {
  if (isOfflineDemo()) return;
  getSocket().emit('register', userId);
}
