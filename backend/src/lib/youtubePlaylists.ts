import { User } from '../models/schema';
import { getYoutubeAccessToken, isPlatformConnected } from './platformConnect';
import {
  fetchPlaylistItems,
  listMyPlaylists,
  type YoutubePlaylistSummary,
} from './youtubeDataApi';
import { fetchPlaylistVideosViaPiped } from './youtubeRemote';
import { isYoutubeRemoteFallbackAllowed } from './youtubeCompliance';
import { buildPlatformTrackUrl } from './musicLinks';
import type { YoutubeSearchResult } from './youtubeSearch';

/** Playlists publiques pour démo msdev (sans OAuth utilisateur). */
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
  const token = getYoutubeAccessToken(user);
  if (token) {
    const mine = await listMyPlaylists(token);
    if (mine.length) return mine;
  }
  return MSDEV_DEMO_PLAYLISTS;
}

export async function resolvePlaylistVideos(
  playlistId: string,
  accessToken?: string
): Promise<YoutubeSearchResult[]> {
  let hits = await fetchPlaylistItems(playlistId, accessToken);
  if (!hits.length && isYoutubeRemoteFallbackAllowed()) {
    hits = await fetchPlaylistVideosViaPiped(playlistId);
  }
  return hits.map((h) => ({
    videoId: h.videoId,
    title: h.title,
    artist: h.artist,
    thumbnailUrl: h.thumbnailUrl,
    externalUrl: buildPlatformTrackUrl('youtube', h.videoId),
  }));
}
