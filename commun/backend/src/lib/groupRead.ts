import { db, type GroupMessage } from '../models/schema';
import { isGroupMessageVisibleToUser } from './groupVisibility';
import { hasMuted } from './mutes';

export function isGroupMember(groupId: string, userId: string): boolean {
  const group = db.messageGroups.find((g) => g.id === groupId);
  return Boolean(group?.memberIds.includes(userId));
}

export function getGroupLastRead(userId: string, groupId: string): number {
  return db.groupReadCursors.get(userId)?.get(groupId) ?? 0;
}

export function markGroupThreadRead(userId: string, groupId: string, at = Date.now()): void {
  if (!db.groupReadCursors.has(userId)) db.groupReadCursors.set(userId, new Map());
  const cursors = db.groupReadCursors.get(userId)!;
  const prev = cursors.get(groupId) ?? 0;
  if (at > prev) cursors.set(groupId, at);
}

function isUnreadGroupMessage(
  userId: string,
  m: GroupMessage,
  opts?: { includeMuted?: boolean }
): boolean {
  if (m.kind === 'system') return false;
  if (m.senderId === userId) return false;
  if (!isGroupMessageVisibleToUser(m, userId)) return false;
  if (!isGroupMember(m.groupId, userId)) return false;
  if (!opts?.includeMuted && hasMuted(userId, m.senderId)) return false;
  return m.timestamp > getGroupLastRead(userId, m.groupId);
}

export function countGroupUnreadForUser(userId: string): number {
  let count = 0;
  for (const m of db.groupMessages) {
    if (isUnreadGroupMessage(userId, m)) count++;
  }
  return count;
}

export function countGroupUnreadInGroup(userId: string, groupId: string): number {
  let count = 0;
  for (const m of db.groupMessages) {
    if (m.groupId !== groupId) continue;
    if (isUnreadGroupMessage(userId, m, { includeMuted: true })) count++;
  }
  return count;
}
