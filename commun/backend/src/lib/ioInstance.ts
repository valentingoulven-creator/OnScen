import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function clearIo(): void {
  io = null;
}

export function getIo(): Server | null {
  return io;
}
