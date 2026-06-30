const onlineCounts = new Map<string, number>();
const socketToUser = new Map<string, string>();

export function markSocketOnline(socketId: string, userId: string): void {
  socketToUser.set(socketId, userId);
  onlineCounts.set(userId, (onlineCounts.get(userId) ?? 0) + 1);
}

export function markSocketOffline(socketId: string): string | null {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;
  socketToUser.delete(socketId);
  const next = (onlineCounts.get(userId) ?? 1) - 1;
  if (next <= 0) {
    onlineCounts.delete(userId);
    return userId;
  }
  onlineCounts.set(userId, next);
  return null;
}

export function isUserOnline(userId: string): boolean {
  return (onlineCounts.get(userId) ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return [...onlineCounts.keys()];
}
