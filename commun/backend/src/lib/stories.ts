import { randomUUID } from 'crypto';
import { db, Story, StoryLink, StoryMusicTrack, User } from '../models/schema';
import { hasBlocked } from './blocks';
import { getDistanceKm } from './geo';
import { getUserPublicCoords } from './locationPrivacy';
import { isFeedImageDataUrl, isFeedVideoDataUrl } from './feedPosts';
import { clampNearbyRadiusKm } from './geoLimits';
import { scheduleDeleteStoryFromPg, schedulePersistStoryToPg } from './pgStories';
import {
  normalizeTaggedUserIds,
  resolveTaggedUsers,
  type PublicTaggedUser,
} from './taggedUsers';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
/** Limite style Instagram : plusieurs stories actives par utilisateur (24 h chacune). */
export const MAX_ACTIVE_STORIES_PER_USER = 20;

const HTTPS_IMAGE_RE = /^https:\/\//i;

export interface PublicStoryTaggedUser extends PublicTaggedUser {}

export interface PublicStory {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoDurationSec?: number;
  musicTrack?: StoryMusicTrack;
  taggedUsers?: PublicStoryTaggedUser[];
  link?: StoryLink;
  createdAt: number;
  expiresAt: number;
  visibility?: 'public' | 'followers';
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
    usernameColor?: string;
    usernameWaveFrom?: string;
    usernameWaveTo?: string;
  };
}

function authorDto(u: User): PublicStory['author'] {
  return {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    usernameColor: u.usernameColor,
    usernameWaveFrom: u.usernameWaveFrom,
    usernameWaveTo: u.usernameWaveTo,
  };
}

function isActive(story: Story, now = Date.now()): boolean {
  return story.expiresAt > now;
}

export function purgeExpiredStories(): void {
  const now = Date.now();
  const kept = db.stories.filter((s) => isActive(s, now));
  if (kept.length !== db.stories.length) {
    db.stories.length = 0;
    db.stories.push(...kept);
  }
}

function normalizeImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (isFeedImageDataUrl(url)) return url;
  if (url.length > 2048) return undefined;
  if (!HTTPS_IMAGE_RE.test(url)) return undefined;
  return url;
}

function normalizeVideoUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (isFeedVideoDataUrl(url)) return url;
  return undefined;
}

function normalizeVideoDurationSec(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(60, Math.max(1, Math.round(n)));
}

function normalizeContent(raw: unknown, opts?: { allowEmpty?: boolean }): string | null {
  if (typeof raw !== 'string') return null;
  const content = raw.trim();
  if (content.length < 1) return opts?.allowEmpty ? '' : null;
  return content;
}

/** L'auteur a mis l'histoire en « Abonnés » : seuls ses fans (userFavorites) la voient. */
function isVisibleByFollowers(viewerId: string, authorId: string): boolean {
  return db.userFavorites.get(viewerId)?.has(authorId) ?? false;
}

function isVisibleToViewer(viewerId: string, authorId: string): boolean {
  if (viewerId === authorId) return true;
  if (hasBlocked(viewerId, authorId)) return false;
  if (hasBlocked(authorId, viewerId)) return false;
  return true;
}

function resolveStoryTaggedUsers(ids: string[] | undefined): PublicStoryTaggedUser[] | undefined {
  return resolveTaggedUsers(ids);
}

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{6,15}$/;

function normalizeMusicTrack(raw: unknown): StoryMusicTrack | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : '';
  const artist = typeof o.artist === 'string' ? o.artist.trim().slice(0, 120) : '';
  const videoId =
    typeof o.videoId === 'string' && YOUTUBE_VIDEO_ID_RE.test(o.videoId.trim())
      ? o.videoId.trim()
      : undefined;
  let url = typeof o.url === 'string' ? o.url.trim().slice(0, 512) : undefined;
  if (url && !/^https:\/\//i.test(url)) url = undefined;
  if (!title && !videoId) return undefined;
  return {
    title: title || 'Piste YouTube',
    artist,
    videoId,
    url,
  };
}

function normalizeStoryTaggedUserIds(raw: unknown, authorId: string): string[] | undefined {
  return normalizeTaggedUserIds(raw, authorId);
}

function normalizeStoryLink(raw: unknown): StoryLink | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const urlRaw = typeof o.url === 'string' ? o.url.trim() : '';
  if (!urlRaw || urlRaw.length > 2048) return undefined;
  if (!/^https?:\/\//i.test(urlRaw)) return undefined;
  let url: string;
  try {
    const parsed = new URL(urlRaw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    url = parsed.href;
  } catch {
    return undefined;
  }
  const label =
    typeof o.label === 'string' && o.label.trim()
      ? o.label.trim().slice(0, 80)
      : undefined;
  let x = typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : 0.5;
  let y = typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : 0.78;
  x = Math.min(1, Math.max(0, x));
  y = Math.min(1, Math.max(0, y));
  return { url, label, x, y };
}

function toPublicStory(story: Story): PublicStory | null {
  const user = db.users.get(story.userId);
  if (!user) return null;
  return {
    id: story.id,
    userId: story.userId,
    content: story.content || undefined,
    imageUrl: story.imageUrl || undefined,
    videoUrl: story.videoUrl || undefined,
    videoDurationSec: story.videoDurationSec,
    musicTrack: story.musicTrack,
    taggedUsers: resolveStoryTaggedUsers(story.taggedUserIds),
    link: story.link,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    visibility: story.visibility,
    author: authorDto(user),
  };
}

export function createStory(
  userId: string,
  input: {
    content?: string;
    imageUrl?: string;
    videoUrl?: string;
    videoDurationSec?: unknown;
    musicTrack?: unknown;
    taggedUserIds?: unknown;
    link?: unknown;
    visibility?: unknown;
  }
): { ok: true; story: PublicStory } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };

  purgeExpiredStories();

  const imageUrl = normalizeImageUrl(input.imageUrl);
  const videoUrl = normalizeVideoUrl(input.videoUrl);
  const hasImageInput = input.imageUrl != null && String(input.imageUrl).trim().length > 0;
  const hasVideoInput = input.videoUrl != null && String(input.videoUrl).trim().length > 0;
  if (hasImageInput && !imageUrl && !hasVideoInput) {
    return { ok: false, error: 'Image invalide ou trop volumineuse.' };
  }
  if (hasVideoInput && !videoUrl) {
    return { ok: false, error: 'Vidéo invalide (MP4, WebM ou MOV, max ~12 Mo).' };
  }
  const videoDurationSec = videoUrl ? normalizeVideoDurationSec(input.videoDurationSec) : undefined;
  const content = normalizeContent(input.content ?? '', {
    allowEmpty: Boolean(imageUrl || videoUrl) || hasImageInput || hasVideoInput,
  });
  if (!content && !imageUrl && !videoUrl) {
    return { ok: false, error: 'Ajoutez du texte, une image ou une vidéo.' };
  }

  const now = Date.now();
  purgeExpiredStories();
  const activeCount = db.stories.filter((s) => s.userId === userId && isActive(s, now)).length;
  if (activeCount >= MAX_ACTIVE_STORIES_PER_USER) {
    return {
      ok: false,
      error: `Maximum ${MAX_ACTIVE_STORIES_PER_USER} stories actives. Attendez l'expiration des plus anciennes.`,
    };
  }

  const musicTrack = normalizeMusicTrack(input.musicTrack);
  const taggedUserIds = normalizeStoryTaggedUserIds(input.taggedUserIds, userId);
  const link = normalizeStoryLink(input.link);
  const visibility: 'public' | 'followers' =
    input.visibility === 'public' ? 'public' : 'followers';

  const story: Story = {
    id: randomUUID(),
    userId,
    content: content || undefined,
    imageUrl,
    videoUrl,
    videoDurationSec,
    musicTrack,
    taggedUserIds,
    link,
    createdAt: now,
    expiresAt: now + STORY_TTL_MS,
    visibility,
  };
  db.stories.push(story);
  schedulePersistStoryToPg(story);

  const pub = toPublicStory(story);
  if (!pub) return { ok: false, error: 'Erreur interne' };
  return { ok: true, story: pub };
}

function activeStoriesForUser(userId: string, now = Date.now()): Story[] {
  return db.stories
    .filter((s) => s.userId === userId && isActive(s, now))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getUserActiveStories(userId: string): PublicStory[] {
  purgeExpiredStories();
  return activeStoriesForUser(userId)
    .map((story) => toPublicStory(story))
    .filter((s): s is PublicStory => s != null);
}

/** Dernière story publiée (aperçu anneau). */
export function getUserActiveStory(userId: string): PublicStory | null {
  const stories = getUserActiveStories(userId);
  return stories.length ? stories[stories.length - 1]! : null;
}

/** @deprecated alias — use getUserActiveStory */
export function getMyActiveStory(userId: string): PublicStory | null {
  return getUserActiveStory(userId);
}

export function deleteStory(storyId: string, userId: string): boolean {
  purgeExpiredStories();
  const idx = db.stories.findIndex((s) => s.id === storyId && s.userId === userId && isActive(s));
  if (idx < 0) return false;
  db.stories.splice(idx, 1);
  scheduleDeleteStoryFromPg(storyId);
  return true;
}

export function listStoriesForViewer(
  viewerId: string,
  opts?: { latitude?: number; longitude?: number; radiusKm?: number }
): PublicStory[] {
  purgeExpiredStories();
  const viewer = db.users.get(viewerId);
  if (!viewer) return [];

  const lat = opts?.latitude ?? viewer.latitude;
  const lon = opts?.longitude ?? viewer.longitude;
  const radiusKm =
    opts?.radiusKm != null && Number.isFinite(opts.radiusKm)
      ? clampNearbyRadiusKm(opts.radiusKm)
      : null;

  const out: PublicStory[] = [];

  for (const story of db.stories) {
    if (!isActive(story)) continue;
    if (!isVisibleToViewer(viewerId, story.userId)) continue;
    const author = db.users.get(story.userId);
    if (!author) continue;

    if (story.userId !== viewerId) {
      const vis = story.visibility ?? 'followers';
      if (vis === 'followers' && !isVisibleByFollowers(viewerId, story.userId)) continue;
    }

    if (story.userId !== viewerId && lat != null && lon != null && radiusKm != null) {
      const pos = getUserPublicCoords(author, viewerId);
      if (!pos) continue;
      const d = getDistanceKm(lat, lon, pos.lat, pos.lon);
      if (d > radiusKm) continue;
    }

    const pub = toPublicStory(story);
    if (pub) out.push(pub);
  }

  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}
