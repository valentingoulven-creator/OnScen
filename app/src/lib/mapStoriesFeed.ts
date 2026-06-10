import type { MusicReel } from '../content/reels';
import type { MapStory, NearbyPerson, User } from '../types';
import { applyFavoritesFirst } from './nearbyPanelSettings';

export interface MapStoryEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  reelId?: string;
  posterUrl?: string;
  isFavorite: boolean;
  isLive?: boolean;
  liveId?: string;
  /** Story éphémère 24 h */
  storyId?: string;
  storyImageUrl?: string;
  hasActiveStory?: boolean;
  storyVisibility?: 'public' | 'followers';
}

const MAX_STORIES = 24;

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
  const map = new Map<string, MapStory>();
  for (const story of stories) {
    const prev = map.get(story.userId);
    if (!prev || story.createdAt > prev.createdAt) map.set(story.userId, story);
  }
  return map;
}

function applyStoryToEntry(entry: MapStoryEntry, story?: MapStory): MapStoryEntry {
  if (!story) return entry;
  return {
    ...entry,
    storyId: story.id,
    storyImageUrl: story.imageUrl,
    hasActiveStory: true,
    posterUrl: entry.posterUrl ?? story.imageUrl,
    storyVisibility: story.visibility,
  };
}

function personToEntry(
  person: NearbyPerson,
  reelByAuthor: Map<string, MusicReel>,
  favoriteIds: Set<string>,
  activeStories: Map<string, MapStory>
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
    },
    story
  );
}

function favoriteToEntry(
  user: User,
  reelByAuthor: Map<string, MusicReel>,
  seen: Set<string>,
  activeStories: Map<string, MapStory>
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
    },
    story
  );
}

function storyOnlyEntry(
  story: MapStory,
  favoriteIds: Set<string>
): MapStoryEntry {
  return {
    userId: story.userId,
    username: story.author.username,
    avatarUrl: story.author.avatarUrl,
    storyId: story.id,
    storyImageUrl: story.imageUrl,
    hasActiveStory: true,
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
  }
): MapStoryEntry[] {
  const favoriteIds =
    options?.favoriteIds ?? new Set(favorites.map((f) => f.id));
  const reelByAuthor = latestReelByAuthor(reels);
  const activeStories = storiesByUserId(options?.ephemeralStories ?? []);
  const seen = new Set<string>();
  const entries: MapStoryEntry[] = [];

  for (const person of nearbyPeople) {
    const entry = personToEntry(person, reelByAuthor, favoriteIds, activeStories);
    if (!entry) continue;
    seen.add(person.id);
    entries.push(entry);
  }

  for (const fav of favorites) {
    const entry = favoriteToEntry(fav, reelByAuthor, seen, activeStories);
    if (entry) entries.push(entry);
  }

  for (const story of activeStories.values()) {
    if (seen.has(story.userId)) continue;
    seen.add(story.userId);
    entries.push(storyOnlyEntry(story, favoriteIds));
  }

  const sorted = applyFavoritesFirst(
    entries,
    (e) => e.userId,
    favoriteIds,
    options?.favoritesFirst
  );

  return sorted.slice(0, MAX_STORIES);
}

/** Stories ouvrables dans la visionneuse (ordre bandeau : ma story puis entrées). */
export function buildViewableStories(
  entries: MapStoryEntry[],
  storiesByUser: Map<string, MapStory>,
  myStory?: MapStory | null
): MapStory[] {
  const list: MapStory[] = [];
  if (myStory) list.push(myStory);
  for (const entry of entries) {
    if (!entry.hasActiveStory || !entry.storyId) continue;
    const story = storiesByUser.get(entry.userId);
    if (story) list.push(story);
  }
  return list;
}
