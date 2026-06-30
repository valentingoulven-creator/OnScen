import type { MusicPlatform, PlaybackState, Salon, SalonQueueItem } from '../models/schema';
import { fetchVideoSnippetsViaDataApi } from './youtubeDataApi';

/** Marge de sécurité vs limite ToS Google (24 h). */
export const YOUTUBE_METADATA_MAX_AGE_MS = 23 * 60 * 60 * 1000;

export function isYoutubeMetadataStale(fetchedAt?: number, now = Date.now()): boolean {
  if (fetchedAt == null || !Number.isFinite(fetchedAt)) return true;
  return now - fetchedAt > YOUTUBE_METADATA_MAX_AGE_MS;
}

export function youtubeMetadataNow(): number {
  return Date.now();
}

/** Purge les métadonnées API expirées avant persistance PostgreSQL (conformité ToS). */
export function purgeStaleYoutubeMetadataForStorage(
  salon: Salon,
  queue: SalonQueueItem[]
): void {
  if (salon.platform !== 'youtube') return;
  const now = Date.now();

  const ps = salon.playbackState;
  if (ps && isYoutubeMetadataStale(ps.metadataFetchedAt, now)) {
    ps.title = ps.trackId && ps.trackId !== 'demo' ? ps.trackId : 'YouTube';
    ps.artist = 'YouTube';
    delete ps.albumArtUrl;
    delete ps.metadataFetchedAt;
  }

  for (const item of queue) {
    if (!isYoutubeMetadataStale(item.metadataFetchedAt, now)) continue;
    item.title = item.trackId && item.trackId !== 'demo' ? item.trackId : 'YouTube';
    item.artist = 'YouTube';
    delete item.albumArtUrl;
    delete item.metadataFetchedAt;
  }
}

/** Rafraîchit les métadonnées YouTube expirées/manquantes avant envoi client. */
export async function refreshStaleYoutubeSalonMetadata(
  salon: Salon,
  queue: SalonQueueItem[],
  accessToken?: string
): Promise<void> {
  if (salon.platform !== 'youtube') return;

  const staleIds = new Set<string>();
  const ps = salon.playbackState;
  if (ps?.trackId && ps.trackId !== 'demo' && isYoutubeMetadataStale(ps.metadataFetchedAt)) {
    staleIds.add(ps.trackId);
  }
  for (const item of queue) {
    if (item.trackId && item.trackId !== 'demo' && isYoutubeMetadataStale(item.metadataFetchedAt)) {
      staleIds.add(item.trackId);
    }
  }
  if (staleIds.size === 0) return;

  const snippets = await fetchVideoSnippetsViaDataApi([...staleIds], accessToken);
  const now = youtubeMetadataNow();

  if (ps?.trackId && staleIds.has(ps.trackId)) {
    const meta = snippets.get(ps.trackId);
    if (meta) {
      ps.title = meta.title;
      ps.artist = meta.artist;
      ps.metadataFetchedAt = now;
    }
  }

  for (const item of queue) {
    if (!item.trackId || !staleIds.has(item.trackId)) continue;
    const meta = snippets.get(item.trackId);
    if (meta) {
      item.title = meta.title;
      item.artist = meta.artist;
      item.metadataFetchedAt = now;
    }
  }
}

export function stampYoutubePlaybackMetadata(
  platform: MusicPlatform,
  state: PlaybackState
): PlaybackState {
  if (platform !== 'youtube') return state;
  return { ...state, metadataFetchedAt: youtubeMetadataNow() };
}

export function stampYoutubeQueueItemMetadata(
  platform: MusicPlatform,
  item: SalonQueueItem
): SalonQueueItem {
  if (platform !== 'youtube') return item;
  return { ...item, metadataFetchedAt: youtubeMetadataNow() };
}
