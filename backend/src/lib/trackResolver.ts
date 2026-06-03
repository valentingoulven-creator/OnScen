import type { MusicPlatform } from '../models/schema';

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

/** Catalogue msdev : correspondances titre/artiste connues entre plateformes. */
const MOCK_CATALOG: Array<{
  title: string;
  artist: string;
  spotify?: { trackId: string };
  youtube?: { trackId: string };
}> = [
  {
    title: 'Midnight City',
    artist: 'M83',
    spotify: { trackId: '2P91MQbaiQKBR4c9sEgqsl' },
    youtube: { trackId: 'dX3kIQ6KlLi' },
  },
  {
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    spotify: { trackId: '4cOdK2wGLETKBW3PvgPWoT' },
    youtube: { trackId: 'dQw4w9WgXcQ' },
  },
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    spotify: { trackId: '0VjIjW4GlUZAMYd2vXMi3b' },
    youtube: { trackId: '4NRXx6W78buQNiQ3q5wEkP' },
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function findMockMatch(title: string, artist: string) {
  const nt = normalize(title);
  const na = normalize(artist);
  return MOCK_CATALOG.find((entry) => {
    const et = normalize(entry.title);
    const ea = normalize(entry.artist);
    return (nt.includes(et) || et.includes(nt)) && (na.includes(ea) || ea.includes(na) || !na);
  });
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
