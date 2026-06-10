import { User } from '../models/schema';
import { parseMusicLink, buildPlatformTrackUrl } from './musicLinks';
import { getSpotifyAccessToken, refreshSpotifyToken } from './spotifyOAuth';

export interface SpotifySearchResult {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumArtUrl: string;
  externalUrl: string;
}

export class SpotifySearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'SpotifySearchError';
  }
}

async function ensureSpotifyAccessToken(user: User): Promise<string> {
  let token = getSpotifyAccessToken(user);
  if (token) return token;
  token = (await refreshSpotifyToken(user)) ?? undefined;
  if (!token) {
    throw new SpotifySearchError(
      'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
      403,
      'spotify_not_connected'
    );
  }
  return token;
}

function mapTrackItem(item: {
  id?: string;
  uri?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
}): SpotifySearchResult | null {
  const id = item.id?.trim();
  if (!id) return null;
  const artist =
    item.artists
      ?.map((a) => a.name?.trim())
      .filter((n): n is string => Boolean(n))
      .join(', ') || 'Spotify';
  return {
    id,
    uri: item.uri ?? `spotify:track:${id}`,
    name: (item.name ?? 'Morceau Spotify').slice(0, 120),
    artist: artist.slice(0, 80),
    albumArtUrl: item.album?.images?.[0]?.url ?? '',
    externalUrl: item.external_urls?.spotify ?? buildPlatformTrackUrl('spotify', id),
  };
}

async function fetchSpotifySearch(
  accessToken: string,
  query: string
): Promise<{ ok: boolean; status: number; items: SpotifySearchResult[] }> {
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: '15',
  });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, items: [] };
  }

  const data = (await res.json()) as {
    tracks?: { items?: Array<Parameters<typeof mapTrackItem>[0]> };
  };
  const items = (data.tracks?.items ?? [])
    .map(mapTrackItem)
    .filter((r): r is SpotifySearchResult => Boolean(r));
  return { ok: true, status: res.status, items };
}

export async function searchSpotifyTracks(user: User, query: string): Promise<SpotifySearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const parsed = parseMusicLink('spotify', q);
  if (parsed) {
    return [
      {
        id: parsed.trackId,
        uri: `spotify:track:${parsed.trackId}`,
        name: parsed.title ?? 'Morceau Spotify',
        artist: 'Spotify',
        albumArtUrl: '',
        externalUrl: buildPlatformTrackUrl('spotify', parsed.trackId),
      },
    ];
  }

  let accessToken = await ensureSpotifyAccessToken(user);
  let result = await fetchSpotifySearch(accessToken, q);

  if (!result.ok && result.status === 401) {
    const refreshed = await refreshSpotifyToken(user);
    if (refreshed) {
      accessToken = refreshed;
      result = await fetchSpotifySearch(accessToken, q);
    }
  }

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      throw new SpotifySearchError(
        'Session Spotify expirée — reconnectez votre compte Spotify.',
        403,
        'spotify_token_expired'
      );
    }
    if (result.status === 429) {
      throw new SpotifySearchError(
        'Quota Spotify atteint (mode développement : 5 utilisateurs max). Réessayez plus tard.',
        429,
        'spotify_rate_limited'
      );
    }
    throw new SpotifySearchError('Recherche Spotify indisponible', 502, 'spotify_search_failed');
  }

  return result.items;
}
