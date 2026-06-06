import type { MusicPlatform } from '../models/schema';
import { findMockMatch } from './musicCatalog';

export type TrackMatchType = 'exact' | 'mock' | 'search';

export interface ResolvedTrack {
  platform: MusicPlatform;
  title: string;
  artist: string;
  trackId?: string;
  externalUrl: string;
  searchUrl: string;
  matchType: TrackMatchType;
}

export function buildSearchQuery(title: string, artist: string): string {
  return `${title} ${artist}`.trim();
}

export function buildPlatformSearchUrl(platform: MusicPlatform, title: string, artist: string): string {
  const q = encodeURIComponent(buildSearchQuery(title, artist));
  if (platform === 'youtube') {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  return `https://open.spotify.com/search/${q}`;
}

export function buildPlatformTrackUrl(platform: MusicPlatform, trackId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/watch?v=${trackId}`;
  }
  return `https://open.spotify.com/track/${trackId}`;
}

export function resolveTrackForPlatform(
  title: string,
  artist: string,
  targetPlatform: MusicPlatform,
  hostPlatform: MusicPlatform,
  hostTrackId?: string
): ResolvedTrack {
  const searchUrl = buildPlatformSearchUrl(targetPlatform, title, artist);

  if (targetPlatform === hostPlatform && hostTrackId && hostTrackId !== 'demo') {
    return {
      platform: targetPlatform,
      title,
      artist,
      trackId: hostTrackId,
      externalUrl: buildPlatformTrackUrl(targetPlatform, hostTrackId),
      searchUrl,
      matchType: 'exact',
    };
  }

  const mock = findMockMatch(title, artist);
  const mockEntry = mock?.[targetPlatform];
  if (mockEntry) {
    return {
      platform: targetPlatform,
      title: mock.title,
      artist: mock.artist,
      trackId: mockEntry.trackId,
      externalUrl: buildPlatformTrackUrl(targetPlatform, mockEntry.trackId),
      searchUrl,
      matchType: 'mock',
    };
  }

  return {
    platform: targetPlatform,
    title,
    artist,
    externalUrl: searchUrl,
    searchUrl,
    matchType: 'search',
  };
}
