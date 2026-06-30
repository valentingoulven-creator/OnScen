import { api } from './api';
import type { MapStory } from '../types';

export type StoriesBundle = {
  stories: MapStory[];
  mine: MapStory[];
};

type StoriesQuery = {
  latitude?: number;
  longitude?: number;
  radius?: number;
};

type CacheEntry = {
  token: string;
  queryKey: string;
  data: StoriesBundle;
  at: number;
};

const TTL_MS = 4000;
let cached: CacheEntry | null = null;
const inflight = new Map<string, Promise<StoriesBundle>>();

function queryKey(query?: StoriesQuery): string {
  if (!query) return 'all';
  return JSON.stringify({
    latitude: query.latitude ?? null,
    longitude: query.longitude ?? null,
    radius: query.radius ?? null,
  });
}

function normalizeMine(mineRes: Awaited<ReturnType<typeof api.getMyStory>>): MapStory[] {
  if (mineRes.stories?.length) return mineRes.stories;
  return mineRes.story ? [mineRes.story] : [];
}

export function invalidateStoriesCache(): void {
  cached = null;
  inflight.clear();
}

export async function fetchStoriesBundle(
  token: string,
  query?: StoriesQuery,
  options?: { force?: boolean }
): Promise<StoriesBundle> {
  const key = queryKey(query);
  const now = Date.now();
  const force = options?.force ?? false;

  if (
    !force &&
    cached &&
    cached.token === token &&
    cached.queryKey === key &&
    now - cached.at < TTL_MS
  ) {
    return cached.data;
  }

  const inflightKey = `${token}:${key}`;
  const pending = inflight.get(inflightKey);
  if (!force && pending) return pending;

  const request = Promise.all([
    api.getStories(token, query),
    api.getMyStory(token),
  ])
    .then(([storiesRes, mineRes]) => {
      const data: StoriesBundle = {
        stories: storiesRes.stories ?? [],
        mine: normalizeMine(mineRes),
      };
      cached = { token, queryKey: key, data, at: Date.now() };
      inflight.delete(inflightKey);
      return data;
    })
    .catch((err) => {
      inflight.delete(inflightKey);
      throw err;
    });

  inflight.set(inflightKey, request);
  return request;
}
