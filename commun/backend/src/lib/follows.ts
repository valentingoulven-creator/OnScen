import { db, Live, Salon, User } from '../models/schema';
import { pushNotification } from './notifications';

function followingSet(followerId: string): Set<string> {
  let set = db.userFollows.get(followerId);
  if (!set) {
    set = new Set();
    db.userFollows.set(followerId, set);
  }
  return set;
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
}

export function unfollowUser(followerId: string, followingId: string): void {
  followingSet(followerId).delete(followingId);
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

export function notifyFollowersLiveStarted(live: Live, host: User): void {
  const followerIds = getFollowerIds(host.id);
  const message = `${host.username} est en live !`;
  for (const recipientId of followerIds) {
    if (recipientId === host.id) continue;
    pushNotification({
      recipientId,
      senderId: host.id,
      senderName: host.username,
      senderAvatarUrl: host.avatarUrl,
      type: 'live_started',
      message,
      liveId: live.id,
    });
  }
}

export function notifyFollowersSalonCreated(host: User, salon: Salon): void {
  const followerIds = getFollowerIds(host.id);
  const message = `${host.username} a ouvert un salon « ${salon.title} » 🎵`;
  for (const recipientId of followerIds) {
    if (recipientId === host.id) continue;
    pushNotification({
      recipientId,
      senderId: host.id,
      senderName: host.username,
      senderAvatarUrl: host.avatarUrl,
      type: 'salon_created',
      message,
      salonId: salon.id,
      peerUserId: host.id,
    });
  }
}
