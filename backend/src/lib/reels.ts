import { db, ReelComment, ReelVisibility, UserReel } from '../models/schema';
import {
  applyFeedRanking,
  BUILTIN_ALGORITHM_WEIGHTS,
  type ReelFeedAlgorithmPreferences,
} from './reelFeedRanking';
import { REEL_CATALOG_ENTRIES } from './reelsDemoCatalog';
import { getFollowingIds } from './follows';
import { isDevUser } from './accessControl';
import {
  MAX_RECORDED_REEL_VIDEO_DATA_CHARS,
  REEL_UPLOAD_MAX_FILE_BYTES,
} from './reelUploadLimits';
import {
  scheduleDeleteReelFromPg,
  schedulePersistReelComment,
  schedulePersistReelLike,
  schedulePersistReelShare,
  schedulePersistReelToPg,
  schedulePersistReelView,
} from './pgReels';

/** Durées approximatives Mixkit — alignées sur app/src/content/reels.ts */
const MIXKIT_DURATION_SEC: Record<number, number> = {
  483: 16,
  830: 11,
  427: 36,
  44147: 21,
  5035: 19,
  4188: 23,
  42824: 19,
  33936: 15,
  425: 30,
  4344: 13,
  344: 14,
};

function mixkit(id: number): { videoUrl: string; posterUrl: string; durationSec?: number } {
  const base = `https://assets.mixkit.co/videos/${id}`;
  const durationSec = MIXKIT_DURATION_SEC[id];
  return {
    videoUrl: `${base}/${id}-720.mp4`,
    posterUrl: `${base}/${id}-thumb-720-0.jpg`,
    ...(durationSec != null ? { durationSec } : {}),
  };
}

function mixkitMusic(id: number): { audioUrl: string; hasAudio: true } {
  return {
    audioUrl: `https://assets.mixkit.co/music/${id}/${id}.mp3`,
    hasAudio: true,
  };
}

/** Démos publiques — alignées sur app/src/content/reels.ts (MUSIC_REELS) */
export const DEMO_REELS = REEL_CATALOG_ENTRIES.map((entry) => ({
  id: entry.id,
  title: entry.title,
  artist: entry.artist,
  genre: entry.genre,
  mediaType: 'video' as const,
  ...mixkit(entry.videoId),
  ...mixkitMusic(entry.musicId),
}));

export type PublicReel =
  | ReturnType<typeof publicUserReel>
  | (typeof DEMO_REELS)[number];

/** IDs des reels démo (alignés sur app/src/content/reels.ts) */
export const VALID_REEL_IDS = new Set(DEMO_REELS.map((r) => r.id));

const MIXKIT_VIDEO_RE =
  /^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+(-720)?\.mp4(?:\?.*)?$/i;
const MIXKIT_POSTER_RE =
  /^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-thumb-720-0\.jpg(?:\?.*)?$/i;
const MIXKIT_MUSIC_RE =
  /^https:\/\/assets\.mixkit\.co\/music\/\d+\/\d+\.mp3(?:\?.*)?$/i;
const UNSPLASH_IMAGE_RE = /^https:\/\/images\.unsplash\.com\//i;
const BLOCKED_MEDIA_RE =
  /picsum\.photos|commondatastorage|sample-videos|w3schools|mdn\.sample|placeholder\.com|loremflickr/i;

function isCuratedAudioUrl(url: string): boolean {
  return MIXKIT_MUSIC_RE.test(url.trim());
}

export function reelHasPlayableAudio(reel: {
  hasAudio?: boolean;
  audioUrl?: string;
  mediaType?: string;
  videoUrl?: string;
}): boolean {
  if (reel.hasAudio === false) return false;
  const audioUrl = reel.audioUrl?.trim() ?? '';
  if (audioUrl && isCuratedAudioUrl(audioUrl)) return true;
  if (reel.hasAudio === true && reel.mediaType === 'video' && !!reel.videoUrl) return true;
  if (isRecordedReelMedia(reel)) return true;
  return false;
}

export function isPublicFeedReel(reel: {
  mediaType?: string;
  videoUrl?: string;
  audioUrl?: string;
  posterUrl?: string;
  hasAudio?: boolean;
}): boolean {
  if (reel.mediaType === 'image' || (!reel.videoUrl?.trim() && !reel.audioUrl?.trim())) return false;
  if (!isCuratedReelMedia(reel) && !isRecordedReelMedia(reel)) return false;
  return reelHasPlayableAudio(reel);
}

export function isCuratedReelMedia(reel: {
  mediaType?: string;
  videoUrl?: string;
  posterUrl?: string;
  audioUrl?: string;
}): boolean {
  const video = reel.videoUrl?.trim() ?? '';
  const poster = reel.posterUrl?.trim() ?? '';
  const audio = reel.audioUrl?.trim() ?? '';
  if (BLOCKED_MEDIA_RE.test(video) || BLOCKED_MEDIA_RE.test(poster) || BLOCKED_MEDIA_RE.test(audio)) {
    return false;
  }
  if (audio && !isCuratedAudioUrl(audio)) return false;
  if (reel.mediaType === 'image' || (!video && poster)) {
    return UNSPLASH_IMAGE_RE.test(poster);
  }
  return (
    MIXKIT_VIDEO_RE.test(video) &&
    (!poster || MIXKIT_POSTER_RE.test(poster) || UNSPLASH_IMAGE_RE.test(poster))
  );
}

function canonicalPublicReel(reel: ReturnType<typeof publicUserReel>): ReturnType<typeof publicUserReel> | null {
  const demo = DEMO_REELS.find((d) => d.id === reel.id);
  if (demo) {
    const videoUrl = 'videoUrl' in demo ? demo.videoUrl : undefined;
    const audioUrl = 'audioUrl' in demo ? demo.audioUrl : undefined;
    return {
      id: demo.id,
      title: demo.title,
      artist: demo.artist,
      genre: demo.genre,
      mediaType: demo.mediaType,
      videoUrl,
      posterUrl: demo.posterUrl,
      ...(audioUrl ? { audioUrl } : {}),
      ...('hasAudio' in demo && demo.hasAudio ? { hasAudio: true as const } : {}),
      ...('durationSec' in demo && demo.durationSec != null ? { durationSec: demo.durationSec } : {}),
      authorId: reel.authorId,
      createdAt: reel.createdAt,
      visibility: 'public' as const,
      isPrivate: false,
      viewCount: getReelViews(demo.id).size,
    };
  }
  return isAllowedUserReelMedia(reel) ? reel : null;
}

export function isValidReelId(reelId: string): boolean {
  return VALID_REEL_IDS.has(reelId) || db.userReels.some((r) => r.id === reelId);
}

export function getUserReel(reelId: string): UserReel | undefined {
  return db.userReels.find((r) => r.id === reelId);
}

export function isUserOwnedReel(reelId: string): boolean {
  return db.userReels.some((r) => r.id === reelId);
}

export function reelVisibility(r: UserReel): ReelVisibility {
  return r.visibility === 'private' ? 'private' : 'public';
}

export function isPrivateReel(r: UserReel): boolean {
  return reelVisibility(r) === 'private';
}

export function isAdminBlockedReel(r: UserReel): boolean {
  return r.adminBlocked === true;
}

function reelVisibleToViewer(reel: UserReel, viewerId?: string): boolean {
  if (!isAdminBlockedReel(reel)) return true;
  if (viewerId != null && viewerId === reel.authorId) return true;
  if (!viewerId) return false;
  return isDevUser(db.users.get(viewerId));
}

function enrichReelWithAuthor<T extends { authorId?: string }>(
  reel: T
): T & {
  authorUsername?: string;
  authorAvatarUrl?: string;
  authorUsernameColor?: string;
  authorUsernameWaveFrom?: string;
  authorUsernameWaveTo?: string;
} {
  const authorId = reel.authorId?.trim();
  if (!authorId) return reel;
  const user = db.users.get(authorId);
  if (!user) return reel;
  return {
    ...reel,
    authorUsername: user.username,
    authorAvatarUrl: user.avatarUrl,
    authorUsernameColor: user.usernameColor,
    authorUsernameWaveFrom: user.usernameWaveFrom,
    authorUsernameWaveTo: user.usernameWaveTo,
  };
}

export function publicUserReel(r: UserReel) {
  const legacyMediaUrl = (r as UserReel & { mediaUrl?: string }).mediaUrl;
  const videoUrl = r.videoUrl ?? (r.mediaType === 'video' ? legacyMediaUrl : undefined);
  const posterUrl =
    r.posterUrl ||
    (r.mediaType === 'image' ? legacyMediaUrl : undefined) ||
    videoUrl ||
    '';
  const visibility = reelVisibility(r);
  const isPrivate = visibility === 'private';
  const recorded = isRecordedReelMedia({ mediaType: r.mediaType, videoUrl, posterUrl });
  return enrichReelWithAuthor({
    id: r.id,
    title: r.title,
    artist: r.artist,
    genre: r.genre,
    mediaType: r.mediaType,
    videoUrl,
    posterUrl,
    ...(recorded ? { hasAudio: true as const } : {}),
    ...(r.durationSec != null && r.durationSec > 0 ? { durationSec: r.durationSec } : {}),
    authorId: r.authorId,
    createdAt: r.createdAt,
    visibility,
    isPrivate,
    viewCount: getReelViews(r.id).size,
  });
}

function sortAuthorReels(reels: UserReel[]): UserReel[] {
  return reels.slice().sort((a, b) => b.createdAt - a.createdAt);
}

/** Profil : publics pour tous ; privés uniquement pour le propriétaire (viewerId). */
export function listReelsByAuthor(
  authorId: string,
  viewerId?: string
): ReturnType<typeof publicUserReel>[] {
  const isOwner = viewerId != null && viewerId === authorId;
  return sortAuthorReels(db.userReels.filter((r) => r.authorId === authorId))
    .filter((r) => (isOwner || !isPrivateReel(r)) && reelVisibleToViewer(r, viewerId))
    .map(publicUserReel);
}

export function listPrivateReelsByAuthor(authorId: string): ReturnType<typeof publicUserReel>[] {
  return sortAuthorReels(db.userReels.filter((r) => r.authorId === authorId && isPrivateReel(r))).map(
    publicUserReel
  );
}

export function listPublishedReelsByAuthor(authorId: string): ReturnType<typeof publicUserReel>[] {
  return sortAuthorReels(db.userReels.filter((r) => r.authorId === authorId && !isPrivateReel(r))).map(
    publicUserReel
  );
}

/** Reels publiés par l'utilisateur connecté (pas les démos statiques). */
export function listUserCreatedReels(authorId: string): ReturnType<typeof publicUserReel>[] {
  return listReelsByAuthor(authorId, authorId);
}

export function getAccessibleUserReel(
  reelId: string,
  viewerId?: string
): ReturnType<typeof publicUserReel> | null {
  const owned = getUserReel(reelId);
  if (owned) {
    const isOwner = viewerId != null && viewerId === owned.authorId;
    if (!isOwner && isPrivateReel(owned)) return null;
    if (!reelVisibleToViewer(owned, viewerId)) return null;
    return publicUserReel(owned);
  }
  const demo = DEMO_REELS.find((d) => d.id === reelId);
  if (!demo) return null;
  const videoUrl = 'videoUrl' in demo ? demo.videoUrl : undefined;
  const audioUrl = 'audioUrl' in demo ? demo.audioUrl : undefined;
  return {
    id: demo.id,
    title: demo.title,
    artist: demo.artist,
    genre: demo.genre,
    mediaType: demo.mediaType,
    videoUrl,
    posterUrl: demo.posterUrl,
    ...(audioUrl ? { audioUrl } : {}),
    ...('hasAudio' in demo && demo.hasAudio ? { hasAudio: true as const } : {}),
    ...('durationSec' in demo && demo.durationSec != null ? { durationSec: demo.durationSec } : {}),
    authorId: '',
    createdAt: 0,
    visibility: 'public' as ReelVisibility,
    viewCount: getReelViews(demo.id).size,
    isPrivate: false,
  };
}

/** Flux public : reels utilisateur publiés + démos, triés selon l’algorithme choisi. */
export function buildReelsFeed(
  viewerId?: string,
  algoPrefs?: ReelFeedAlgorithmPreferences | null
): PublicReel[] {
  const userReels = db.userReels
    .filter((r) => !isPrivateReel(r) && reelVisibleToViewer(r, viewerId))
    .slice()
    .map(publicUserReel)
    .map(canonicalPublicReel)
    .filter((r): r is ReturnType<typeof publicUserReel> => r != null)
    .filter(isPublicFeedReel);
  const ids = new Set(userReels.map((r) => r.id));
  const demos = DEMO_REELS.filter((r) => !ids.has(r.id) && isPublicFeedReel(r));
  let feed: PublicReel[] = [...userReels, ...demos];
  if (feed.length === 0) feed = DEMO_REELS.filter(isPublicFeedReel);

  const algo = algoPrefs ?? { useBuiltInAlgorithm: true, weights: BUILTIN_ALGORITHM_WEIGHTS };

  if (viewerId) {
    const followedIds = new Set(getFollowingIds(viewerId));
    if (followedIds.size > 0) {
      const authorIdOf = (r: PublicReel): string => {
        const rec = r as Record<string, unknown>;
        return typeof rec['authorId'] === 'string' ? rec['authorId'] : '';
      };
      const followed = feed.filter((r) => followedIds.has(authorIdOf(r)));
      const rest = feed.filter((r) => !followedIds.has(authorIdOf(r)));
      return [...applyFeedRanking(followed, algo), ...applyFeedRanking(rest, algo)];
    }
  }

  return applyFeedRanking(feed, algo);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Vidéo importée/enregistrée côté client (data URL) — plafond TikTok ~287 MiB brut. */
const RECORDED_VIDEO_DATA_RE =
  /^data:video\/(webm|mp4|quicktime|x-m4v)(?:;[^;,]+)*;base64,[A-Za-z0-9+/=]+$/;
const RECORDED_POSTER_DATA_RE = /^data:image\/(jpeg|png|webp)(?:;[^;,]+)*;base64,[A-Za-z0-9+/=]+$/;
const MAX_RECORDED_VIDEO_CHARS = MAX_RECORDED_REEL_VIDEO_DATA_CHARS;
const MAX_RECORDED_POSTER_CHARS = 220_000;
const REEL_UPLOAD_MAX_FILE_MB = Math.round(REEL_UPLOAD_MAX_FILE_BYTES / (1024 * 1024));

export function isRecordedReelVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!RECORDED_VIDEO_DATA_RE.test(trimmed)) return false;
  return trimmed.length <= MAX_RECORDED_VIDEO_CHARS;
}

export function isRecordedReelPosterUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!RECORDED_POSTER_DATA_RE.test(trimmed)) return false;
  return trimmed.length <= MAX_RECORDED_POSTER_CHARS;
}

function isAllowedMediaUrl(value: string): boolean {
  return isHttpUrl(value) || isRecordedReelVideoUrl(value);
}

function isAllowedPosterUrl(value: string): boolean {
  return isHttpUrl(value) || isRecordedReelPosterUrl(value);
}

export function isRecordedReelMedia(reel: {
  mediaType?: string;
  videoUrl?: string;
  posterUrl?: string;
}): boolean {
  const video = reel.videoUrl?.trim() ?? '';
  if (!video || !isRecordedReelVideoUrl(video)) return false;
  const poster = reel.posterUrl?.trim() ?? '';
  if (poster && !isRecordedReelPosterUrl(poster)) return false;
  return reel.mediaType !== 'image';
}

export function isAllowedUserReelMedia(reel: {
  mediaType?: string;
  videoUrl?: string;
  posterUrl?: string;
}): boolean {
  return isCuratedReelMedia(reel) || isRecordedReelMedia(reel);
}

export interface CreateUserReelInput {
  title: string;
  artist: string;
  genre: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  posterUrl?: string;
  durationSec?: number;
  visibility?: ReelVisibility;
  /** Alias pratique : true = reel privé (profil uniquement) */
  isPrivate?: boolean;
}

function resolveReelVisibility(input: CreateUserReelInput): ReelVisibility {
  if (input.visibility === 'private' || input.isPrivate === true) return 'private';
  if (input.visibility === 'public' || input.isPrivate === false) return 'public';
  return 'public';
}

function isDataUrl(value: string): boolean {
  return /^data:(video|image)\//i.test(value.trim());
}

const MAX_PRIVATE_VIDEO_CHARS = MAX_RECORDED_VIDEO_CHARS;
const MAX_PRIVATE_POSTER_CHARS = MAX_RECORDED_POSTER_CHARS;

function isAllowedPrivateMedia(draft: {
  mediaType: string;
  videoUrl?: string;
  posterUrl?: string;
}): boolean {
  const video = draft.videoUrl?.trim() ?? '';
  const poster = draft.posterUrl?.trim() ?? '';
  if (draft.mediaType === 'image' || (!video && poster)) {
    if (!isDataUrl(poster) && !UNSPLASH_IMAGE_RE.test(poster)) return false;
    if (isDataUrl(poster) && poster.length > MAX_PRIVATE_POSTER_CHARS) return false;
    return true;
  }
  if (!isDataUrl(video) || video.length > MAX_PRIVATE_VIDEO_CHARS) return false;
  if (poster && !UNSPLASH_IMAGE_RE.test(poster)) {
    if (!isDataUrl(poster) || poster.length > MAX_PRIVATE_POSTER_CHARS) return false;
  }
  return true;
}

function normalizeDurationSec(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.round(value), 24 * 60 * 60);
}

export function createUserReel(authorId: string, input: CreateUserReelInput): UserReel | { error: string } {
  const title = input.title.trim();
  const artist = input.artist.trim();
  const genre = input.genre.trim();
  const mediaUrl = input.mediaUrl.trim();
  const posterUrl = input.posterUrl?.trim();

  if (!title || !artist || !genre) {
    return { error: 'Champs requis manquants: title, artist, genre' };
  }
  if (!isAllowedMediaUrl(mediaUrl)) {
    return { error: 'URL média invalide' };
  }
  if (posterUrl && !isAllowedPosterUrl(posterUrl)) {
    return { error: 'URL poster invalide' };
  }
  if (input.mediaType === 'image' && isRecordedReelVideoUrl(mediaUrl)) {
    return { error: 'Les enregistrements caméra doivent être publiés en vidéo' };
  }

  const mediaType = input.mediaType === 'image' ? 'image' : 'video';
  const visibility = resolveReelVisibility(input);
  const draft = {
    mediaType,
    videoUrl: mediaType === 'video' ? mediaUrl : undefined,
    posterUrl: mediaType === 'image' ? mediaUrl : posterUrl || mediaUrl,
  };
  const mediaOk =
    visibility === 'private'
      ? isAllowedPrivateMedia(draft) || isAllowedUserReelMedia(draft)
      : isAllowedUserReelMedia(draft);
  if (!mediaOk) {
    return {
      error:
        visibility === 'private'
          ? `Média invalide pour un reel privé (vidéo ou image, max ~${REEL_UPLOAD_MAX_FILE_MB} Mo)`
          : `Média non autorisé : vidéo Mixkit, image Unsplash, ou enregistrement caméra (max ~${REEL_UPLOAD_MAX_FILE_MB} Mo)`,
    };
  }
  if (
    visibility === 'public' &&
    !isPublicFeedReel({
      ...draft,
      hasAudio: isRecordedReelMedia(draft) ? true : undefined,
    })
  ) {
    return {
      error: 'Seuls les reels vidéo avec piste audio peuvent être publiés dans le flux Reels',
    };
  }
  const durationSec =
    mediaType === 'video' ? normalizeDurationSec(input.durationSec) : undefined;

  const reel: UserReel = {
    id: `reel-user-${authorId}-${Date.now()}`,
    title: title.slice(0, 120),
    artist: artist.slice(0, 120),
    genre: genre.slice(0, 80),
    mediaType,
    authorId,
    createdAt: Date.now(),
    posterUrl: mediaType === 'image' ? mediaUrl : posterUrl || mediaUrl,
    videoUrl: mediaType === 'video' ? mediaUrl : undefined,
    visibility,
    ...(durationSec != null ? { durationSec } : {}),
  };

  db.userReels.push(reel);
  schedulePersistReelToPg(reel);
  return reel;
}

export function publishUserReel(reelId: string, userId: string): UserReel | { error: string } {
  const reel = db.userReels.find((r) => r.id === reelId && r.authorId === userId);
  if (!reel) return { error: 'Reel introuvable' };
  if (!isPrivateReel(reel)) return { error: 'Ce reel est déjà public' };
  const draft = {
    mediaType: reel.mediaType,
    videoUrl: reel.videoUrl,
    posterUrl: reel.posterUrl,
  };
  if (!isAllowedUserReelMedia(draft)) {
    return {
      error:
        'Impossible de publier ce média dans le flux public (Mixkit, Unsplash ou enregistrement caméra requis)',
    };
  }
  if (!isPublicFeedReel({ ...draft, hasAudio: isRecordedReelMedia(draft) ? true : undefined })) {
    return {
      error: 'Seuls les reels avec piste audio peuvent être publiés dans le flux Reels',
    };
  }
  reel.visibility = 'public';
  schedulePersistReelToPg(reel);
  return reel;
}

export function purgeReelById(reelId: string): boolean {
  const index = db.userReels.findIndex((r) => r.id === reelId);
  if (index < 0) return false;
  db.userReels.splice(index, 1);
  db.reelLikes.delete(reelId);
  db.reelComments.delete(reelId);
  db.reelShares.delete(reelId);
  db.reelViews.delete(reelId);
  scheduleDeleteReelFromPg(reelId);
  return true;
}

export function deleteUserReel(reelId: string, userId: string): boolean {
  const index = db.userReels.findIndex((r) => r.id === reelId && r.authorId === userId);
  if (index < 0) return false;
  return purgeReelById(reelId);
}

export function getReelLikes(reelId: string): Set<string> {
  let likes = db.reelLikes.get(reelId);
  if (!likes) {
    likes = new Set();
    db.reelLikes.set(reelId, likes);
  }
  return likes;
}

export function toggleReelHeart(reelId: string, userId: string): { liked: boolean; heartCount: number } {
  const likes = getReelLikes(reelId);
  if (likes.has(userId)) {
    likes.delete(userId);
  } else {
    likes.add(userId);
  }
  const liked = likes.has(userId);
  schedulePersistReelLike(reelId, userId, liked);
  return { liked, heartCount: likes.size };
}

export function getReelComments(reelId: string): ReelComment[] {
  return db.reelComments.get(reelId) ?? [];
}

export function addReelComment(
  reelId: string,
  userId: string,
  username: string,
  avatarUrl: string | undefined,
  content: string
): ReelComment {
  const comment: ReelComment = {
    id: `reelcmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reelId,
    userId,
    username,
    avatarUrl,
    content,
    createdAt: Date.now(),
  };
  const list = getReelComments(reelId);
  list.push(comment);
  db.reelComments.set(reelId, list);
  schedulePersistReelComment(comment);
  return comment;
}

export function getReelShares(reelId: string): Set<string> {
  let shares = db.reelShares.get(reelId);
  if (!shares) {
    shares = new Set();
    db.reelShares.set(reelId, shares);
  }
  return shares;
}

export function recordReelShare(
  reelId: string,
  userId: string
): { alreadyShared: boolean; shareCount: number } {
  const shares = getReelShares(reelId);
  if (shares.has(userId)) {
    return { alreadyShared: true, shareCount: shares.size };
  }
  shares.add(userId);
  schedulePersistReelShare(reelId, userId);
  return { alreadyShared: false, shareCount: shares.size };
}

export function getReelViews(reelId: string): Set<string> {
  let views = db.reelViews.get(reelId);
  if (!views) {
    views = new Set();
    db.reelViews.set(reelId, views);
  }
  return views;
}

export function recordReelView(
  reelId: string,
  userId: string
): { alreadyViewed: boolean; viewCount: number } {
  const views = getReelViews(reelId);
  if (views.has(userId)) {
    return { alreadyViewed: true, viewCount: views.size };
  }
  views.add(userId);
  schedulePersistReelView(reelId, userId);
  return { alreadyViewed: false, viewCount: views.size };
}

export function publicReelComment(c: ReelComment) {
  return {
    id: c.id,
    reelId: c.reelId,
    userId: c.userId,
    username: c.username,
    avatarUrl: c.avatarUrl,
    content: c.content,
    createdAt: c.createdAt,
  };
}

export function reelStats(reelId: string, userId?: string) {
  const likes = getReelLikes(reelId);
  const shares = getReelShares(reelId);
  const comments = getReelComments(reelId);
  const views = getReelViews(reelId);
  return {
    heartCount: likes.size,
    commentCount: comments.length,
    shareCount: shares.size,
    viewCount: views.size,
    likedByMe: userId ? likes.has(userId) : false,
    sharedByMe: userId ? shares.has(userId) : false,
    commentedByMe: userId ? comments.some((c) => c.userId === userId) : false,
  };
}
