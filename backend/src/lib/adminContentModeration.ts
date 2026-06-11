import { db, type FeedPost, type Live, type Salon, type User } from '../models/schema';
import { getAccountStatus, isDevUser } from './accessControl';
import { getIo } from './ioInstance';
import { clearSalonPlaybackData } from './salonPlaybackOps';

export interface AdminCreatorInfo {
  id: string;
  username: string;
  email: string;
  accountStatus: ReturnType<typeof getAccountStatus>;
  city?: string;
  isGhostMode: boolean;
  profileType?: User['profileType'];
}

export function mapAdminCreator(userId: string): AdminCreatorInfo | null {
  const user = db.users.get(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accountStatus: getAccountStatus(user),
    city: user.city,
    isGhostMode: user.isGhostMode,
    profileType: user.profileType,
  };
}

/** Contenu admin-blocked visible uniquement aux comptes dev/admin. */
export function canViewAdminBlockedContent(viewerId: string | undefined): boolean {
  if (!viewerId) return false;
  return isDevUser(db.users.get(viewerId));
}

export function isAdminBlockedSalon(salon: Salon): boolean {
  return salon.adminBlocked === true;
}

export function isAdminBlockedLive(live: Live): boolean {
  return live.adminBlocked === true;
}

export function isAdminBlockedFeedPost(post: FeedPost): boolean {
  return post.adminBlocked === true;
}

export function assertSalonAccessible(salon: Salon, viewerId: string): boolean {
  if (!isAdminBlockedSalon(salon)) return true;
  return canViewAdminBlockedContent(viewerId);
}

export function assertLiveAccessible(live: Live, viewerId: string): boolean {
  if (!isAdminBlockedLive(live)) return true;
  return canViewAdminBlockedContent(viewerId);
}

function trackSummary(platform: Salon['platform'] | Live['platform'], playbackState: Salon['playbackState']) {
  return {
    title: playbackState.title,
    artist: playbackState.artist,
    isPlaying: playbackState.isPlaying,
    platform,
  };
}

export function mapAdminSalonRow(s: Salon) {
  const creator = mapAdminCreator(s.hostId);
  const live = db.lives.get(s.id);
  const host = db.users.get(s.hostId);
  return {
    id: s.id,
    title: s.title,
    platform: s.platform,
    accessMode: s.accessMode,
    isPublic: s.isPublic,
    isGhostMode: s.isGhostMode,
    hostGhostMode: host?.isGhostMode ?? false,
    listenersCount: s.listenersCount,
    latitude: s.latitude,
    longitude: s.longitude,
    createdAt: s.createdAt,
    adminBlocked: isAdminBlockedSalon(s),
    adminBlockedAt: s.adminBlockedAt,
    isLive: !!live?.isActive && !isAdminBlockedLive(live),
    hostId: s.hostId,
    hostName: s.hostName,
    creator,
    allowQueue: s.allowQueue,
    allowedCount: s.accessMode === 'invite' ? Math.max(0, (s.allowedUserIds?.length ?? 1) - 1) : undefined,
    currentTrack: trackSummary(s.platform, s.playbackState),
    city: host?.city,
  };
}

export function mapAdminLiveRow(l: Live) {
  const creator = mapAdminCreator(l.hostId);
  const host = db.users.get(l.hostId);
  const salon = l.salonId ? db.salons.get(l.salonId) : undefined;
  return {
    id: l.id,
    title: l.title,
    platform: l.platform,
    isActive: l.isActive,
    viewersCount: l.viewersCount,
    startedAt: l.startedAt,
    salonId: l.salonId,
    salonTitle: salon?.title,
    adminBlocked: isAdminBlockedLive(l),
    adminBlockedAt: l.adminBlockedAt,
    hostId: l.hostId,
    hostName: l.hostName,
    creator,
    cameraActive: !!l.cameraActive,
    cameraMode: l.cameraMode,
    hostGhostMode: host?.isGhostMode ?? false,
    latitude: l.latitude,
    longitude: l.longitude,
    city: host?.city,
    currentTrack: trackSummary(l.platform, l.playbackState),
  };
}

export function mapAdminEventRow(p: FeedPost) {
  const creator = mapAdminCreator(p.userId);
  const likes = db.feedPostLikes.get(p.id);
  const comments = db.feedPostComments.get(p.id);
  return {
    id: p.id,
    content: p.content,
    eventDate: p.eventDate,
    eventLocation: p.eventLocation,
    eventType: p.eventType,
    createdAt: p.createdAt,
    adminBlocked: isAdminBlockedFeedPost(p),
    adminBlockedAt: p.adminBlockedAt,
    userId: p.userId,
    creator,
    likeCount: likes?.size ?? 0,
    commentCount: comments?.length ?? 0,
    hasImage: !!p.imageUrl,
    hasVideo: !!p.videoUrl,
  };
}

export function adminBlockSalon(salonId: string): Salon | null {
  const salon = db.salons.get(salonId);
  if (!salon) return null;
  salon.adminBlocked = true;
  salon.adminBlockedAt = Date.now();
  db.salons.set(salonId, salon);

  const live = db.lives.get(salonId);
  if (live?.isActive) {
    live.isActive = false;
    live.adminBlocked = true;
    live.adminBlockedAt = Date.now();
    db.lives.set(salonId, live);
    getIo()?.to(`live_${salonId}`).emit('live_ended', { liveId: salonId, reason: 'admin_blocked' });
  }

  getIo()?.to(`salon_${salonId}`).emit('salon_ended', { salonId, reason: 'admin_blocked' });
  return salon;
}

export function adminUnblockSalon(salonId: string): Salon | null {
  const salon = db.salons.get(salonId);
  if (!salon) return null;
  salon.adminBlocked = false;
  salon.adminBlockedAt = undefined;
  db.salons.set(salonId, salon);

  const live = db.lives.get(salonId);
  if (live?.adminBlocked) {
    live.adminBlocked = false;
    live.adminBlockedAt = undefined;
    db.lives.set(salonId, live);
  }
  return salon;
}

export function adminDeleteSalon(salonId: string): boolean {
  const salon = db.salons.get(salonId);
  if (!salon) return false;

  getIo()?.to(`salon_${salonId}`).emit('salon_ended', { salonId, reason: 'admin_deleted' });
  db.salons.delete(salonId);
  db.salonChats.delete(salonId);
  clearSalonPlaybackData(salonId);
  db.salonBans.delete(salonId);

  const live = db.lives.get(salonId);
  if (live) {
    getIo()?.to(`live_${salonId}`).emit('live_ended', { liveId: salonId, reason: 'admin_deleted' });
    db.lives.delete(salonId);
    db.liveChats.delete(salonId);
    db.liveBans.delete(salonId);
  }
  return true;
}

export function adminBlockLive(liveId: string): Live | null {
  const live = db.lives.get(liveId);
  if (!live) return null;
  live.adminBlocked = true;
  live.adminBlockedAt = Date.now();
  if (live.isActive) {
    live.isActive = false;
    getIo()?.to(`live_${liveId}`).emit('live_ended', { liveId, reason: 'admin_blocked' });
  }
  db.lives.set(liveId, live);

  if (live.salonId) {
    const salon = db.salons.get(live.salonId);
    if (salon) {
      salon.adminBlocked = true;
      salon.adminBlockedAt = Date.now();
      db.salons.set(live.salonId, salon);
      getIo()?.to(`salon_${live.salonId}`).emit('salon_ended', { salonId: live.salonId, reason: 'admin_blocked' });
    }
  }
  return live;
}

export function adminUnblockLive(liveId: string): Live | null {
  const live = db.lives.get(liveId);
  if (!live) return null;
  live.adminBlocked = false;
  live.adminBlockedAt = undefined;
  db.lives.set(liveId, live);

  if (live.salonId) {
    const salon = db.salons.get(live.salonId);
    if (salon?.adminBlocked) {
      salon.adminBlocked = false;
      salon.adminBlockedAt = undefined;
      db.salons.set(live.salonId, salon);
    }
  }
  return live;
}

export function adminDeleteLive(liveId: string): boolean {
  const live = db.lives.get(liveId);
  if (!live) return false;
  getIo()?.to(`live_${liveId}`).emit('live_ended', { liveId, reason: 'admin_deleted' });
  db.lives.delete(liveId);
  db.liveChats.delete(liveId);
  db.liveBans.delete(liveId);
  return true;
}

export function adminBlockEvent(postId: string): FeedPost | null {
  const post = db.feedPosts.find((p) => p.id === postId && p.isEvent);
  if (!post) return null;
  post.adminBlocked = true;
  post.adminBlockedAt = Date.now();
  return post;
}

export function adminUnblockEvent(postId: string): FeedPost | null {
  const post = db.feedPosts.find((p) => p.id === postId && p.isEvent);
  if (!post) return null;
  post.adminBlocked = false;
  post.adminBlockedAt = undefined;
  return post;
}

export function adminDeleteEvent(postId: string): boolean {
  const idx = db.feedPosts.findIndex((p) => p.id === postId && p.isEvent);
  if (idx === -1) return false;
  db.feedPosts.splice(idx, 1);
  db.feedPosts = db.feedPosts.filter((p) => p.resharedFromId !== postId);
  db.feedPostLikes.delete(postId);
  db.feedPostComments.delete(postId);
  for (const favs of db.feedPostFavorites.values()) {
    favs.delete(postId);
  }
  db.notifications = db.notifications.filter((n) => n.postId !== postId);
  return true;
}
