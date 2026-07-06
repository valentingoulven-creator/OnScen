import type { MusicReel } from '../content/reels';
import type { MapStory, NearbyPerson, User } from '../types';
import { type ActiveLiveHostInfo } from './mapLiveEndSync';
import { applyFavoritesFirst } from './nearbyPanelSettings';
import { groupStoriesByUser, latestStory, sortStoriesChronological } from './storyViewerNav';

export type { ActiveLiveHostInfo };

/** Écrase isLive des entrées stories avec la carte lives API ; retire les flags périmés. */
export function resolveStoryEntryLive(
  entry: MapStoryEntry,
  activeLiveByHost: Map<string, ActiveLiveHostInfo>
): MapStoryEntry {
  const live = activeLiveByHost.get(entry.userId);
  if (!live) {
    if (!entry.isLive) return entry;
    const { isLive: _live, liveId: _id, liveViewersCount: _count, ...rest } = entry;
    return rest;
  }
  return {
    ...entry,
    isLive: true,
    liveId: live.liveId,
    liveViewersCount: live.liveViewersCount,
  };
}

export function purgeEndedLiveFromStoryEntries(
  entries: MapStoryEntry[],
  endedLiveId: string,
  hostId: string | undefined
): MapStoryEntry[] {
  return entries.map((entry) => {
    const matches =
      (endedLiveId && entry.liveId === endedLiveId) ||
      (hostId != null && entry.userId === hostId && entry.isLive);
    if (!matches) return entry;
    const { isLive: _live, liveId: _id, liveViewersCount: _count, ...rest } = entry;
    return rest;
  });
}

export interface MapStoryEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  reelId?: string;
  posterUrl?: string;
  isFavorite: boolean;
  isLive?: boolean;
  liveId?: string;
  liveViewersCount?: number;
  /** Story éphémère 24 h */
  storyId?: string;
  storyImageUrl?: string;
  hasActiveStory?: boolean;
  /** Nombre de stories actives (segments anneau) */
  storyCount?: number;
  storyVisibility?: 'public' | 'followers';
}

function latestReelByAuthor(reels: MusicReel[]): Map<string, MusicReel> {
  const map = new Map<string, MusicReel>();
  for (const reel of reels) {
    const authorId = reel.authorId?.trim();
    if (!authorId) continue;
    if (!map.has(authorId)) map.set(authorId, reel);
  }
  return map;
}

function storiesByUserId(stories: MapStory[]): Map<string, MapStory> {
  const grouped = groupStoriesByUser(stories);
  const map = new Map<string, MapStory>();
  for (const [userId, list] of grouped) {
    const latest = latestStory(list);
    if (latest) map.set(userId, latest);
  }
  return map;
}

function applyStoryToEntry(entry: MapStoryEntry, story?: MapStory, storyCount = 1): MapStoryEntry {
  if (!story) return entry;
  return {
    ...entry,
    storyId: story.id,
    storyImageUrl: story.imageUrl,
    hasActiveStory: true,
    storyCount,
    posterUrl: entry.posterUrl ?? story.imageUrl,
    storyVisibility: story.visibility,
  };
}

function personToEntry(
  person: NearbyPerson,
  reelByAuthor: Map<string, MusicReel>,
  favoriteIds: Set<string>,
  activeStories: Map<string, MapStory>,
  storyCounts: Map<string, number>
): MapStoryEntry | null {
  const reel = reelByAuthor.get(person.id);
  const story = activeStories.get(person.id);
  if (!reel && !person.isLive && !story) return null;
  return applyStoryToEntry(
    {
      userId: person.id,
      username: person.username,
      avatarUrl: person.avatarUrl,
      reelId: reel?.id,
      posterUrl: reel?.posterUrl,
      isFavorite: favoriteIds.has(person.id),
      isLive: person.isLive,
      liveId: person.liveId,
      liveViewersCount: person.liveViewersCount,
    },
    story,
    storyCounts.get(person.id) ?? 1
  );
}

function favoriteToEntry(
  user: User,
  reelByAuthor: Map<string, MusicReel>,
  seen: Set<string>,
  activeStories: Map<string, MapStory>,
  storyCounts: Map<string, number>
): MapStoryEntry | null {
  if (seen.has(user.id)) return null;
  const reel = reelByAuthor.get(user.id);
  const story = activeStories.get(user.id);
  if (!reel && !user.isLive && !story) return null;
  seen.add(user.id);
  return applyStoryToEntry(
    {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      reelId: reel?.id,
      posterUrl: reel?.posterUrl,
      isFavorite: true,
      isLive: user.isLive,
      liveId: user.liveId,
      liveViewersCount: user.liveViewersCount,
    },
    story,
    storyCounts.get(user.id) ?? 1
  );
}

function storyOnlyEntry(
  story: MapStory,
  favoriteIds: Set<string>,
  storyCount: number
): MapStoryEntry {
  return {
    userId: story.userId,
    username: story.author.username,
    avatarUrl: story.author.avatarUrl,
    storyId: story.id,
    storyImageUrl: story.imageUrl,
    hasActiveStory: true,
    storyCount,
    posterUrl: story.imageUrl,
    isFavorite: favoriteIds.has(story.userId),
    storyVisibility: story.visibility,
  };
}

/** Stories carte : personnes à proximité / favoris avec reel, live ou story 24 h. */
export function buildMapStoryEntries(
  nearbyPeople: NearbyPerson[],
  favorites: User[],
  reels: MusicReel[],
  options?: {
    favoritesFirst?: boolean;
    favoriteIds?: Set<string>;
    ephemeralStories?: MapStory[];
    /** Lives actifs (GET /lives) — seule source fiable pour isLive sur les anneaux. */
    activeLiveByHost?: Map<string, ActiveLiveHostInfo>;
  }
): MapStoryEntry[] {
  const favoriteIds =
    options?.favoriteIds ?? new Set(favorites.map((f) => f.id));
  const reelByAuthor = latestReelByAuthor(reels);
  const grouped = groupStoriesByUser(options?.ephemeralStories ?? []);
  const storyCounts = new Map<string, number>();
  for (const [userId, list] of grouped) storyCounts.set(userId, list.length);
  const activeStories = storiesByUserId(options?.ephemeralStories ?? []);
  const seen = new Set<string>();
  const entries: MapStoryEntry[] = [];

  for (const person of nearbyPeople) {
    const entry = personToEntry(person, reelByAuthor, favoriteIds, activeStories, storyCounts);
    if (!entry) continue;
    seen.add(person.id);
    entries.push(entry);
  }

  for (const fav of favorites) {
    const entry = favoriteToEntry(fav, reelByAuthor, seen, activeStories, storyCounts);
    if (entry) entries.push(entry);
  }

  for (const [userId, list] of grouped) {
    if (seen.has(userId)) continue;
    const latest = latestStory(list);
    if (!latest) continue;
    seen.add(userId);
    entries.push(storyOnlyEntry(latest, favoriteIds, list.length));
  }

  const sorted = applyFavoritesFirst(
    entries,
    (e) => e.userId,
    favoriteIds,
    options?.favoritesFirst
  );

  if (options?.activeLiveByHost) {
    return sorted.map((entry) => resolveStoryEntryLive(entry, options.activeLiveByHost!));
  }

  return sorted;
}

/** Stories ouvrables dans la visionneuse (ordre bandeau : ma story puis entrées). */
export function buildViewableStories(
  entries: MapStoryEntry[],
  storiesByUser: Map<string, MapStory[]>,
  myStories?: MapStory[] | null
): MapStory[] {
  const list: MapStory[] = [];
  if (myStories?.length) list.push(...sortStoriesChronological(myStories));
  for (const entry of entries) {
    if (!entry.hasActiveStory || !entry.storyId) continue;
    const stack = storiesByUser.get(entry.userId);
    if (stack?.length) list.push(...stack);
  }
  return list;
}
