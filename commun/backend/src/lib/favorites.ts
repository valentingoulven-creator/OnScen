import { db, Live, Salon, User, UserFavorite } from '../models/schema';
import { pushNotification } from './notifications';
import { trackEvent } from './analytics';
import { runInBatchesAsync } from './asyncFanOut';

function fanMap(fanId: string): Map<string, UserFavorite> {
  let map = db.userFavorites.get(fanId);
  if (!map) {
    map = new Map();
    db.userFavorites.set(fanId, map);
  }
  return map;
}

export function getFavoriteEntry(fanId: string, hostId: string): UserFavorite | null {
  return db.userFavorites.get(fanId)?.get(hostId) ?? null;
}

export function isFavorite(fanId: string, hostId: string): boolean {
  if (fanId === hostId) return false;
  return db.userFavorites.get(fanId)?.has(hostId) ?? false;
}

export function addFavorite(fanId: string, hostId: string): UserFavorite {
  const entry: UserFavorite = {
    fanId,
    hostId,
    notificationsEnabled: true,
    createdAt: Date.now(),
  };
  fanMap(fanId).set(hostId, entry);
  trackEvent('favorite_added', fanId);
  return entry;
}

export function removeFavorite(fanId: string, hostId: string): void {
  db.userFavorites.get(fanId)?.delete(hostId);
}

export function setFavoriteNotifications(fanId: string, hostId: string, enabled: boolean): void {
  const entry = fanMap(fanId).get(hostId);
  if (entry) entry.notificationsEnabled = enabled;
}

export function getFavoriteHostIds(fanId: string): string[] {
  return [...(db.userFavorites.get(fanId)?.keys() ?? [])];
}

export function getFollowingCount(fanId: string): number {
  return getFavoriteHostIds(fanId).length;
}

/** Tous les fans (fanId) d'un hôte donné. */
export function getFanIds(hostId: string): string[] {
  const ids: string[] = [];
  for (const [fanId, map] of db.userFavorites) {
    if (map.has(hostId)) ids.push(fanId);
  }
  return ids;
}

/** Nombre d'utilisateurs ayant mis cet hôte en favoris. */
export function getFavoriteCount(hostId: string): number {
  let count = 0;
  for (const map of db.userFavorites.values()) {
    if (map.has(hostId)) count += 1;
  }
  return count;
}

/** Notifie les fans qu'un hôte favori a ouvert un salon. */
export function notifyFavoritesSalonStarted(host: User, salon: Salon): void {
  const fanIds = getFanIds(host.id);
  const message = `${host.username} a ouvert un salon !`;
  runInBatchesAsync(fanIds, (fanId) => {
    if (fanId === host.id) return;
    const entry = db.userFavorites.get(fanId)?.get(host.id);
    if (!entry?.notificationsEnabled) return;
    pushNotification({
      recipientId: fanId,
      senderId: host.id,
      senderName: host.username,
      senderAvatarUrl: host.avatarUrl,
      type: 'favorite_online',
      message,
      salonId: salon.id,
    });
  });
}

/**
 * Notifie les fans qu'un hôte favori est en live. Fan-out par lots asynchrones
 * (cf. asyncFanOut) pour ne pas bloquer l'event loop sur les hôtes à forte audience.
 */
export function notifyFavoritesLiveStarted(host: User, live: Live): void {
  const fanIds = getFanIds(host.id);
  const message = `${host.username} est en live !`;
  runInBatchesAsync(fanIds, (fanId) => {
    if (fanId === host.id) return;
    const entry = db.userFavorites.get(fanId)?.get(host.id);
    if (!entry?.notificationsEnabled) return;
    pushNotification({
      recipientId: fanId,
      senderId: host.id,
      senderName: host.username,
      senderAvatarUrl: host.avatarUrl,
      type: 'favorite_online',
      message,
      liveId: live.id,
    });
  });
}
