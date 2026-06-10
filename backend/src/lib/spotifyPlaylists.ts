import { User } from '../models/schema';
import { buildPlatformTrackUrl, parseSpotifyPlaylistId } from './musicLinks';
import { isPlatformConnected } from './platformConnect';
import {
  isFetchAbortError,
  isFetchNetworkError,
  parseSpotifyErrorMessage,
  spotifyAuthErrorMessage,
  spotifyNetworkErrorMessage,
} from './spotifyApi';
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

export class SpotifyPlaylistError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'SpotifyPlaylistError';
  }
}

async function ensureSpotifyAccessToken(user: User): Promise<string> {
  let token = getSpotifyAccessToken(user);
  if (token) return token;
  token = (await refreshSpotifyToken(user)) ?? undefined;
  if (!token) {
    throw new SpotifyPlaylistError(
      'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
      403,
      'spotify_not_connected'
    );
  }
  return token;
}

async function spotifyFetch(user: User, url: string, accessToken: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    if (isFetchAbortError(e)) {
      throw new SpotifyPlaylistError(
        'Chargement Spotify trop lent — réessayez.',
        504,
        'spotify_playlist_timeout'
      );
    }
    if (isFetchNetworkError(e)) {
      throw new SpotifyPlaylistError(
        spotifyNetworkErrorMessage('playlist'),
        502,
        'spotify_network_error'
      );
    }
    throw e;
  }

  if (res.status === 401) {
    const refreshed = await refreshSpotifyToken(user);
    if (refreshed) {
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${refreshed}` },
          signal: AbortSignal.timeout(12000),
        });
      } catch (e) {
        if (isFetchAbortError(e)) {
          throw new SpotifyPlaylistError(
            'Chargement Spotify trop lent — réessayez.',
            504,
            'spotify_playlist_timeout'
          );
        }
        if (isFetchNetworkError(e)) {
          throw new SpotifyPlaylistError(
            spotifyNetworkErrorMessage('playlist'),
            502,
            'spotify_network_error'
          );
        }
        throw e;
      }
    }
  }
  return res;
}

function throwPlaylistApiError(status: number, detail?: string): never {
  if (status === 401 || status === 403) {
    throw new SpotifyPlaylistError(
      spotifyAuthErrorMessage(status, detail),
      403,
      'spotify_token_expired'
    );
  }
  if (status === 404) {
    throw new SpotifyPlaylistError(
      'Playlist Spotify introuvable — vérifiez le lien ou choisissez une autre playlist.',
      404,
      'spotify_playlist_not_found'
    );
  }
  if (status === 429) {
    throw new SpotifyPlaylistError(
      'Quota Spotify atteint — réessayez plus tard.',
      429,
      'spotify_rate_limited'
    );
  }
  throw new SpotifyPlaylistError(
    detail
      ? `Impossible de charger la playlist — ${detail}`
      : 'Impossible de charger la playlist Spotify — réessayez.',
    502,
    'spotify_playlist_failed'
  );
}

export async function listHostSpotifyPlaylists(user: User): Promise<SpotifyPlaylistSummary[]> {
  if (!isPlatformConnected(user, 'spotify')) return [];
  let accessToken: string;
  try {
    accessToken = await ensureSpotifyAccessToken(user);
  } catch {
    return [];
  }

  const playlists: SpotifyPlaylistSummary[] = [];
  let nextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';

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

type PlaylistItemPayload = {
  track?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: { images?: Array<{ url?: string }> };
    external_urls?: { spotify?: string };
  } | null;
  item?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: { images?: Array<{ url?: string }> };
    external_urls?: { spotify?: string };
  } | null;
};

function mapPlaylistTrack(item: PlaylistItemPayload): SpotifyPlaylistTrack | null {
  const track = item.track ?? item.item;
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
  const playlistId = parseSpotifyPlaylistId(playlistIdOrUrl) ?? playlistIdOrUrl.trim();
  if (!playlistId) {
    throw new SpotifyPlaylistError(
      'Lien ou identifiant playlist Spotify invalide.',
      400,
      'spotify_playlist_invalid'
    );
  }

  const accessToken = await ensureSpotifyAccessToken(user);

  const tracks: SpotifyPlaylistTrack[] = [];
  let skippedItems = 0;
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=from_token&additional_types=track`;

  while (nextUrl && tracks.length < 200) {
    const res = await spotifyFetch(user, nextUrl, accessToken);
    if (!res.ok) {
      const detail = await parseSpotifyErrorMessage(res);
      throwPlaylistApiError(res.status, detail);
    }
    const data = (await res.json()) as {
      items?: PlaylistItemPayload[];
      next?: string | null;
    };
    for (const item of data.items ?? []) {
      const mapped = mapPlaylistTrack(item);
      if (mapped) tracks.push(mapped);
      else skippedItems += 1;
    }
    nextUrl = data.next ?? null;
  }

  if (!tracks.length) {
    if (skippedItems > 0) {
      throw new SpotifyPlaylistError(
        'Playlist sans morceaux lisibles (titres locaux ou indisponibles dans votre région).',
        400,
        'spotify_playlist_no_playable_tracks'
      );
    }
    throw new SpotifyPlaylistError(
      'Playlist Spotify introuvable ou vide.',
      404,
      'spotify_playlist_empty'
    );
  }

  return tracks;
}
