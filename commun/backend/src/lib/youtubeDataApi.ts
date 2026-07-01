import crypto from 'crypto';
import { resolveYoutubePlaylistId } from './musicLinks';
import type { RemoteVideoHit } from './youtubeRemote';
import { parseYoutubeApiResponse, YoutubeDataApiError } from './youtubeApiErrors';
import { canAttemptYoutubeSearchListCall, recordYoutubeSearchListCall } from './youtubeQuotaBudget';

/** TTL 1 h — conforme YouTube API Services (stockage max 24 h) et texte légal Soundy. */
export const YOUTUBE_DATA_API_CACHE_TTL_MS = 60 * 60 * 1000;

const ytDataCache = new Map<string, { data: unknown; expiresAt: number }>();

function pruneYtDataCache(now = Date.now()): void {
  if (ytDataCache.size <= 500) return;
  for (const [key, entry] of ytDataCache) {
    if (now >= entry.expiresAt) ytDataCache.delete(key);
  }
}

function getYtDataCached<T>(key: string): T | null {
  const entry = ytDataCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    ytDataCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setYtDataCached(key: string, data: unknown): void {
  pruneYtDataCache();
  ytDataCache.set(key, { data, expiresAt: Date.now() + YOUTUBE_DATA_API_CACHE_TTL_MS });
}

function tokenCacheKey(accessToken?: string): string {
  if (!accessToken) return 'public';
  return crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 16);
}

export function youtubeDataApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY?.trim() || undefined;
}

function apiKey(): string | undefined {
  return youtubeDataApiKey();
}

function thumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchSearchHits(
  query: string,
  options: { apiKey?: string; accessToken?: string }
): Promise<RemoteVideoHit[]> {
  // search.list a un bucket de quota dédié (100 appels/jour, tout le projet) distinct des
  // 10 000 unités générales — protection proactive avant de consommer le budget restant.
  if (!canAttemptYoutubeSearchListCall()) {
    throw new YoutubeDataApiError(
      'Budget quotidien search.list épuisé (protection proactive côté serveur)',
      429,
      'quota_exceeded'
    );
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '12',
    q: query,
  });
  if (options.apiKey) params.set('key', options.apiKey);

  recordYoutubeSearchListCall();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    headers: options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : undefined,
    signal: AbortSignal.timeout(8000),
  });
  await parseYoutubeApiResponse(res);

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };
  if (!data.items?.length) return [];

  const out: RemoteVideoHit[] = [];
  for (const item of data.items) {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title?.trim();
    if (!videoId || !title) continue;
    out.push({
      videoId,
      title: (item.snippet?.title ?? '').slice(0, 120),
      artist: (item.snippet?.channelTitle ?? 'YouTube').slice(0, 80),
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.default?.url ??
        thumb(videoId),
    });
  }
  return out;
}

/** Public search via YouTube Data API — API key (preferred) or user OAuth (youtube.readonly). */
export async function searchVideosViaDataApi(
  query: string,
  accessToken?: string
): Promise<RemoteVideoHit[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const cacheKey = `search:${normalized}:${tokenCacheKey(accessToken)}`;
  const cached = getYtDataCached<RemoteVideoHit[]>(cacheKey);
  if (cached) return cached;

  const key = apiKey();
  let out: RemoteVideoHit[] = [];
  let lastError: YoutubeDataApiError | undefined;

  if (key) {
    try {
      out = await fetchSearchHits(query, { apiKey: key });
    } catch (e) {
      if (e instanceof YoutubeDataApiError) {
        if (e.isQuotaExceeded) throw e;
        lastError = e;
      } else {
        throw e;
      }
    }
  }
  if (!out.length && accessToken) {
    try {
      out = await fetchSearchHits(query, { accessToken });
    } catch (e) {
      if (e instanceof YoutubeDataApiError) throw e;
      lastError = e instanceof YoutubeDataApiError ? e : lastError;
    }
  }

  if (!out.length && lastError && !key && !accessToken) {
    throw lastError;
  }

  if (out.length) setYtDataCached(cacheKey, out);
  return out;
}

export interface YoutubePlaylistSummary {
  playlistId: string;
  title: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

export async function listMyPlaylists(accessToken: string): Promise<YoutubePlaylistSummary[]> {
  const cacheKey = `playlists:${tokenCacheKey(accessToken)}`;
  const cached = getYtDataCached<YoutubePlaylistSummary[]>(cacheKey);
  if (cached) return cached;

  const out: YoutubePlaylistSummary[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '25',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    await parseYoutubeApiResponse(res);
    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        snippet?: { title?: string; thumbnails?: { medium?: { url?: string } } };
        contentDetails?: { itemCount?: number };
      }>;
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      if (!item.id) continue;
      out.push({
        playlistId: item.id,
        title: (item.snippet?.title ?? 'Playlist').slice(0, 120),
        itemCount: item.contentDetails?.itemCount,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url,
      });
    }
    pageToken = data.nextPageToken;
    if (out.length >= 50) break;
  } while (pageToken);

  if (out.length) setYtDataCached(cacheKey, out);
  return out;
}

export async function fetchPlaylistItems(
  playlistId: string,
  accessToken?: string
): Promise<RemoteVideoHit[]> {
  const normalizedPlaylistId = resolveYoutubePlaylistId(playlistId) ?? playlistId.trim();
  const cacheKey = `playlistItems:${normalizedPlaylistId}:${tokenCacheKey(accessToken)}`;
  const cached = getYtDataCached<RemoteVideoHit[]>(cacheKey);
  if (cached) return cached;

  const key = apiKey();
  if (!key && !accessToken) return [];

  const out: RemoteVideoHit[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: normalizedPlaylistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);
    if (key) params.set('key', key);

    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: AbortSignal.timeout(12000),
    });
    await parseYoutubeApiResponse(res);
    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          videoOwnerChannelTitle?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string } };
          resourceId?: { videoId?: string };
        };
      }>;
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId || videoId === 'deleted') continue;
      const title = item.snippet?.title ?? 'Sans titre';
      if (title === 'Private video' || title === 'Deleted video') continue;
      out.push({
        videoId,
        title: title.slice(0, 120),
        artist: (item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? 'YouTube').slice(
          0,
          80
        ),
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? thumb(videoId),
      });
    }
    pageToken = data.nextPageToken;
    if (out.length >= 50) break;
  } while (pageToken);

  if (out.length) setYtDataCached(cacheKey, out);
  return out;
}

export interface YoutubeVideoSnippet {
  title: string;
  artist: string;
}

/** Métadonnées snippet pour une liste de videoIds (videos.list). */
export async function fetchVideoSnippetsViaDataApi(
  videoIds: string[],
  accessToken?: string
): Promise<Map<string, YoutubeVideoSnippet>> {
  const out = new Map<string, YoutubeVideoSnippet>();
  const unique = [...new Set(videoIds.filter((id) => id && id !== 'demo'))].slice(0, 50);
  if (unique.length === 0) return out;

  const key = apiKey();
  if (!key && !accessToken) return out;

  const cacheKey = `snippets:${unique.sort().join(',')}:${tokenCacheKey(accessToken)}`;
  const cached = getYtDataCached<Record<string, YoutubeVideoSnippet>>(cacheKey);
  if (cached) {
    for (const [id, meta] of Object.entries(cached)) out.set(id, meta);
    return out;
  }

  const params = new URLSearchParams({
    part: 'snippet',
    id: unique.join(','),
  });
  if (key) params.set('key', key);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    signal: AbortSignal.timeout(10000),
  });
  await parseYoutubeApiResponse(res);

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; channelTitle?: string };
    }>;
  };

  const cachePayload: Record<string, YoutubeVideoSnippet> = {};
  for (const item of data.items ?? []) {
    if (!item.id || !item.snippet?.title) continue;
    const meta = {
      title: item.snippet.title.slice(0, 120),
      artist: (item.snippet.channelTitle ?? 'YouTube').slice(0, 80),
    };
    out.set(item.id, meta);
    cachePayload[item.id] = meta;
  }

  if (Object.keys(cachePayload).length) setYtDataCached(cacheKey, cachePayload);
  return out;
}

export { YoutubeDataApiError };
