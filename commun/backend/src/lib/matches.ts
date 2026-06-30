import { db } from '../models/schema';
import { getIo } from './ioInstance';
import { pushNotification } from './notifications';
import { trackEvent } from './analytics';

export interface HeartEvent {
  fromId: string;
  toId: string;
  createdAt: number;
}

export interface MusicMatch {
  id: string;
  userIdA: string;
  userIdB: string;
  createdAt: number;
}

function pairKey(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

export function recordHeart(fromId: string, toId: string): void {
  db.heartEvents.push({ fromId, toId, createdAt: Date.now() });
}

export function hasHeart(fromId: string, toId: string): boolean {
  return db.heartEvents.some((h) => h.fromId === fromId && h.toId === toId);
}

export function findMatch(userId1: string, userId2: string): MusicMatch | undefined {
  const [a, b] = pairKey(userId1, userId2);
  return db.matches.find((m) => m.userIdA === a && m.userIdB === b);
}

export function createMatchIfMutual(senderId: string, recipientId: string): MusicMatch | null {
  if (!hasHeart(recipientId, senderId)) return null;
  const existing = findMatch(senderId, recipientId);
  if (existing) return null;

  const [userIdA, userIdB] = pairKey(senderId, recipientId);
  const match: MusicMatch = {
    id: `match_${Date.now()}`,
    userIdA,
    userIdB,
    createdAt: Date.now(),
  };
  db.matches.push(match);
  trackEvent('match_created');
  return match;
}

export function notifyMatch(
  match: MusicMatch,
  userA: { id: string; username: string; avatarUrl?: string },
  userB: { id: string; username: string; avatarUrl?: string }
) {
  pushNotification({
    recipientId: userA.id,
    senderId: userB.id,
    senderName: userB.username,
    senderAvatarUrl: userB.avatarUrl,
    type: 'match',
    message: `Match musical avec ${userB.username} ! 💞`,
    matchId: match.id,
  });
  pushNotification({
    recipientId: userB.id,
    senderId: userA.id,
    senderName: userA.username,
    senderAvatarUrl: userA.avatarUrl,
    type: 'match',
    message: `Match musical avec ${userA.username} ! 💞`,
    matchId: match.id,
  });

  const io = getIo();
  if (!io) return;

  const payloadFor = (
    viewerId: string,
    other: { id: string; username: string; avatarUrl?: string }
  ) => ({
    matchId: match.id,
    createdAt: match.createdAt,
    otherUser: { id: other.id, username: other.username, avatarUrl: other.avatarUrl },
    viewerId,
  });

  io.to(`user_${userA.id}`).emit('match_created', payloadFor(userA.id, userB));
  io.to(`user_${userB.id}`).emit('match_created', payloadFor(userB.id, userA));
}

export function publicMatchDto(match: MusicMatch, viewerId: string) {
  const otherId = match.userIdA === viewerId ? match.userIdB : match.userIdA;
  const other = db.users.get(otherId);
  return {
    id: match.id,
    createdAt: match.createdAt,
    otherUser: other
      ? { id: other.id, username: other.username, avatarUrl: other.avatarUrl }
      : { id: otherId, username: 'Utilisateur', avatarUrl: undefined },
  };
}
