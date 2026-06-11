import { db } from '../models/schema';
import { getIo } from './ioInstance';
import { isDevUser } from './accessControl';

export interface SalonConnectedParticipant {
  id: string;
  username: string;
  usernameColor?: string;
  isVip: boolean;
  isDev: boolean;
}

/** Connected socket members in salon room (host excluded, deduped by userId). */
export function getSalonConnectedParticipants(
  salonId: string,
  hostId: string,
  vipModeratorIds: string[] = []
): SalonConnectedParticipant[] {
  const io = getIo();
  if (!io) return [];

  const room = io.sockets.adapter.rooms.get(`salon_${salonId}`);
  if (!room) return [];

  const vipSet = new Set(vipModeratorIds);
  const seen = new Set<string>();
  const result: SalonConnectedParticipant[] = [];

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
