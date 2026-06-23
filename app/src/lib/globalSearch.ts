import { api } from './api';
import { searchPlaces, type PlaceSearchHit } from './placeSearch';
import type { UserSearchHit } from '../types';

export type {
  GlobalSearchAlbumHit,
  GlobalSearchEventHit,
  GlobalSearchSongHit,
} from './globalSearchTypes';

import type {
  GlobalSearchAlbumHit,
  GlobalSearchEventHit,
  GlobalSearchSongHit,
} from './globalSearchTypes';

export type GlobalSearchResultItem =
  | ({ kind: 'user' } & UserSearchHit)
  | GlobalSearchEventHit
  | GlobalSearchAlbumHit
  | GlobalSearchSongHit
  | PlaceSearchHit;

export interface GlobalSearchGroupedResults {
  users: UserSearchHit[];
  events: GlobalSearchEventHit[];
  albums: GlobalSearchAlbumHit[];
  songs: GlobalSearchSongHit[];
  places: PlaceSearchHit[];
  flat: GlobalSearchResultItem[];
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

  const [apiResult, places] = await Promise.all([
    api.globalSearch(token, q, signal),
    searchPlaces(q, { signal }),
  ]);

  const flat: GlobalSearchResultItem[] = [
    ...places,
    ...apiResult.events,
    ...apiResult.users.map((u) => ({ kind: 'user' as const, ...u })),
    ...apiResult.albums,
    ...apiResult.songs,
  ];

  return {
    users: apiResult.users,
    events: apiResult.events,
    albums: apiResult.albums,
    songs: apiResult.songs,
    places,
    flat,
  };
}
