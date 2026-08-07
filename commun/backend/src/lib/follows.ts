import { db, Live, Salon, User } from '../models/schema';
import { notifyFollowersCreatorActivity } from './followActivityNotifications';

function followingSet(followerId: string): Set<string> {
  let set = db.userFollows.get(followerId);
  if (!set) {
    set = new Set();
    db.userFollows.set(followerId, set);
  }
  return set;
}

function prefsMap(followerId: string): Map<string, boolean> {
  let map = db.userFollowNotificationPrefs.get(followerId);
  if (!map) {
    map = new Map();
    db.userFollowNotificationPrefs.set(followerId, map);
  }
  return map;
}

export function isFollowing(followerId: string, followingId: string): boolean {
  if (followerId === followingId) return false;
  return followingSet(followerId).has(followingId);
}

/** Both users follow each other (required for private messages). */
export function isMutualFollow(userA: string, userB: string): boolean {
  return isFollowing(userA, userB) && isFollowing(userB, userA);
}

export function followUser(followerId: string, followingId: string): void {
  followingSet(followerId).add(followingId);
  prefsMap(followerId).set(followingId, true);
}

export function unfollowUser(followerId: string, followingId: string): void {
  followingSet(followerId).delete(followingId);
  db.userFollowNotificationPrefs.get(followerId)?.delete(followingId);
}

export function getFollowingIds(followerId: string): string[] {
  return [...followingSet(followerId)];
}

export function getFollowerIds(hostId: string): string[] {
  const ids: string[] = [];
  for (const [followerId, set] of db.userFollows) {
    if (set.has(hostId)) ids.push(followerId);
  }
  return ids;
}

/** Activité passive (salon, live, contenu) — pas les DM / tags. */
export function isFollowActivityNotificationsEnabled(followerId: string, followingId: string): boolean {
  if (!isFollowing(followerId, followingId)) return false;
  return prefsMap(followerId).get(followingId) !== false;
}

export function setFollowActivityNotifications(
  followerId: string,
  followingId: string,
  enabled: boolean
): void {
  if (!isFollowing(followerId, followingId)) {
    throw new Error('NOT_FOLLOWING');
  }
  prefsMap(followerId).set(followingId, enabled);
}

export function getFollowActivityRecipientIds(creatorId: string): string[] {
  const ids: string[] = [];
  for (const [followerId, set] of db.userFollows) {
    if (!set.has(creatorId) || followerId === creatorId) continue;
    if (!isFollowActivityNotificationsEnabled(followerId, creatorId)) continue;
    ids.push(followerId);
  }
  return ids;
}

export function snapshotFollowNotificationPrefs(): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [followerId, map] of db.userFollowNotificationPrefs) {
    if (map.size === 0) continue;
    out[followerId] = Object.fromEntries(map.entries());
  }
  return out;
}

export function restoreFollowNotificationPrefs(
  data: Record<string, Record<string, boolean>> | undefined
): void {
  db.userFollowNotificationPrefs.clear();
  if (!data) return;
  for (const [followerId, edges] of Object.entries(data)) {
    const map = new Map<string, boolean>();
    for (const [followingId, enabled] of Object.entries(edges ?? {})) {
      if (typeof enabled === 'boolean') map.set(followingId, enabled);
    }
    if (map.size) db.userFollowNotificationPrefs.set(followerId, map);
  }
}

export function notifyFollowersLiveStarted(live: Live, host: User): void {
  notifyFollowersCreatorActivity({
    creator: host,
    type: 'live_started',
    message: `${host.username} est en live !`,
    liveId: live.id,
  });
}

export function notifyFollowersSalonCreated(host: User, salon: Salon): void {
  notifyFollowersCreatorActivity({
    creator: host,
    type: 'salon_created',
    message: `${host.username} a ouvert un salon « ${salon.title} » 🎵`,
    salonId: salon.id,
  });
}
