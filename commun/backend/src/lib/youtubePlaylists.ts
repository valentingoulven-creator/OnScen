import { User } from '../models/schema';
import { resolveYoutubePlaylistId } from './musicLinks';
import { isPlatformConnected, isRealYoutubeAccount } from './platformConnect';
import {
  fetchPlaylistItems,
  listMyPlaylists,
  type YoutubePlaylistSummary,
} from './youtubeDataApi';
import { ensureYoutubeAccessToken } from './youtubeOAuth';
import { isYoutubeRemoteFallbackAllowed } from './youtubeCompliance';
import { buildPlatformTrackUrl } from './musicLinks';
import type { YoutubeSearchResult } from './youtubeSearch';

/** Playlists publiques pour démo msdev (sans OAuth utilisateur réel). */
export const MSDEV_DEMO_PLAYLISTS: YoutubePlaylistSummary[] = [
  {
    playlistId: 'PL4fGSIoZAXrht3x3hSL-hVZMeiqXqQ-9',
    title: 'Global Top Music Videos',
  },
  {
    playlistId: 'PLFgquLnL0alnA5U6mZQLR2CCS9xTkouo',
    title: 'Pop Culture',
  },
];

export async function listHostYoutubePlaylists(user: User): Promise<YoutubePlaylistSummary[]> {
  if (!isPlatformConnected(user, 'youtube')) return [];

  // Determine whether this is a real OAuth account BEFORE any potential token refresh,
  // so we can decide whether to show demo playlists or an empty list on failure.
  const isReal = isRealYoutubeAccount(user);

  // Obtain a fresh token — ensureYoutubeAccessToken refreshes an expired token when possible.
  const token = await ensureYoutubeAccessToken(user);
  if (token) {
    const mine = await listMyPlaylists(token);
    if (mine.length) return mine;
  }

  // Real OAuth user but no playlists returned (token expired with no valid refresh, or the
  // account genuinely has no playlists) → return an empty list so the frontend can prompt
  // the user to reconnect or paste a playlist URL.
  if (isReal) return [];

  // Mock / legacy (msdev) connection → show demo playlists as a convenience.
  return MSDEV_DEMO_PLAYLISTS;
}

export async function resolvePlaylistVideos(
  playlistId: string,
  accessToken?: string
): Promise<YoutubeSearchResult[]> {
  const normalizedId = resolveYoutubePlaylistId(playlistId) ?? playlistId.trim();
  let hits = await fetchPlaylistItems(normalizedId, accessToken);
  if (!hits.length && isYoutubeRemoteFallbackAllowed()) {
    // Import dynamique : voir youtubeSearch.ts — module chargé uniquement en msdev.
    const { fetchPlaylistVideosViaPiped } = await import('./youtubeRemote');
    hits = await fetchPlaylistVideosViaPiped(normalizedId);
  }
  return hits.map((h) => ({
    videoId: h.videoId,
    title: h.title,
    artist: h.artist,
    thumbnailUrl: h.thumbnailUrl,
    externalUrl: buildPlatformTrackUrl('youtube', h.videoId),
  }));
}
