import { User } from '../models/schema';
import { buildPlatformTrackUrl, parseSpotifyPlaylistId } from './musicLinks';
import { isPlatformConnected } from './platformConnect';
import {
  getSpotifyAccessToken,
  isRealSpotifyAccount,
  refreshSpotifyToken,
} from './spotifyOAuth';

export interface SpotifyPlaylistSummary {
  playlistId: string;
  title: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

export interface SpotifyPlaylistTrack {
  trackId: string;
  title: string;
  artist: string;
  externalUrl: string;
  albumArtUrl?: string;
}

async function ensureSpotifyAccessToken(user: User): Promise<string | null> {
  let token = getSpotifyAccessToken(user);
  if (token) return token;
  return (await refreshSpotifyToken(user)) ?? null;
}

async function spotifyFetch(
  user: User,
  url: string,
  accessToken: string
): Promise<Response> {
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 401) {
    const refreshed = await refreshSpotifyToken(user);
    if (refreshed) {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${refreshed}` },
        signal: AbortSignal.timeout(10000),
      });
    }
  }
  return res;
}

export async function listHostSpotifyPlaylists(user: User): Promise<SpotifyPlaylistSummary[]> {
  if (!isPlatformConnected(user, 'spotify')) return [];
  const accessToken = await ensureSpotifyAccessToken(user);
  if (!accessToken) return [];

  const playlists: SpotifyPlaylistSummary[] = [];
  let nextUrl: string | null =
    'https://api.spotify.com/v1/me/playlists?limit=50';

  while (nextUrl && playlists.length < 100) {
    const res = await spotifyFetch(user, nextUrl, accessToken);
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        name?: string;
        tracks?: { total?: number };
        images?: Array<{ url?: string }>;
      }>;
      next?: string | null;
    };
    for (const item of data.items ?? []) {
      const playlistId = item.id?.trim();
      if (!playlistId) continue;
      playlists.push({
        playlistId,
        title: (item.name ?? 'Playlist Spotify').slice(0, 120),
        itemCount: item.tracks?.total,
        thumbnailUrl: item.images?.[0]?.url,
      });
    }
    nextUrl = data.next ?? null;
  }

  return playlists;
}

export { isRealSpotifyAccount };

function mapPlaylistTrack(item: {
  track?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: { images?: Array<{ url?: string }> };
    external_urls?: { spotify?: string };
  } | null;
}): SpotifyPlaylistTrack | null {
  const track = item.track;
  const trackId = track?.id?.trim();
  if (!track || !trackId) return null;
  const artist =
    track.artists
      ?.map((a) => a.name?.trim())
      .filter((n): n is string => Boolean(n))
      .join(', ') || 'Spotify';
  return {
    trackId,
    title: (track.name ?? 'Morceau Spotify').slice(0, 120),
    artist: artist.slice(0, 80),
    externalUrl: track.external_urls?.spotify ?? buildPlatformTrackUrl('spotify', trackId),
    albumArtUrl: track.album?.images?.[0]?.url,
  };
}

export async function resolveSpotifyPlaylistTracks(
  user: User,
  playlistIdOrUrl: string
): Promise<SpotifyPlaylistTrack[]> {
  const playlistId =
    parseSpotifyPlaylistId(playlistIdOrUrl) ?? playlistIdOrUrl.trim();
  if (!playlistId) return [];

  const accessToken = await ensureSpotifyAccessToken(user);
  if (!accessToken) return [];

  const tracks: SpotifyPlaylistTrack[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;

  while (nextUrl && tracks.length < 200) {
    const res = await spotifyFetch(user, nextUrl, accessToken);
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<Parameters<typeof mapPlaylistTrack>[0]>;
      next?: string | null;
    };
    for (const item of data.items ?? []) {
      const mapped = mapPlaylistTrack(item);
      if (mapped) tracks.push(mapped);
    }
    nextUrl = data.next ?? null;
  }

  return tracks;
}
