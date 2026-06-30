import { db, Story } from './models/schema';
import { getFavoriteHostIds } from './lib/favorites';
import { schedulePersist } from './lib/persist';
import { getYoutubeDemoPool } from './lib/musicCatalog';
import {
  MSDEV_LISTENER_ID,
  PREFERRED_FAVORITE_HOST_IDS,
  seedMsdevUserFavorites,
} from './seed-favorite-feed';

/** Préfixe idempotent des stories seed msdev. */
export const MSDEV_STORY_ID_PREFIX = 'msdev-story-';

/** Nombre cible d'auteurs favoris avec au moins une story active. */
export const MSDEV_STORY_AUTHOR_TARGET = 8;

/** Seuil de réparation auto (démarrage msdev) — en dessous, on regénère. */
export const MSDEV_STORY_MIN_AUTHORS = 4;

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const STORY_MAX_AGE_OFFSET_MS = 6 * 60 * 60 * 1000;

const STORY_CONTENT_SAMPLES = [
  'En live ce soir — qui vient ? 🎵',
  'Découverte du jour ✨',
  'Ambiance parfaite pour coder ce matin ☕',
  'Session chill en cours 🎧',
  'Petit partage musical du moment 🔥',
  'La carte est animée autour de moi 🗺️',
  'Track du jour — impossible de s\'en lasser 🔁',
  'Bonne vibe ce weekend 🎉',
  'Premier live bientôt — un peu stressé 😅',
  'Soundy + musique = combo parfait ❤️',
  'Qui écoute la même chose que moi ? 👂',
  'Salon ouvert — rejoignez-moi 🙌',
];

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=720',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=720',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=720',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=720',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=720',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=720',
];

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

function storyHash(authorId: string, index: number | string, salt = ''): number {
  const key = `${authorId}:${index}:${salt}`;
  let h = 0x73746f72;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function countMsdevSeedStories(now = Date.now()): number {
  return db.stories.filter(
    (s) => s.id.startsWith(MSDEV_STORY_ID_PREFIX) && s.expiresAt > now
  ).length;
}

export function countFollowedAuthorsWithActiveStories(
  viewerId: string,
  now = Date.now()
): number {
  const favoriteIds = new Set(getFavoriteHostIds(viewerId));
  const authors = new Set<string>();
  for (const story of db.stories) {
    if (story.expiresAt <= now) continue;
    if (favoriteIds.has(story.userId)) authors.add(story.userId);
  }
  return authors.size;
}

function removeMsdevSeedStories(): number {
  const before = db.stories.length;
  db.stories = db.stories.filter((s) => !s.id.startsWith(MSDEV_STORY_ID_PREFIX));
  return before - db.stories.length;
}

function pickStoryAuthors(viewerId: string): string[] {
  const favoriteIds = getFavoriteHostIds(viewerId).filter((id) => db.users.has(id));
  const preferredSet = new Set<string>(PREFERRED_FAVORITE_HOST_IDS);
  const preferred = PREFERRED_FAVORITE_HOST_IDS.filter((id) => favoriteIds.includes(id));
  const rest = favoriteIds.filter((id) => !preferredSet.has(id));
  return [...preferred, ...rest].slice(0, MSDEV_STORY_AUTHOR_TARGET);
}

function buildStoryImage(authorId: string, index: number): string {
  const user = db.users.get(authorId);
  const kind = storyHash(authorId, index, 'img') % 100;
  if (kind < 35 && user?.avatarUrl?.startsWith('https://')) return user.avatarUrl;
  if (kind < 65) {
    return `https://picsum.photos/seed/${encodeURIComponent(`${authorId}-${index}`)}/720/1280`;
  }
  return UNSPLASH_IMAGES[storyHash(authorId, index, 'unsplash') % UNSPLASH_IMAGES.length]!;
}

function buildStoryContent(authorId: string, index: number): string {
  const tracks = getYoutubeDemoPool();
  if (storyHash(authorId, index, 'track') % 100 < 20 && tracks.length > 0) {
    const track = tracks[storyHash(authorId, index, 'track-pick') % tracks.length]!;
    return `En ce moment : "${track.title}" 🎶`;
  }
  return STORY_CONTENT_SAMPLES[storyHash(authorId, index, 'text') % STORY_CONTENT_SAMPLES.length]!;
}

function authorHasActiveStory(authorId: string, now = Date.now()): boolean {
  return db.stories.some((s) => s.userId === authorId && s.expiresAt > now);
}

function insertMsdevStory(authorId: string, storyIndex: number, createdOffsetMs: number): boolean {
  const id = `${MSDEV_STORY_ID_PREFIX}${authorId}-${storyIndex}`;
  if (db.stories.some((s) => s.id === id)) return false;

  const now = Date.now();
  const createdAt = now - createdOffsetMs;
  const story: Story = {
    id,
    userId: authorId,
    content: buildStoryContent(authorId, storyIndex),
    imageUrl: buildStoryImage(authorId, storyIndex),
    createdAt,
    expiresAt: createdAt + STORY_TTL_MS,
    visibility: 'followers',
  };

  if (storyHash(authorId, storyIndex, 'music') % 100 < 15) {
    const tracks = getYoutubeDemoPool();
    if (tracks.length > 0) {
      const track = tracks[storyHash(authorId, storyIndex, 'music-pick') % tracks.length]!;
      story.musicTrack = {
        title: track.title,
        artist: track.artist,
        videoId: track.trackId,
      };
    }
  }

  db.stories.push(story);
  return true;
}

export function needsMsdevStoriesRepair(viewerId = MSDEV_LISTENER_ID): boolean {
  if (!isMsdevEnvironment()) return false;
  if (!db.users.has(viewerId)) return false;
  return countFollowedAuthorsWithActiveStories(viewerId) < MSDEV_STORY_MIN_AUTHORS;
}

export interface SeedMsdevStoriesResult {
  created: number;
  total: number;
  authorsWithStories: number;
  removed?: number;
  authorIds: string[];
}

/**
 * Génère des stories aléatoires pour les favoris de listener@msdev.local (msdev uniquement).
 * Idempotent : complète jusqu'à MSDEV_STORY_AUTHOR_TARGET auteurs sans story active.
 */
export function seedMsdevStories(options?: {
  force?: boolean;
  viewerId?: string;
}): SeedMsdevStoriesResult {
  const viewerId = options?.viewerId ?? MSDEV_LISTENER_ID;

  if (!isMsdevEnvironment()) {
    return {
      created: 0,
      total: countMsdevSeedStories(),
      authorsWithStories: countFollowedAuthorsWithActiveStories(viewerId),
      authorIds: [],
    };
  }

  seedMsdevUserFavorites();

  let removed = 0;
  if (options?.force) {
    removed = removeMsdevSeedStories();
  }

  const shouldSeed = options?.force === true || needsMsdevStoriesRepair(viewerId);
  if (!shouldSeed) {
    return {
      created: 0,
      total: countMsdevSeedStories(),
      authorsWithStories: countFollowedAuthorsWithActiveStories(viewerId),
      removed: removed || undefined,
      authorIds: [],
    };
  }

  const authors = pickStoryAuthors(viewerId);
  let created = 0;
  const seededAuthors: string[] = [];

  for (const authorId of authors) {
    if (
      !options?.force &&
      countFollowedAuthorsWithActiveStories(viewerId) >= MSDEV_STORY_AUTHOR_TARGET
    ) {
      break;
    }
    if (!options?.force && authorHasActiveStory(authorId)) continue;

    if (options?.force) {
      db.stories = db.stories.filter(
        (s) => !(s.id.startsWith(MSDEV_STORY_ID_PREFIX) && s.userId === authorId)
      );
    }

    const storyCount = 1 + (storyHash(authorId, 'count') % 2);
    let authorCreated = 0;
    for (let i = 0; i < storyCount; i++) {
      const offset = storyHash(authorId, i, 'age') % STORY_MAX_AGE_OFFSET_MS;
      if (insertMsdevStory(authorId, i, offset)) {
        created++;
        authorCreated++;
      }
    }
    if (authorCreated > 0) seededAuthors.push(authorId);
  }

  if (created > 0 || removed > 0) schedulePersist();

  return {
    created,
    total: countMsdevSeedStories(),
    authorsWithStories: countFollowedAuthorsWithActiveStories(viewerId),
    removed: removed || undefined,
    authorIds: seededAuthors,
  };
}
