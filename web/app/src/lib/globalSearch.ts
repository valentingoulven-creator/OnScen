import { api } from './api';
import { feedApi } from './api/feed';
import { musicApi } from './api/music';
import { hasUpcomingEventDate } from './feedEvents';
import { searchPlaces, type PlaceSearchHit } from './placeSearch';
import type { MusicSearchPayload } from './musicTypes';
import type { FeedPost, UserSearchHit } from '../types';

export type {
  GlobalSearchAlbumHit,
  GlobalSearchEventHit,
  GlobalSearchResultItem,
  GlobalSearchSongHit,
} from './globalSearchTypes';

export type { GlobalSearchFilter } from './globalSearchFilter';
export { filterGlobalSearchResults, matchesGlobalSearchFilter } from './globalSearchFilter';

import type {
  GlobalSearchAlbumHit,
  GlobalSearchEventHit,
  GlobalSearchResultItem,
  GlobalSearchSongHit,
} from './globalSearchTypes';

export interface GlobalSearchGroupedResults {
  users: UserSearchHit[];
  events: GlobalSearchEventHit[];
  albums: GlobalSearchAlbumHit[];
  songs: GlobalSearchSongHit[];
  places: PlaceSearchHit[];
  flat: GlobalSearchResultItem[];
}

const MAX_EVENTS = 6;
const MAX_USERS = 6;

function normalizeSearchQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function textMatchesQuery(q: string, ...texts: (string | undefined)[]): boolean {
  return texts.some((text) => {
    const hay = normalizeSearchQuery(text ?? '');
    return hay.length > 0 && hay.includes(q);
  });
}

function toUserHit(u: UserSearchHit): GlobalSearchResultItem {
  return { ...u, kind: 'user' };
}

function toEventHit(post: FeedPost): GlobalSearchEventHit {
  const primaryDate = post.eventDates?.[0] ?? post.eventDate;
  return {
    id: post.id,
    title: post.content.trim() || 'Événement',
    eventLocation: post.eventLocation,
    eventDate: primaryDate,
    authorId: post.author.id,
    authorUsername: post.author.username,
    kind: 'event',
  };
}

function toEventHitFromApi(e: GlobalSearchEventHit): GlobalSearchEventHit {
  return { ...e, kind: 'event' };
}

function toAlbumHit(a: GlobalSearchAlbumHit): GlobalSearchAlbumHit {
  return { ...a, kind: 'album' };
}

function toSongHit(s: GlobalSearchSongHit): GlobalSearchSongHit {
  return { ...s, kind: 'song' };
}

function musicHitsFromSearch(payload: MusicSearchPayload): {
  albums: GlobalSearchAlbumHit[];
  songs: GlobalSearchSongHit[];
} {
  return {
    albums: payload.albums.map((a) => ({
      id: a.id,
      userId: a.userId,
      title: a.title,
      authorUsername: a.creatorName,
      coverUrl: a.coverUrl,
      kind: 'album' as const,
    })),
    songs: payload.tracks.map((t) => ({
      id: t.id,
      userId: t.hostId,
      title: t.title,
      artist: t.artist,
      authorUsername: t.creatorName,
      albumId: t.albumId,
      kind: 'song' as const,
    })),
  };
}

function mergeById<T extends { id: string }>(primary: T[], extra: T[], limit: number): T[] {
  const seen = new Set(primary.map((item) => item.id));
  const merged = [...primary];
  for (const item of extra) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}

async function searchEventsFromFeed(
  token: string,
  q: string,
  signal?: AbortSignal
): Promise<GlobalSearchEventHit[]> {
  if (signal?.aborted) return [];
  try {
    const { posts } = await feedApi.getFeedPosts(token, { eventsOnly: true, limit: 120 });
    if (signal?.aborted) return [];
    return posts
      .filter((p) => p.isEvent && hasUpcomingEventDate(p))
      .filter((p) =>
        textMatchesQuery(
          q,
          p.content,
          p.eventLocation,
          p.author.username,
          ...(p.eventTaggedUsers?.map((u) => u.username) ?? [])
        )
      )
      .slice(0, MAX_EVENTS)
      .map(toEventHit);
  } catch {
    return [];
  }
}

async function searchUsersFallback(
  token: string,
  q: string,
  signal?: AbortSignal
): Promise<UserSearchHit[]> {
  if (signal?.aborted) return [];
  try {
    const { users } = await api.searchUsers(token, q, signal);
    return (users ?? []).slice(0, MAX_USERS);
  } catch {
    return [];
  }
}

export async function searchGlobal(
  token: string,
  query: string,
  signal?: AbortSignal
): Promise<GlobalSearchGroupedResults> {
  const q = query.trim();
  if (q.length < 2) {
    return { users: [], events: [], albums: [], songs: [], places: [], flat: [] };
  }
  const normalizedQ = normalizeSearchQuery(q);

  const [globalSettled, placesSettled, musicSettled, feedEventsSettled, usersSettled] =
    await Promise.allSettled([
      api.globalSearch(token, q, signal),
      searchPlaces(q, { signal }),
      musicApi.searchMusic(token, q),
      searchEventsFromFeed(token, normalizedQ, signal),
      searchUsersFallback(token, q, signal),
    ]);

  let users: UserSearchHit[] = [];
  let events: GlobalSearchEventHit[] = [];
  let albums: GlobalSearchAlbumHit[] = [];
  let songs: GlobalSearchSongHit[] = [];

  if (globalSettled.status === 'fulfilled') {
    const apiResult = globalSettled.value;
    users = apiResult.users ?? [];
    events = (apiResult.events ?? []).map(toEventHitFromApi);
    albums = (apiResult.albums ?? []).map(toAlbumHit);
    songs = (apiResult.songs ?? []).map(toSongHit);
  }

  if (usersSettled.status === 'fulfilled' && usersSettled.value.length > 0) {
    users = mergeById(users, usersSettled.value, MAX_USERS);
  }

  if (feedEventsSettled.status === 'fulfilled') {
    events = mergeById(events, feedEventsSettled.value, MAX_EVENTS);
  }

  let places: PlaceSearchHit[] = [];
  if (placesSettled.status === 'fulfilled') {
    places = placesSettled.value;
  }

  if (musicSettled.status === 'fulfilled' && !signal?.aborted) {
    const converted = musicHitsFromSearch(musicSettled.value);
    albums = mergeById(
      albums.map(toAlbumHit),
      converted.albums.map(toAlbumHit),
      MAX_EVENTS
    );
    songs = mergeById(songs.map(toSongHit), converted.songs.map(toSongHit), MAX_EVENTS);
  }

  const userItems = users.map(toUserHit);

  const flat: GlobalSearchResultItem[] = [
    ...places,
    ...events,
    ...albums,
    ...songs,
    ...userItems,
  ];

  return {
    users,
    events,
    albums,
    songs,
    places,
    flat,
  };
}
