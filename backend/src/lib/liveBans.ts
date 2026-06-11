import { db, LiveBan, LiveBanScope } from '../models/schema';
import { isDevUser } from './accessControl';

function liveBanMap(liveId: string): Map<string, LiveBan> {
  let map = db.liveBans.get(liveId);
  if (!map) {
    map = new Map();
    db.liveBans.set(liveId, map);
  }
  return map;
}

function normalizeScope(ban: LiveBan): LiveBanScope {
  return ban.scope ?? 'live';
}

export function getLiveBan(liveId: string, userId: string): LiveBan | undefined {
  if (isDevUser(db.users.get(userId))) return undefined;
  const ban = liveBanMap(liveId).get(userId);
  if (!ban) return undefined;
  if (!ban.permanent && ban.until != null && ban.until <= Date.now()) {
    liveBanMap(liveId).delete(userId);
    return undefined;
  }
  return { ...ban, scope: normalizeScope(ban) };
}

export function isLiveViewBanned(liveId: string, userId: string): boolean {
  const ban = getLiveBan(liveId, userId);
  return ban != null && normalizeScope(ban) === 'live';
}

export function isLiveChatBanned(liveId: string, userId: string): boolean {
  const ban = getLiveBan(liveId, userId);
  if (!ban) return false;
  const scope = normalizeScope(ban);
  return scope === 'chat' || scope === 'live';
}

/** @deprecated Préférer isLiveViewBanned / isLiveChatBanned */
export function isLiveBanned(liveId: string, userId: string): boolean {
  return isLiveChatBanned(liveId, userId);
}

export function setLiveBan(liveId: string, userId: string, ban: LiveBan): void {
  liveBanMap(liveId).set(userId, { ...ban, scope: normalizeScope(ban) });
}

export function liveBanMessage(ban: LiveBan): string {
  const scope = normalizeScope(ban);
  const target =
    scope === 'chat' ? 'du chat de ce live' : 'de ce live';
  if (ban.permanent) {
    return `Vous avez été banni définitivement ${target}.`;
  }
  const until = ban.until ?? Date.now();
  return `Vous avez été banni ${target} jusqu'au ${new Date(until).toLocaleString('fr-FR')}.`;
}
