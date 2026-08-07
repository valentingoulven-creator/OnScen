import { db, FeedPost, FeedPostComment, User } from '../models/schema';
import { EVENT_POST_ID_PREFIX } from '../seed-feed-events';
import { canViewAdminBlockedContent } from './adminContentModeration';
import { hasBlocked } from './blocks';
import { getFollowingIds } from './follows';
import { getUserActiveStory } from './stories';
import { getAlgoFeed } from './algoFeed';
import {
  schedulePersistFeedPostComment,
  schedulePersistFeedPostFavorite,
  schedulePersistFeedPostLike,
  schedulePersistFeedPostUpvote,
  schedulePersistFeedPostToPg,
} from './pgFeedPosts';
import { normalizeEventTaggedUserIds, resolveTaggedUsers, type PublicTaggedUser } from './taggedUsers';
import { sanitizePlainText } from './sanitizeUserText';
import { validateImageMagicBytes, validateVideoMagicBytes } from './imageValidation';
import { probeVideoDurationSec } from './videoDuration';

const MAX_CONTENT_LEN = 2000;
const MIN_CONTENT_LEN = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Cache tri chronologique — invalidé quand la taille ou le post le plus récent change. */
let feedSortCache: FeedPost[] | null = null;
let feedSortFingerprint = '';

function feedSortCacheKey(): string {
  let maxCreatedAt = 0;
  for (const p of db.feedPosts) {
    if (p.createdAt > maxCreatedAt) maxCreatedAt = p.createdAt;
  }
  return `${db.feedPosts.length}:${maxCreatedAt}`;
}

function getFeedPostsSortedDesc(): FeedPost[] {
  const fp = feedSortCacheKey();
  if (feedSortCache && feedSortFingerprint === fp) return feedSortCache;
  feedSortCache = [...db.feedPosts].sort((a, b) => b.createdAt - a.createdAt);
  feedSortFingerprint = fp;
  return feedSortCache;
}

/** Force le recalcul au prochain listFeedPosts (tests). */
export function invalidateFeedSortCache(): void {
  feedSortCache = null;
  feedSortFingerprint = '';
}

const HTTPS_IMAGE_RE = /^https:\/\//i;
const BLOCKED_MEDIA_RE =
  /picsum\.photos|commondatastorage|sample-videos|w3schools|mdn\.sample|placeholder\.com|loremflickr/i;

/** Image collée / importée (data URL) — marge sous express.json 15 Mo. */
const FEED_IMAGE_DATA_RE =
  /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;
/** ~900 Ko JPEG 1080 px après compression client (aligné feedImagePaste). */
export const MAX_FEED_IMAGE_DATA_CHARS = 1_200_000;

/** Vidéo importée (data URL) — aligné sur express.json 15 Mo (msdev). */
const FEED_VIDEO_DATA_RE =
  /^data:video\/(webm|mp4|quicktime|x-m4v)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;
export const MAX_FEED_VIDEO_DATA_CHARS = 12_000_000;

/**
 * Vérifie le format déclaré, la taille, ET les octets réels du fichier (magic bytes) —
 * évite de faire confiance au seul préfixe `data:image/...` déclaré par le client.
 */
export function isFeedImageDataUrl(url: string): boolean {
  const trimmed = url.trim();
  const match = FEED_IMAGE_DATA_RE.exec(trimmed);
  if (!match) return false;
  if (trimmed.length > MAX_FEED_IMAGE_DATA_CHARS) return false;
  const buffer = Buffer.from(match[2], 'base64');
  return validateImageMagicBytes(buffer, match[1]);
}

/** Durée max (s) publication fil d'accueil — alignée sur FEED_VIDEO_LIMITS (frontend). */
export const FEED_VIDEO_MAX_DURATION_SEC = 30;
/** Durée max (s) story vidéo — alignée sur INSTAGRAM_STORY_LIMITS.video (frontend). */
export const STORY_VIDEO_MAX_DURATION_SEC = 15;
/** Marge de tolérance (s) sur la durée réelle sondée — arrondis d'encodage/conteneur. */
const VIDEO_DURATION_TOLERANCE_SEC = 2;

/**
 * Vérifie le format déclaré, la taille, les octets réels (magic bytes) ET, si
 * `maxDurationSec` est fourni, la durée réelle sondée dans les headers du conteneur
 * (MP4/WebM) — empêche un client de déclarer une durée mensongère plus courte que
 * la vidéo réelle pour contourner la limite du frontend.
 *
 * Si la durée ne peut pas être sondée (conteneur en streaming, format non reconnu…),
 * on ne bloque pas l'upload : on retombe sur la durée déclarée côté client.
 */
export function isFeedVideoDataUrl(url: string, maxDurationSec?: number): boolean {
  const trimmed = url.trim();
  const match = FEED_VIDEO_DATA_RE.exec(trimmed);
  if (!match) return false;
  if (trimmed.length > MAX_FEED_VIDEO_DATA_CHARS) return false;
  const buffer = Buffer.from(match[2], 'base64');
  if (!validateVideoMagicBytes(buffer, match[1])) return false;
  if (maxDurationSec != null) {
    const realDurationSec = probeVideoDurationSec(buffer, match[1]);
    if (realDurationSec != null && realDurationSec > maxDurationSec + VIDEO_DURATION_TOLERANCE_SEC) {
      return false;
    }
  }
  return true;
}

export interface PublicFeedPostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
}

export interface PublicFeedPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  createdAt: number;
  resharedFromId?: string;
  resharedFrom?: PublicFeedPost;
  likeCount: number;
  likedByMe: boolean;
  /** Upvotes (événements uniquement). */
  upvoteCount?: number;
  upvotedByMe?: boolean;
  resharedByMe: boolean;
  commentCount: number;
  favoriteByMe: boolean;
  recentComments: PublicFeedPostComment[];
  authorHasActiveStory: boolean;
  authorActiveStoryId?: string;
  /** Champs événement (présents si isEvent === true). */
  isEvent?: boolean;
  eventDate?: string;
  eventDates?: string[];
  /** Heures de fin parallèles à eventDates (null = pas de fin pour cette date). */
  eventEndTimes?: (string | null)[];
  eventLocation?: string;
  eventType?: 'dance' | 'chant' | 'autre';
  eventLinkUrl?: string;
  eventTaggedUsers?: PublicTaggedUser[];
  author: {
    id: string;
    username: string;
    usernameColor?: string;
    usernameWaveFrom?: string;
    usernameWaveTo?: string;
    avatarUrl?: string;
    profileType?: User['profileType'];
    interests?: string[];
    favoriteGenres?: string[];
    favoriteArtists?: string[];
  };
}

function authorDto(u: User): PublicFeedPost['author'] {
  return {
    id: u.id,
    username: u.username,
    usernameColor: u.usernameColor,
    usernameWaveFrom: u.usernameWaveFrom,
    usernameWaveTo: u.usernameWaveTo,
    avatarUrl: u.avatarUrl,
    profileType: u.profileType,
    interests: u.interests?.length ? [...u.interests] : undefined,
    favoriteGenres: u.favoriteGenres?.length ? [...u.favoriteGenres] : undefined,
    favoriteArtists: u.favoriteArtists?.length ? [...u.favoriteArtists] : undefined,
  };
}

function isVisibleToViewer(viewerId: string, authorId: string): boolean {
  if (viewerId === authorId) return true;
  if (hasBlocked(viewerId, authorId)) return false;
  if (hasBlocked(authorId, viewerId)) return false;
  return true;
}

function normalizeImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (isFeedImageDataUrl(url)) return url;
  if (url.length > 2048) return undefined;
  if (!HTTPS_IMAGE_RE.test(url)) return undefined;
  if (BLOCKED_MEDIA_RE.test(url)) return undefined;
  return url;
}

const MAX_FEED_POST_IMAGES = 10;

function normalizeImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const url = normalizeImageUrl(item);
    if (!url) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length >= MAX_FEED_POST_IMAGES) break;
  }
  return out;
}

export function resolveFeedPostImageUrls(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): string[] {
  const fromList = (post.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromList.length > 0) return fromList;
  const single = post.imageUrl?.trim();
  return single ? [single] : [];
}

function normalizeVideoUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (isFeedVideoDataUrl(url, FEED_VIDEO_MAX_DURATION_SEC)) return url;
  return undefined;
}

function normalizeContent(raw: unknown, opts?: { allowEmpty?: boolean }): string | null {
  if (typeof raw !== 'string') return null;
  const content = sanitizePlainText(raw.trim());
  if (content.length > MAX_CONTENT_LEN) return null;
  if (content.length < MIN_CONTENT_LEN) {
    return opts?.allowEmpty ? '' : null;
  }
  return content;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/;

function normalizeEventDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  if (!ISO_DATE_RE.test(v)) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeEventDates(
  rawDates: unknown,
  rawSingle: unknown,
  rawEndTimes?: unknown
): { eventDate: string; eventDates: string[]; eventEndTimes: (string | null)[] } | null {
  // Build (startIso, endIso | null) pairs
  const pairs: [string, string | null][] = [];
  const endArr = Array.isArray(rawEndTimes) ? rawEndTimes : [];

  if (Array.isArray(rawDates)) {
    for (let i = 0; i < rawDates.length; i++) {
      const normalized = normalizeEventDate(rawDates[i]);
      if (normalized) {
        const rawEnd = endArr[i] != null ? endArr[i] : null;
        const end = rawEnd != null ? normalizeEventDate(rawEnd) : null;
        pairs.push([normalized, end]);
      }
    }
  }

  if (pairs.length === 0) {
    const single = normalizeEventDate(rawSingle);
    if (single) {
      const rawEnd = endArr[0] != null ? endArr[0] : null;
      const end = rawEnd != null ? normalizeEventDate(rawEnd) : null;
      pairs.push([single, end]);
    }
  }

  if (pairs.length === 0) return null;

  // Deduplicate by start (keep first end time for duplicates)
  const seen = new Set<string>();
  const unique: [string, string | null][] = [];
  for (const [start, end] of pairs) {
    if (!seen.has(start)) {
      seen.add(start);
      unique.push([start, end]);
    }
  }

  unique.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  const eventDates = unique.map((p) => p[0]);
  const eventEndTimes = unique.map((p) => p[1]);

  return { eventDate: eventDates[0], eventDates, eventEndTimes };
}

function normalizeEventLocation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.length > 300) return null;
  return v;
}

const VALID_EVENT_TYPES = new Set(['dance', 'chant', 'autre'] as const);

function normalizeEventLinkUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.href.length > 2048) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

function normalizeEventType(raw: unknown): 'dance' | 'chant' | 'autre' {
  if (typeof raw === 'string' && VALID_EVENT_TYPES.has(raw as 'dance' | 'chant' | 'autre')) {
    return raw as 'dance' | 'chant' | 'autre';
  }
  return 'autre';
}

export function createFeedPost(
  userId: string,
  input: {
    content: string;
    imageUrl?: string;
    imageUrls?: unknown;
    videoUrl?: string;
    isEvent?: boolean;
    eventDate?: string;
    eventDates?: unknown;
    eventEndTimes?: unknown;
    eventLocation?: string;
    eventType?: string;
    eventLinkUrl?: string;
    eventTaggedUserIds?: unknown;
  }
): { ok: true; post: PublicFeedPost } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };

  const imageUrlSingle = normalizeImageUrl(input.imageUrl);
  const imageUrlsList = normalizeImageUrls(input.imageUrls);
  const imageUrls =
    imageUrlsList.length > 0
      ? imageUrlsList
      : imageUrlSingle
        ? [imageUrlSingle]
        : [];
  const imageUrl = imageUrls[0];
  const videoUrl = normalizeVideoUrl(input.videoUrl);
  if (imageUrls.length > 0 && videoUrl) {
    return { ok: false, error: 'Une publication ne peut pas contenir des images et une vidéo.' };
  }

  const hasImageInput =
    imageUrls.length > 0 ||
    (input.imageUrl != null && String(input.imageUrl).trim().length > 0) ||
    (Array.isArray(input.imageUrls) && input.imageUrls.length > 0);
  const hasVideoInput = input.videoUrl != null && String(input.videoUrl).trim().length > 0;
  if (hasImageInput && imageUrls.length === 0) {
    return {
      ok: false,
      error: 'Image invalide (URL https ou image collée, max ~400 Ko encodée).',
    };
  }
  if (hasVideoInput && !videoUrl) {
    return {
      ok: false,
      error: 'Vidéo invalide (MP4, WebM ou MOV, max ~12 Mo encodée).',
    };
  }

  const hasMedia = Boolean(imageUrls.length > 0 || videoUrl);
  const content = normalizeContent(input.content ?? '', {
    allowEmpty: hasMedia || hasImageInput || hasVideoInput,
  });
  if (content == null) {
    return { ok: false, error: 'Le texte doit contenir entre 1 et 2000 caractères.' };
  }
  if (!content && !hasMedia) {
    return { ok: false, error: 'Ajoutez du texte, une image ou une vidéo.' };
  }

  // Validation événement
  let eventDate: string | undefined;
  let eventDates: string[] | undefined;
  let eventEndTimes: (string | null)[] | undefined;
  let eventLocation: string | undefined;
  let eventType: 'dance' | 'chant' | 'autre' | undefined;
  let eventLinkUrl: string | undefined;
  let eventTaggedUserIds: string[] | undefined;
  if (input.isEvent) {
    const normalizedDates = normalizeEventDates(input.eventDates, input.eventDate, input.eventEndTimes);
    if (!normalizedDates) {
      return { ok: false, error: "Date de l'événement invalide ou manquante." };
    }
    const loc = normalizeEventLocation(input.eventLocation);
    if (!loc) {
      return { ok: false, error: "Lieu de l'événement requis (max 300 caractères)." };
    }
    eventDate = normalizedDates.eventDate;
    eventDates = normalizedDates.eventDates;
    eventEndTimes = normalizedDates.eventEndTimes.some((e) => e !== null)
      ? normalizedDates.eventEndTimes
      : undefined;
    eventLocation = loc;
    eventType = normalizeEventType(input.eventType);
    if (input.eventLinkUrl != null && String(input.eventLinkUrl).trim()) {
      const link = normalizeEventLinkUrl(input.eventLinkUrl);
      if (!link) {
        return { ok: false, error: 'Lien invalide (http:// ou https:// requis).' };
      }
      eventLinkUrl = link;
    }
    eventTaggedUserIds = normalizeEventTaggedUserIds(input.eventTaggedUserIds, userId);
  }

  const post: FeedPost = {
    id: `feed-${userId}-${Date.now()}`,
    userId,
    content,
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageUrls.length > 1 ? { imageUrls } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(input.isEvent
      ? {
          isEvent: true,
          eventDate,
          eventDates,
          eventEndTimes,
          eventLocation,
          eventType,
          ...(eventLinkUrl ? { eventLinkUrl } : {}),
          ...(eventTaggedUserIds ? { eventTaggedUserIds } : {}),
        }
      : {}),
    createdAt: Date.now(),
  };
  db.feedPosts.push(post);
  invalidateFeedSortCache();
  schedulePersistFeedPostToPg(post);
  return { ok: true, post: toPublicPost(post, user, userId) };
}

export function resharePost(
  userId: string,
  originalPostId: string
): { ok: true; post: PublicFeedPost } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };

  const original = db.feedPosts.find((p) => p.id === originalPostId);
  if (!original) return { ok: false, error: 'Publication introuvable' };

  if (original.userId === userId) return { ok: false, error: 'Vous ne pouvez pas repartager votre propre publication.' };

  const alreadyShared = db.feedPosts.some(
    (p) => p.userId === userId && p.resharedFromId === originalPostId
  );
  if (alreadyShared) return { ok: false, error: 'Vous avez déjà repartagé cette publication.' };

  const post: FeedPost = {
    id: `feed-${userId}-${Date.now()}`,
    userId,
    content: '',
    resharedFromId: originalPostId,
    createdAt: Date.now(),
  };
  db.feedPosts.push(post);
  invalidateFeedSortCache();
  schedulePersistFeedPostToPg(post);
  return { ok: true, post: toPublicPost(post, user, userId) };
}

export function toggleFeedPostLike(
  userId: string,
  postId: string
): { ok: true; liked: boolean; likeCount: number } | { ok: false; error: string } {
  if (!db.users.get(userId)) return { ok: false, error: 'Utilisateur introuvable' };
  const post = db.feedPosts.find((p) => p.id === postId);
  if (!post) return { ok: false, error: 'Publication introuvable' };

  if (!db.feedPostLikes.has(postId)) db.feedPostLikes.set(postId, new Set());
  const likes = db.feedPostLikes.get(postId)!;
  const liked = !likes.has(userId);
  if (liked) likes.add(userId);
  else likes.delete(userId);
  schedulePersistFeedPostLike(postId, userId, liked);
  return { ok: true, liked, likeCount: likes.size };
}

function publicEventUpvoteCount(post: FeedPost, realUpvoteCount: number): number {
  const seed = post.eventUpvoteSeed ?? 0;
  return Math.max(0, realUpvoteCount + seed);
}

export function toggleFeedPostUpvote(
  userId: string,
  postId: string
): { ok: true; upvoted: boolean; upvoteCount: number } | { ok: false; error: string } {
  if (!db.users.get(userId)) return { ok: false, error: 'Utilisateur introuvable' };
  const post = db.feedPosts.find((p) => p.id === postId);
  if (!post) return { ok: false, error: 'Publication introuvable' };
  if (!post.isEvent) return { ok: false, error: 'Upvote réservé aux événements' };

  if (!db.feedPostUpvotes.has(postId)) db.feedPostUpvotes.set(postId, new Set());
  const upvotes = db.feedPostUpvotes.get(postId)!;
  const upvoted = !upvotes.has(userId);
  if (upvoted) upvotes.add(userId);
  else upvotes.delete(userId);
  schedulePersistFeedPostUpvote(postId, userId, upvoted);
  return { ok: true, upvoted, upvoteCount: publicEventUpvoteCount(post, upvotes.size) };
}

export function addFeedPostComment(
  userId: string,
  postId: string,
  content: string
): { ok: true; comment: PublicFeedPostComment; commentCount: number } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };
  if (!db.feedPosts.find((p) => p.id === postId)) return { ok: false, error: 'Publication introuvable' };

  const trimmed = sanitizePlainText(content.trim());
  if (!trimmed || trimmed.length > 500) return { ok: false, error: 'Commentaire invalide (1–500 caractères).' };

  const comment: FeedPostComment = {
    id: `fc-${userId}-${Date.now()}`,
    postId,
    userId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    content: trimmed,
    createdAt: Date.now(),
  };

  if (!db.feedPostComments.has(postId)) db.feedPostComments.set(postId, []);
  db.feedPostComments.get(postId)!.push(comment);
  const count = db.feedPostComments.get(postId)!.length;
  schedulePersistFeedPostComment(comment);
  return { ok: true, comment, commentCount: count };
}

export function listFeedPostComments(postId: string): PublicFeedPostComment[] {
  return (db.feedPostComments.get(postId) ?? []).map((c) => ({
    id: c.id,
    postId: c.postId,
    userId: c.userId,
    username: c.username,
    avatarUrl: c.avatarUrl,
    content: c.content,
    createdAt: c.createdAt,
  }));
}

export function toggleFeedPostFavorite(
  userId: string,
  postId: string
): { ok: true; favorited: boolean } | { ok: false; error: string } {
  if (!db.users.get(userId)) return { ok: false, error: 'Utilisateur introuvable' };
  if (!db.feedPosts.find((p) => p.id === postId)) return { ok: false, error: 'Publication introuvable' };

  if (!db.feedPostFavorites.has(userId)) db.feedPostFavorites.set(userId, new Set());
  const favs = db.feedPostFavorites.get(userId)!;
  const favorited = !favs.has(postId);
  if (favorited) favs.add(postId);
  else favs.delete(postId);
  schedulePersistFeedPostFavorite(userId, postId, favorited);
  return { ok: true, favorited };
}

export function listFavoritedFeedPosts(userId: string): PublicFeedPost[] {
  const favs = db.feedPostFavorites.get(userId);
  if (!favs || favs.size === 0) return [];

  // Single pass over db.feedPosts: build id→post index + reshares Set.
  // Avoids O(n) db.feedPosts.find() per favorited post.
  const postById = new Map<string, FeedPost>();
  const myReshares = new Set<string>();
  for (const p of db.feedPosts) {
    postById.set(p.id, p);
    if (p.userId === userId && p.resharedFromId) {
      myReshares.add(p.resharedFromId);
    }
  }

  const out: PublicFeedPost[] = [];
  for (const postId of favs) {
    const post = postById.get(postId);
    if (!post) continue;
    const author = db.users.get(post.userId);
    if (!author) continue;
    out.push(toPublicPost(post, author, userId, 0, myReshares));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Résout des publications événement par id (ordre des ids conservé, doublons ignorés). */
export function getPublicFeedEventPostsByIds(
  viewerId: string,
  postIds: readonly string[]
): PublicFeedPost[] {
  const seen = new Set<string>();
  const myReshares = new Set<string>();
  for (const p of db.feedPosts) {
    if (p.userId === viewerId && p.resharedFromId) myReshares.add(p.resharedFromId);
  }
  const out: PublicFeedPost[] = [];
  for (const rawId of postIds) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const post = db.feedPosts.find((p) => p.id === id);
    if (!post?.isEvent || post.adminBlocked) continue;
    if (!isVisibleToViewer(viewerId, post.userId)) continue;
    const author = db.users.get(post.userId);
    if (!author) continue;
    out.push(toPublicPost(post, author, viewerId, 0, myReshares));
  }
  return out;
}

/**
 * @param reshareCtx  Optionally pre-built Set of original post IDs that viewerId has already
 *   reshared.  When provided, avoids an O(n) full-scan of db.feedPosts per post (hot path in
 *   list functions).  Single-post callers (createFeedPost, resharePost) can omit this.
 */
function toPublicPost(
  post: FeedPost,
  author: User,
  viewerId: string,
  depth = 0,
  reshareCtx?: ReadonlySet<string>,
): PublicFeedPost {
  const likes = db.feedPostLikes.get(post.id);
  const upvotes = post.isEvent ? db.feedPostUpvotes.get(post.id) : undefined;
  const comments = db.feedPostComments.get(post.id) ?? [];
  const favs = db.feedPostFavorites.get(viewerId);

  const recentComments: PublicFeedPostComment[] = comments
    .slice(-3)
    .map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      username: c.username,
      avatarUrl: c.avatarUrl,
      content: c.content,
      createdAt: c.createdAt,
    }));

  let resharedFrom: PublicFeedPost | undefined;
  if (post.resharedFromId && depth === 0) {
    const orig = db.feedPosts.find((p) => p.id === post.resharedFromId);
    if (orig) {
      const origAuthor = db.users.get(orig.userId);
      if (origAuthor) {
        resharedFrom = toPublicPost(orig, origAuthor, viewerId, 1, reshareCtx);
      }
    }
  }

  const activeStory = getUserActiveStory(author.id);

  return {
    id: post.id,
    userId: post.userId,
    content: post.content,
    imageUrl: post.imageUrl,
    ...(post.imageUrls?.length ? { imageUrls: post.imageUrls } : {}),
    videoUrl: post.videoUrl,
    createdAt: post.createdAt,
    resharedFromId: post.resharedFromId,
    resharedFrom,
    likeCount: likes ? likes.size : 0,
    likedByMe: likes ? likes.has(viewerId) : false,
    ...(post.isEvent
      ? {
          upvoteCount: publicEventUpvoteCount(post, upvotes ? upvotes.size : 0),
          upvotedByMe: upvotes ? upvotes.has(viewerId) : false,
        }
      : {}),
    resharedByMe: reshareCtx
      ? reshareCtx.has(post.id)
      : db.feedPosts.some((p) => p.userId === viewerId && p.resharedFromId === post.id),
    commentCount: comments.length,
    favoriteByMe: favs ? favs.has(post.id) : false,
    recentComments,
    authorHasActiveStory: !!activeStory,
    authorActiveStoryId: activeStory?.id,
    ...(post.isEvent
      ? {
          isEvent: true,
          eventDate: post.eventDate,
          ...(post.eventDates?.length ? { eventDates: post.eventDates } : {}),
          ...(post.eventEndTimes?.some((e) => e !== null)
            ? { eventEndTimes: post.eventEndTimes }
            : {}),
          eventLocation: post.eventLocation,
          eventType: post.eventType ?? 'autre',
          ...(post.eventLinkUrl ? { eventLinkUrl: post.eventLinkUrl } : {}),
          ...(post.eventTaggedUserIds?.length
            ? { eventTaggedUsers: resolveTaggedUsers(post.eventTaggedUserIds) }
            : {}),
        }
      : {}),
    author: authorDto(author),
  };
}

function isMsdevFeed(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

// ─── Event filter helpers ─────────────────────────────────────────────────────

export interface EventFilterOpts {
  eventsOnly?: boolean;
  /** Exclut les événements seed feed-event-* (section « Événements autour »). */
  userEventsOnly?: boolean;
  eventDate?: string;
  eventLocationSearch?: string;
  eventCountry?: string;
  eventType?: 'dance' | 'chant' | 'autre';
  /** Filtre par auteur : seuls les posts de cet utilisateur sont retournés. */
  authorId?: string;
  /** Profil : événements créés par l'utilisateur ou où il est tagué. */
  profileUserId?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'france', BE: 'belgique', CH: 'suisse', CA: 'canada', LU: 'luxembourg',
  DE: 'allemagne', IT: 'italie', ES: 'espagne', GB: 'royaume-uni',
  US: 'états-unis', MA: 'maroc', SN: 'sénégal', CI: "côte d'ivoire",
};

function matchesEventFilters(post: FeedPost, f: EventFilterOpts): boolean {
  if (f.profileUserId) {
    if (!post.isEvent) return false;
    if (f.userEventsOnly && post.id.startsWith(EVENT_POST_ID_PREFIX)) return false;
    const isOrganizer = post.userId === f.profileUserId;
    const isTagged = post.eventTaggedUserIds?.includes(f.profileUserId) ?? false;
    if (!isOrganizer && !isTagged) return false;
  } else if (f.authorId && post.userId !== f.authorId) {
    return false;
  }
  if (!f.eventsOnly && !f.profileUserId) return true;
  if (!post.isEvent) return false;
  if (!f.profileUserId && f.userEventsOnly && post.id.startsWith(EVENT_POST_ID_PREFIX)) return false;

  if (f.eventDate) {
    if (!post.eventDate?.startsWith(f.eventDate)) return false;
  } else if (post.eventDate) {
    const todayStr = new Date().toISOString().split('T')[0];
    const postDateStr = post.eventDate.split('T')[0];
    if (postDateStr < todayStr) return false;
  }

  if (f.eventLocationSearch) {
    const needle = f.eventLocationSearch.toLowerCase();
    if (!post.eventLocation?.toLowerCase().includes(needle)) return false;
  }

  if (f.eventCountry) {
    const needle = COUNTRY_NAMES[f.eventCountry.toUpperCase()] ?? f.eventCountry.toLowerCase();
    if (!post.eventLocation?.toLowerCase().includes(needle)) return false;
  }

  if (f.eventType) {
    if (normalizeEventType(post.eventType) !== f.eventType) return false;
  }

  return true;
}

/** En msdev, même ordre que prod : createdAt décroissant (date de publication). */
function listFeedPostsMsdev(
  viewerId: string,
  limit: number,
  before: number | undefined,
  eventFilters: EventFilterOpts,
  followedIds?: Set<string>,
): PublicFeedPost[] {
  return listFeedPostsChronological(viewerId, limit, before, eventFilters, followedIds);
}

function listFeedPostsChronological(
  viewerId: string,
  limit: number,
  before: number | undefined,
  eventFilters: EventFilterOpts,
  followedIds?: Set<string>,
): PublicFeedPost[] {
  // Pre-build a Set of post IDs that viewerId has reshared in O(n) rather than checking
  // db.feedPosts.some() inside toPublicPost which would be O(n) × limit = O(n²).
  const myReshares = new Set<string>();
  for (const p of db.feedPosts) {
    if (p.userId === viewerId && p.resharedFromId) {
      myReshares.add(p.resharedFromId);
    }
  }

  const sorted = getFeedPostsSortedDesc();
  const out: PublicFeedPost[] = [];

  for (const post of sorted) {
    if (before != null && post.createdAt >= before) continue;
    if (post.adminBlocked && !canViewAdminBlockedContent(viewerId)) continue;
    if (!isVisibleToViewer(viewerId, post.userId)) continue;
    if (
      followedIds &&
      post.userId !== viewerId &&
      !followedIds.has(post.userId)
    ) {
      continue;
    }
    if (!matchesEventFilters(post, eventFilters)) continue;
    const author = db.users.get(post.userId);
    if (!author) continue;
    out.push(toPublicPost(post, author, viewerId, 0, myReshares));
    if (out.length >= limit) break;
  }

  return out;
}

export function listFeedPosts(
  viewerId: string,
  opts?: {
    limit?: number;
    before?: number;
    eventsOnly?: boolean;
    userEventsOnly?: boolean;
    eventDate?: string;
    eventLocationSearch?: string;
    eventCountry?: string;
    eventType?: 'dance' | 'chant' | 'autre';
    /** When true, rank posts via the Algo Soundy scoring engine instead of chronological order. */
    useAlgo?: boolean;
    /** Fil d'accueil : publications et événements des comptes suivis + les vôtres, par createdAt. */
    followingOnly?: boolean;
    /** Filtre par auteur : seuls les posts de cet utilisateur sont retournés. */
    authorId?: string;
    /** Événements affichés sur le profil (organisateur + invité tagué). */
    profileUserId?: string;
  }
): PublicFeedPost[] {
  const eventsOnly = Boolean(opts?.eventsOnly);
  let limit: number;
  if (eventsOnly) {
    limit =
      typeof opts?.limit === 'number' && Number.isFinite(opts.limit)
        ? Math.max(1, Math.floor(opts.limit))
        : Number.MAX_SAFE_INTEGER;
  } else {
    limit =
      typeof opts?.limit === 'number' && Number.isFinite(opts.limit) ? opts.limit : DEFAULT_LIMIT;
    limit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  }
  const before =
    typeof opts?.before === 'number' && Number.isFinite(opts.before) ? opts.before : undefined;
  const eventFilters: EventFilterOpts = {
    eventsOnly: opts?.eventsOnly,
    userEventsOnly: opts?.userEventsOnly,
    eventDate: opts?.eventDate,
    eventLocationSearch: opts?.eventLocationSearch,
    eventCountry: opts?.eventCountry,
    eventType: opts?.eventType,
    authorId: opts?.authorId,
    profileUserId: opts?.profileUserId,
  };

  const followingOnly = opts?.followingOnly === true;
  const followedIds = followingOnly ? new Set(getFollowingIds(viewerId)) : undefined;

  // Algo Soundy: only applies to the main feed (not events-only, following-only, or msdev).
  if (opts?.useAlgo && !eventFilters.eventsOnly && !followingOnly && !isMsdevFeed()) {
    const algoPosts = getAlgoFeed(viewerId, limit);
    // Fall back to chronological when not enough posts to rank meaningfully.
    if (algoPosts.length >= 5) {
      const myReshares = new Set<string>();
      for (const p of db.feedPosts) {
        if (p.userId === viewerId && p.resharedFromId) myReshares.add(p.resharedFromId);
      }
      const result: PublicFeedPost[] = [];
      for (const post of algoPosts) {
        if (post.adminBlocked && !canViewAdminBlockedContent(viewerId)) continue;
        if (!isVisibleToViewer(viewerId, post.userId)) continue;
        const author = db.users.get(post.userId);
        if (!author) continue;
        result.push(toPublicPost(post, author, viewerId, 0, myReshares));
      }
      return result;
    }
  }

  if (isMsdevFeed()) {
    return listFeedPostsMsdev(viewerId, limit, before, eventFilters, followedIds);
  }

  return listFeedPostsChronological(viewerId, limit, before, eventFilters, followedIds);
}
