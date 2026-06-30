import { db } from '../models/schema';
import { getIo } from './ioInstance';
import { isDevUser } from './accessControl';
import { assertCanJoinLiveAsViewer } from './platformPlans';
import type { Live } from '../models/schema';

export interface LiveConnectedParticipant {
  id: string;
  username: string;
  usernameColor?: string;
  isVip: boolean;
  isDev: boolean;
}

/** Connected socket members in live room (host excluded, deduped by userId). */
export function getLiveConnectedParticipants(
  liveId: string,
  hostId: string,
  vipModeratorIds: string[] = []
): LiveConnectedParticipant[] {
  const io = getIo();
  if (!io) return [];

  const room = io.sockets.adapter.rooms.get(`live_${liveId}`);
  if (!room) return [];

  const vipSet = new Set(vipModeratorIds);
  const seen = new Set<string>();
  const result: LiveConnectedParticipant[] = [];

  for (const socketId of room) {
    const sock = io.sockets.sockets.get(socketId);
    const userId = (sock?.data as { userId?: string }).userId;
    if (!userId || userId === hostId || seen.has(userId)) continue;
    seen.add(userId);
    const user = db.users.get(userId);
    result.push({
      id: userId,
      username: user?.username ?? 'Utilisateur',
      usernameColor: user?.usernameColor,
      isVip: vipSet.has(userId),
      isDev: isDevUser(user),
    });
  }

  result.sort((a, b) => a.username.localeCompare(b.username, 'fr'));
  return result;
}

/** Unique non-host userIds with at least one socket in the live room. */
export function getLiveRoomViewerUserIds(liveId: string, hostId: string): Set<string> {
  const io = getIo();
  const ids = new Set<string>();
  if (!io) return ids;

  const room = io.sockets.adapter.rooms.get(`live_${liveId}`);
  if (!room) return ids;

  for (const socketId of room) {
    const userId = (io.sockets.sockets.get(socketId)?.data as { userId?: string }).userId;
    if (!userId || userId === hostId) continue;
    ids.add(userId);
  }
  return ids;
}

export function countLiveUniqueViewers(liveId: string, hostId: string): number {
  return getLiveRoomViewerUserIds(liveId, hostId).size;
}

export function isUserViewingLive(liveId: string, hostId: string, userId: string): boolean {
  return getLiveRoomViewerUserIds(liveId, hostId).has(userId);
}

/** True when no other socket for this user remains in the live room. */
export function isLastLiveSocketForUser(liveId: string, userId: string): boolean {
  const io = getIo();
  if (!io) return true;

  const room = io.sockets.adapter.rooms.get(`live_${liveId}`);
  if (!room) return true;

  for (const socketId of room) {
    const sockUserId = (io.sockets.sockets.get(socketId)?.data as { userId?: string }).userId;
    if (sockUserId === userId) return false;
  }
  return true;
}

/** TURN/ICE credentials: host of an active live, or viewer currently in the live socket room. */
export function canAccessLiveIceServers(liveId: string, userId: string): boolean {
  const live = db.lives.get(liveId);
  if (!live?.isActive) return false;
  if (live.hostId === userId) return true;
  return isUserViewingLive(liveId, live.hostId, userId);
}

/** Enforce viewer plan limits for new spectators (skips host and returning viewers). */
export function assertViewerCanAccessLive(live: Live, viewerId: string): void {
  if (viewerId === live.hostId) return;
  if (isUserViewingLive(live.id, live.hostId, viewerId)) return;
  assertCanJoinLiveAsViewer(live.hostId, countLiveUniqueViewers(live.id, live.hostId), viewerId);
}
