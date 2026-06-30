import { db, type DirectMessage } from '../models/schema';
import { isDmVisibleToUser } from './dmVisibility';
import { hasBlocked, shouldDeliverToReceiver } from './blocks';
import { hasMuted } from './mutes';

export function getDmLastRead(userId: string, otherUserId: string): number {
  return db.dmReadCursors.get(userId)?.get(otherUserId) ?? 0;
}

export function markDmThreadRead(userId: string, otherUserId: string, at = Date.now()): void {
  if (!db.dmReadCursors.has(userId)) db.dmReadCursors.set(userId, new Map());
  const cursors = db.dmReadCursors.get(userId)!;
  const prev = cursors.get(otherUserId) ?? 0;
  if (at > prev) cursors.set(otherUserId, at);
}

function isUnreadIncomingMessage(
  userId: string,
  m: DirectMessage,
  opts?: { includeMuted?: boolean }
): boolean {
  if (m.receiverId !== userId || m.senderId === userId) return false;
  if (!isDmVisibleToUser(m, userId)) return false;
  if (hasBlocked(userId, m.senderId)) return false;
  if (!opts?.includeMuted && hasMuted(userId, m.senderId)) return false;
  if (!shouldDeliverToReceiver(m.senderId, m.receiverId)) return false;
  return m.timestamp > getDmLastRead(userId, m.senderId);
}

export function countDmUnreadForUser(userId: string): number {
  let count = 0;
  for (const m of db.directMessages) {
    if (isUnreadIncomingMessage(userId, m)) count++;
  }
  return count;
}

export function countDmUnreadWithPeer(userId: string, otherUserId: string): number {
  let count = 0;
  for (const m of db.directMessages) {
    if (m.senderId !== otherUserId || m.receiverId !== userId) continue;
    if (isUnreadIncomingMessage(userId, m, { includeMuted: true })) count++;
  }
  return count;
}
