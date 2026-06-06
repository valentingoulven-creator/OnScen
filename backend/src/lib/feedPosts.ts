import { db, FeedPost, FeedPostComment, User } from '../models/schema';
import { COMMUNITY_POST_ID_PREFIX } from '../seed-community-posts';
import { FAVORITE_POST_ID_PREFIX } from '../seed-favorite-feed';
import { hasBlocked } from './blocks';
import { getFavoriteHostIds } from './favorites';

const MAX_CONTENT_LEN = 2000;
const MIN_CONTENT_LEN = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const HTTPS_IMAGE_RE = /^https:\/\//i;
const BLOCKED_MEDIA_RE =
  /picsum\.photos|commondatastorage|sample-videos|w3schools|mdn\.sample|placeholder\.com|loremflickr/i;

/** Image collée / importée (data URL) — marge sous express.json 2 Mo. */
const FEED_IMAGE_DATA_RE = /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,[A-Za-z0-9+/=]+$/i;
export const MAX_FEED_IMAGE_DATA_CHARS = 400_000;

export function isFeedImageDataUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!FEED_IMAGE_DATA_RE.test(trimmed)) return false;
  return trimmed.length <= MAX_FEED_IMAGE_DATA_CHARS;
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
  createdAt: number;
  resharedFromId?: string;
  resharedFrom?: PublicFeedPost;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  favoriteByMe: boolean;
  recentComments: PublicFeedPostComment[];
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
  if (url.length > 2048) return undefined;
  if (isFeedImageDataUrl(url)) return url;
  if (!HTTPS_IMAGE_RE.test(url)) return undefined;
  if (BLOCKED_MEDIA_RE.test(url)) return undefined;
  return url;
}

function normalizeContent(raw: unknown, opts?: { allowEmpty?: boolean }): string | null {
  if (typeof raw !== 'string') return null;
  const content = raw.trim();
  if (content.length > MAX_CONTENT_LEN) return null;
  if (content.length < MIN_CONTENT_LEN) {
    return opts?.allowEmpty ? '' : null;
  }
  return content;
}

export function createFeedPost(
  userId: string,
  input: { content: string; imageUrl?: string }
): { ok: true; post: PublicFeedPost } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };

  const imageUrl = normalizeImageUrl(input.imageUrl);
  const content = normalizeContent(input.content, { allowEmpty: Boolean(imageUrl) });
  if (content == null) {
    return { ok: false, error: 'Le texte doit contenir entre 1 et 2000 caractères.' };
  }
  if (!content && !imageUrl) {
    return { ok: false, error: 'Ajoutez du texte ou une image.' };
  }

  if (input.imageUrl != null && String(input.imageUrl).trim() && !imageUrl) {
    return {
      ok: false,
      error: 'Image invalide (URL https ou image collée, max ~400 Ko encodée).',
    };
  }

  const post: FeedPost = {
    id: `feed-${userId}-${Date.now()}`,
    userId,
    content,
    ...(imageUrl ? { imageUrl } : {}),
    createdAt: Date.now(),
  };
  db.feedPosts.push(post);
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
  return { ok: true, liked, likeCount: likes.size };
}

export function addFeedPostComment(
  userId: string,
  postId: string,
  content: string
): { ok: true; comment: PublicFeedPostComment; commentCount: number } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };
  if (!db.feedPosts.find((p) => p.id === postId)) return { ok: false, error: 'Publication introuvable' };

  const trimmed = content.trim();
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
  return { ok: true, favorited };
}

export function listFavoritedFeedPosts(userId: string): PublicFeedPost[] {
  const favs = db.feedPostFavorites.get(userId);
  if (!favs || favs.size === 0) return [];
  const out: PublicFeedPost[] = [];
  for (const postId of favs) {
    const post = db.feedPosts.find((p) => p.id === postId);
    if (!post) continue;
    const author = db.users.get(post.userId);
    if (!author) continue;
    out.push(toPublicPost(post, author, userId));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

function toPublicPost(post: FeedPost, author: User, viewerId: string, depth = 0): PublicFeedPost {
  const likes = db.feedPostLikes.get(post.id);
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
        resharedFrom = toPublicPost(orig, origAuthor, viewerId, 1);
      }
    }
  }

  return {
    id: post.id,
    userId: post.userId,
    content: post.content,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    resharedFromId: post.resharedFromId,
    resharedFrom,
    likeCount: likes ? likes.size : 0,
    likedByMe: likes ? likes.has(viewerId) : false,
    commentCount: comments.length,
    favoriteByMe: favs ? favs.has(post.id) : false,
    recentComments,
    author: authorDto(author),
  };
}

function isMsdevFeed(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

/** En msdev, les posts seed Accueil restent en tête (favoris puis hors favoris). */
function listFeedPostsMsdev(
  viewerId: string,
  limit: number,
  before?: number
): PublicFeedPost[] {
  const sorted = [...db.feedPosts].sort((a, b) => b.createdAt - a.createdAt);
  const favoriteAuthorIds = new Set(getFavoriteHostIds(viewerId));
  const seedFavorite: FeedPost[] = [];
  const seedCommunity: FeedPost[] = [];
  const others: FeedPost[] = [];

  for (const post of sorted) {
    if (before != null && post.createdAt >= before) continue;
    if (!isVisibleToViewer(viewerId, post.userId)) continue;
    if (!db.users.get(post.userId)) continue;

    if (post.id.startsWith(FAVORITE_POST_ID_PREFIX)) seedFavorite.push(post);
    else if (post.id.startsWith(COMMUNITY_POST_ID_PREFIX)) seedCommunity.push(post);
    else others.push(post);
  }

  seedFavorite.sort((a, b) => {
    const aFav = favoriteAuthorIds.has(a.userId) ? 1 : 0;
    const bFav = favoriteAuthorIds.has(b.userId) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return b.createdAt - a.createdAt;
  });

  const merged = [...seedFavorite, ...seedCommunity, ...others];
  const out: PublicFeedPost[] = [];
  for (const post of merged) {
    const author = db.users.get(post.userId)!;
    out.push(toPublicPost(post, author, viewerId));
    if (out.length >= limit) break;
  }
  return out;
}

export function listFeedPosts(
  viewerId: string,
  opts?: { limit?: number; before?: number }
): PublicFeedPost[] {
  let limit = typeof opts?.limit === 'number' && Number.isFinite(opts.limit) ? opts.limit : DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const before =
    typeof opts?.before === 'number' && Number.isFinite(opts.before) ? opts.before : undefined;

  if (isMsdevFeed()) {
    return listFeedPostsMsdev(viewerId, limit, before);
  }

  const sorted = [...db.feedPosts].sort((a, b) => b.createdAt - a.createdAt);
  const out: PublicFeedPost[] = [];

  for (const post of sorted) {
    if (before != null && post.createdAt >= before) continue;
    if (!isVisibleToViewer(viewerId, post.userId)) continue;
    const author = db.users.get(post.userId);
    if (!author) continue;
    out.push(toPublicPost(post, author, viewerId));
    if (out.length >= limit) break;
  }

  return out;
}
