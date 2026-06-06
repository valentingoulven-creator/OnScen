import { randomUUID } from 'crypto';
import { db, Story, StoryMusicTrack, User } from '../models/schema';
import { hasBlocked } from './blocks';
import { getDistanceKm } from './geo';
import { getUserPublicCoords } from './locationPrivacy';
import { isFeedImageDataUrl } from './feedPosts';
import { clampNearbyRadiusKm } from './geoLimits';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const HTTPS_IMAGE_RE = /^https:\/\//i;

export interface PublicStoryTaggedUser {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}

export interface PublicStory {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  musicTrack?: StoryMusicTrack;
  taggedUsers?: PublicStoryTaggedUser[];
  createdAt: number;
  expiresAt: number;
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
  if (url.length > 2048) return undefined;
  if (isFeedImageDataUrl(url)) return url;
  if (!HTTPS_IMAGE_RE.test(url)) return undefined;
  return url;
}

function normalizeContent(raw: unknown, opts?: { allowEmpty?: boolean }): string | null {
  if (typeof raw !== 'string') return null;
  const content = raw.trim();
  if (content.length < 1) return opts?.allowEmpty ? '' : null;
  return content;
}

function isVisibleToViewer(viewerId: string, authorId: string): boolean {
  if (viewerId === authorId) return true;
  if (hasBlocked(viewerId, authorId)) return false;
  if (hasBlocked(authorId, viewerId)) return false;
  return true;
}

function resolveTaggedUsers(ids: string[] | undefined): PublicStoryTaggedUser[] | undefined {
  if (!ids?.length) return undefined;
  const out: PublicStoryTaggedUser[] = [];
  for (const id of ids) {
    const u = db.users.get(id);
    if (!u) continue;
    out.push({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      usernameColor: u.usernameColor,
      usernameWaveFrom: u.usernameWaveFrom,
      usernameWaveTo: u.usernameWaveTo,
    });
  }
  return out.length ? out : undefined;
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

function normalizeTaggedUserIds(raw: unknown, authorId: string): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id === authorId || ids.includes(id)) continue;
    if (!db.users.get(id)) continue;
    ids.push(id);
    if (ids.length >= 5) break;
  }
  return ids.length ? ids : undefined;
}

function toPublicStory(story: Story): PublicStory | null {
  const user = db.users.get(story.userId);
  if (!user) return null;
  return {
    id: story.id,
    userId: story.userId,
    content: story.content || undefined,
    imageUrl: story.imageUrl || undefined,
    musicTrack: story.musicTrack,
    taggedUsers: resolveTaggedUsers(story.taggedUserIds),
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    author: authorDto(user),
  };
}

export function createStory(
  userId: string,
  input: {
    content?: string;
    imageUrl?: string;
    musicTrack?: unknown;
    taggedUserIds?: unknown;
  }
): { ok: true; story: PublicStory } | { ok: false; error: string } {
  const user = db.users.get(userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable' };

  purgeExpiredStories();

  const imageUrl = normalizeImageUrl(input.imageUrl);
  const content = normalizeContent(input.content ?? '', { allowEmpty: Boolean(imageUrl) });
  if (content == null) {
    return { ok: false, error: 'Le texte ne peut pas être vide.' };
  }
  if (!content && !imageUrl) {
    return { ok: false, error: 'Ajoutez du texte ou une image.' };
  }
  if (input.imageUrl != null && String(input.imageUrl).trim() && !imageUrl) {
    return { ok: false, error: 'Image invalide ou trop volumineuse.' };
  }

  const now = Date.now();
  const kept = db.stories.filter((s) => s.userId !== userId || !isActive(s, now));
  db.stories.length = 0;
  db.stories.push(...kept);

  const musicTrack = normalizeMusicTrack(input.musicTrack);
  const taggedUserIds = normalizeTaggedUserIds(input.taggedUserIds, userId);

  const story: Story = {
    id: randomUUID(),
    userId,
    content: content || undefined,
    imageUrl,
    musicTrack,
    taggedUserIds,
    createdAt: now,
    expiresAt: now + STORY_TTL_MS,
  };
  db.stories.push(story);

  const pub = toPublicStory(story);
  if (!pub) return { ok: false, error: 'Erreur interne' };
  return { ok: true, story: pub };
}

export function getMyActiveStory(userId: string): PublicStory | null {
  purgeExpiredStories();
  const story = [...db.stories]
    .filter((s) => s.userId === userId && isActive(s))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!story) return null;
  return toPublicStory(story);
}

function latestActiveByUser(now = Date.now()): Map<string, Story> {
  const map = new Map<string, Story>();
  for (const story of db.stories) {
    if (!isActive(story, now)) continue;
    const prev = map.get(story.userId);
    if (!prev || story.createdAt > prev.createdAt) map.set(story.userId, story);
  }
  return map;
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

  const byUser = latestActiveByUser();
  const out: PublicStory[] = [];

  for (const story of byUser.values()) {
    if (!isVisibleToViewer(viewerId, story.userId)) continue;
    const author = db.users.get(story.userId);
    if (!author) continue;

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
