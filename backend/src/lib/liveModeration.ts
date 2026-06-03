import { db, Live } from '../models/schema';

export function isLiveHost(live: Live, userId: string): boolean {
  return live.hostId === userId;
}

export function isLiveVipModerator(live: Live, userId: string): boolean {
  return (live.vipModeratorIds ?? []).includes(userId);
}

export function canModerateLiveChat(live: Live, userId: string): boolean {
  return isLiveHost(live, userId) || isLiveVipModerator(live, userId);
}

/** Suppression des messages : hôte ou modérateur VIP. */
export function canDeleteLiveChatMessage(live: Live, userId: string): boolean {
  return canModerateLiveChat(live, userId);
}

/** Bannir un spectateur : hôte ou VIP (pas l'hôte cible ; VIP ne peut pas bannir l'hôte ni un autre VIP). */
export function canBanLiveUser(live: Live, actorId: string, targetUserId: string): boolean {
  if (!canModerateLiveChat(live, actorId)) return false;
  if (targetUserId === live.hostId) return false;
  if (isLiveHost(live, actorId)) return true;
  return !isLiveVipModerator(live, targetUserId);
}

export function deleteLiveChatMessage(liveId: string, messageId: string): boolean {
  const list = db.liveChats.get(liveId);
  if (!list) return false;
  const idx = list.findIndex((m) => m.id === messageId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  db.liveChats.set(liveId, list);
  return true;
}
