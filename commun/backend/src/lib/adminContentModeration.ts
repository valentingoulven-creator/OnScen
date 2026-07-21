import { db, type FeedPost, type Live, type Salon, type User, type UserReel } from '../models/schema';
import { getAccountStatus, isDevUser } from './accessControl';
import { getIo } from './ioInstance';
import { clearSalonPlaybackData } from './salonPlaybackOps';
import { endLiveSession, broadcastLiveEnded } from './liveArchive';
import { schedulePersist } from './persist';
import { schedulePersistReelToPg } from './pgReels';
import { invalidateReelsFeedCache } from './reelFeedCache';
import { scheduleDeleteFeedPostFromPg, schedulePersistFeedPostToPg } from './pgFeedPosts';
import {
  deleteLiveFromPgAsync,
  markSalonInactivePgAsync,
  persistLiveToPgAsync,
  upsertSalonToPgAsync,
} from './pgSalonsLives';
import {
  isAdminBlockedReel,
  isPrivateReel,
  purgeReelById,
  reelStats,
  reelVisibility,
} from './reels';

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

function persistSalonModerationToPg(salon: Salon): void {
  upsertSalonToPgAsync(salon);
}

function persistLiveModerationToPg(live: Live): void {
  persistLiveToPgAsync(live);
}

function persistLinkedSalonForLive(live: Live): void {
  if (!live.salonId) return;
  const salon = db.salons.get(live.salonId);
  if (salon) persistSalonModerationToPg(salon);
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

function isDonationGift(gift: { giftType: string; amount: number }): boolean {
  return gift.giftType === 'don' && Number.isFinite(gift.amount) && gift.amount > 0;
}

function getLiveDonationStats(liveId: string): { count: number; totalEur: number } {
  const gifts = db.gifts.filter((g) => g.liveId === liveId && isDonationGift(g));
  const totalCents = gifts.reduce((sum, g) => sum + Math.trunc(g.amount) * 100, 0);
  return { count: gifts.length, totalEur: totalCents / 100 };
}

function getChatMessageCount(roomId: string, kind: 'salon' | 'live'): number {
  const map = kind === 'salon' ? db.salonChats : db.liveChats;
  return map.get(roomId)?.length ?? 0;
}

function getBanCount(roomId: string, kind: 'salon' | 'live'): number {
  const map = kind === 'salon' ? db.salonBans : db.liveBans;
  return map.get(roomId)?.size ?? 0;
}

function liveDurationMs(l: Live, now = Date.now()): number {
  if (!l.startedAt) return 0;
  const end = l.isActive ? now : l.endedAt ?? now;
  return Math.max(0, end - l.startedAt);
}

export function mapAdminSalonRow(s: Salon) {
  const creator = mapAdminCreator(s.hostId);
  const live = db.lives.get(s.id);
  const host = db.users.get(s.hostId);
  const linkedDonations = live ? getLiveDonationStats(live.id) : { count: 0, totalEur: 0 };
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
    genres: s.genres ?? [],
    chatMessageCount: getChatMessageCount(s.id, 'salon'),
    queueLength: db.salonQueues.get(s.id)?.length ?? 0,
    banCount: getBanCount(s.id, 'salon'),
    vipModeratorCount: s.vipModeratorIds?.length ?? 0,
    linkedLiveViewers: live?.viewersCount,
    linkedLivePeakViewers: live?.peakViewersCount,
    linkedLiveDonationsCount: linkedDonations.count,
    linkedLiveDonationsTotalEur: linkedDonations.totalEur,
    linkedLiveDurationMs: live ? liveDurationMs(live) : undefined,
  };
}

export function mapAdminLiveRow(l: Live) {
  const creator = mapAdminCreator(l.hostId);
  const host = db.users.get(l.hostId);
  const salon = l.salonId ? db.salons.get(l.salonId) : undefined;
  const donations = getLiveDonationStats(l.id);
  return {
    id: l.id,
    title: l.title,
    platform: l.platform,
    isActive: l.isActive,
    viewersCount: l.viewersCount,
    peakViewersCount: l.peakViewersCount ?? l.viewersCount,
    startedAt: l.startedAt,
    endedAt: l.endedAt,
    durationMs: liveDurationMs(l),
    salonId: l.salonId,
    salonTitle: salon?.title,
    salonListenersCount: salon?.listenersCount,
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
    chatMessageCount: getChatMessageCount(l.id, 'live'),
    banCount: getBanCount(l.id, 'live'),
    vipModeratorCount: l.vipModeratorIds?.length ?? 0,
    donationsCount: donations.count,
    donationsTotalEur: donations.totalEur,
    streamMode: l.streamMode,
    tipsEnabled: l.tipsEnabled !== false,
    contentCategory: l.contentCategory,
    donationOptionsCount: l.donationOptions?.length ?? 0,
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
    eventDates: p.eventDates,
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
    live.adminBlocked = true;
    live.adminBlockedAt = Date.now();
    endLiveSession(live, Date.now(), { reason: 'admin_blocked' });
  }

  getIo()?.to(`salon_${salonId}`).emit('salon_ended', { salonId, reason: 'admin_blocked' });
  persistSalonModerationToPg(salon);
  const blockedLive = db.lives.get(salonId);
  if (blockedLive) persistLiveModerationToPg(blockedLive);
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
  persistSalonModerationToPg(salon);
  if (live) persistLiveModerationToPg(live);
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
    broadcastLiveEnded(live, 'admin_deleted');
    db.lives.delete(salonId);
    db.liveChats.delete(salonId);
    db.liveBans.delete(salonId);
  }
  markSalonInactivePgAsync(salonId);
  deleteLiveFromPgAsync(salonId);
  return true;
}

export function adminBlockLive(liveId: string): Live | null {
  const live = db.lives.get(liveId);
  if (!live) return null;
  live.adminBlocked = true;
  live.adminBlockedAt = Date.now();
  if (live.isActive) {
    endLiveSession(live, Date.now(), { reason: 'admin_blocked' });
  } else {
    db.lives.set(liveId, live);
    schedulePersist();
  }

  if (live.salonId) {
    const salon = db.salons.get(live.salonId);
    if (salon) {
      salon.adminBlocked = true;
      salon.adminBlockedAt = Date.now();
      db.salons.set(live.salonId, salon);
      getIo()?.to(`salon_${live.salonId}`).emit('salon_ended', { salonId: live.salonId, reason: 'admin_blocked' });
    }
  }
  persistLiveModerationToPg(live);
  persistLinkedSalonForLive(live);
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
  persistLiveModerationToPg(live);
  persistLinkedSalonForLive(live);
  return live;
}

export function adminDeleteLive(liveId: string): boolean {
  const live = db.lives.get(liveId);
  if (!live) return false;
  broadcastLiveEnded(live, 'admin_deleted');
  db.lives.delete(liveId);
  db.liveChats.delete(liveId);
  db.liveBans.delete(liveId);
  deleteLiveFromPgAsync(liveId);
  return true;
}

export function adminBlockEvent(postId: string): FeedPost | null {
  const post = db.feedPosts.find((p) => p.id === postId && p.isEvent);
  if (!post) return null;
  post.adminBlocked = true;
  post.adminBlockedAt = Date.now();
  schedulePersistFeedPostToPg(post);
  return post;
}

export function adminUnblockEvent(postId: string): FeedPost | null {
  const post = db.feedPosts.find((p) => p.id === postId && p.isEvent);
  if (!post) return null;
  post.adminBlocked = false;
  post.adminBlockedAt = undefined;
  schedulePersistFeedPostToPg(post);
  return post;
}

export function adminDeleteEvent(postId: string): boolean {
  const idx = db.feedPosts.findIndex((p) => p.id === postId && p.isEvent);
  if (idx === -1) return false;
  const resharedIds = db.feedPosts.filter((p) => p.resharedFromId === postId).map((p) => p.id);
  db.feedPosts.splice(idx, 1);
  db.feedPosts = db.feedPosts.filter((p) => p.resharedFromId !== postId);
  db.feedPostLikes.delete(postId);
  db.feedPostUpvotes.delete(postId);
  db.feedPostComments.delete(postId);
  for (const favs of db.feedPostFavorites.values()) {
    favs.delete(postId);
  }
  db.notifications = db.notifications.filter((n) => n.postId !== postId);
  scheduleDeleteFeedPostFromPg(postId);
  for (const id of resharedIds) {
    scheduleDeleteFeedPostFromPg(id);
  }
  return true;
}

export function mapAdminReelRow(r: UserReel) {
  const creator = mapAdminCreator(r.authorId);
  const stats = reelStats(r.id);
  const legacyMediaUrl = (r as UserReel & { mediaUrl?: string }).mediaUrl;
  const posterUrl =
    r.posterUrl ||
    (r.mediaType === 'image' ? legacyMediaUrl : undefined) ||
    r.videoUrl ||
    '';
  const caption = [r.title, r.artist].filter(Boolean).join(' — ') || r.title;
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    genre: r.genre,
    caption,
    posterUrl,
    videoUrl: r.videoUrl,
    mediaType: r.mediaType,
    visibility: reelVisibility(r),
    isPrivate: isPrivateReel(r),
    createdAt: r.createdAt,
    authorId: r.authorId,
    creator,
    adminBlocked: isAdminBlockedReel(r),
    adminBlockedAt: r.adminBlockedAt,
    viewCount: stats.viewCount,
    heartCount: stats.heartCount,
    commentCount: stats.commentCount,
    shareCount: stats.shareCount,
  };
}

export function adminBlockReel(reelId: string): UserReel | null {
  const reel = db.userReels.find((r) => r.id === reelId);
  if (!reel) return null;
  reel.adminBlocked = true;
  reel.adminBlockedAt = Date.now();
  schedulePersistReelToPg(reel);
  invalidateReelsFeedCache();
  return reel;
}

export function adminUnblockReel(reelId: string): UserReel | null {
  const reel = db.userReels.find((r) => r.id === reelId);
  if (!reel) return null;
  reel.adminBlocked = false;
  reel.adminBlockedAt = undefined;
  schedulePersistReelToPg(reel);
  invalidateReelsFeedCache();
  return reel;
}

export function adminDeleteReel(reelId: string): boolean {
  return purgeReelById(reelId);
}
