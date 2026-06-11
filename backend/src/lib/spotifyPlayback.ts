import { User } from '../models/schema';
import {
  getValidSpotifyHostToken,
  refreshSpotifyAccessToken,
  type SpotifyRefreshResult,
} from './spotifyOAuth';
import { isSpotifyRetryableAuthError, parseSpotifyErrorMessage } from './spotifyApi';

export type SpotifyPlaybackAction = 'pause' | 'play' | 'stop' | 'seek' | 'next';

export class SpotifyPlaybackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'SpotifyPlaybackError';
  }
}

async function ensureSpotifyAccessToken(user: User): Promise<string> {
  const result = await getValidSpotifyHostToken(user);
  if (result.ok) return result.accessToken;
  throw new SpotifyPlaybackError(
    result.reason === 'invalid_refresh'
      ? 'Session Spotify expirée — reconnectez Spotify.'
      : 'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
    403,
    result.reason === 'invalid_refresh' ? 'spotify_token_expired' : 'spotify_not_connected'
  );
}

function throwFromRefreshFailure(result: Extract<SpotifyRefreshResult, { ok: false }>): never {
  if (result.reason === 'invalid_refresh') {
    throw new SpotifyPlaybackError(
      'Session Spotify expirée — reconnectez Spotify.',
      403,
      'spotify_token_expired'
    );
  }
  throw new SpotifyPlaybackError(
    'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
    403,
    'spotify_not_connected'
  );
}

async function spotifyPlayerRequest(
  user: User,
  method: 'GET' | 'PUT' | 'POST',
  url: string,
  body?: object
): Promise<Response> {
  let accessToken = await ensureSpotifyAccessToken(user);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(10000),
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res = await fetch(url, init);
  if (isSpotifyRetryableAuthError(res.status)) {
    const detail = res.status === 403 ? await parseSpotifyErrorMessage(res.clone()) : undefined;
    if (!(res.status === 403 && detail?.toLowerCase().includes('insufficient'))) {
      const refreshed = await refreshSpotifyAccessToken(user);
      if (refreshed.ok) {
        accessToken = refreshed.accessToken;
        headers.Authorization = `Bearer ${accessToken}`;
        res = await fetch(url, init);
      } else {
        throwFromRefreshFailure(refreshed);
      }
    }
  }
  return res;
}

function mapSpotifyPlayerError(res: Response, fallback: string): SpotifyPlaybackError {
  if (res.status === 404) {
    return new SpotifyPlaybackError(
      'Aucun appareil Spotify actif — ouvrez l’app Spotify et relancez la lecture.',
      404,
      'no_active_device'
    );
  }
  if (res.status === 403) {
    return new SpotifyPlaybackError(
      'Reconnectez Spotify pour autoriser le contrôle de lecture (play/pause).',
      403,
      'spotify_scope_missing'
    );
  }
  if (res.status === 429) {
    return new SpotifyPlaybackError('Spotify temporairement indisponible — réessayez.', 429, 'spotify_rate_limited');
  }
  return new SpotifyPlaybackError(fallback, res.status || 502, 'spotify_playback_failed');
}

async function pauseSpotifyPlayback(user: User): Promise<void> {
  const res = await spotifyPlayerRequest(user, 'PUT', 'https://api.spotify.com/v1/me/player/pause');
  if (res.status === 204 || res.status === 200) return;
  throw mapSpotifyPlayerError(res, 'Impossible de mettre Spotify en pause.');
}

async function playSpotifyPlayback(user: User): Promise<void> {
  const res = await spotifyPlayerRequest(user, 'PUT', 'https://api.spotify.com/v1/me/player/play', {});
  if (res.status === 204 || res.status === 200) return;
  throw mapSpotifyPlayerError(res, 'Impossible de reprendre la lecture Spotify.');
}

async function playSpotifyTrack(user: User, trackId: string): Promise<void> {
  const safeId = trackId.trim();
  if (!safeId) {
    throw new SpotifyPlaybackError('trackId Spotify requis.', 400, 'invalid_track_id');
  }
  const res = await spotifyPlayerRequest(user, 'PUT', 'https://api.spotify.com/v1/me/player/play', {
    uris: [`spotify:track:${safeId}`],
  });
  if (res.status === 204 || res.status === 200) return;
  throw mapSpotifyPlayerError(res, 'Impossible de lancer ce morceau sur Spotify.');
}

async function skipToNextSpotifyTrack(user: User): Promise<void> {
  const res = await spotifyPlayerRequest(user, 'POST', 'https://api.spotify.com/v1/me/player/next');
  if (res.status === 204 || res.status === 200) return;
  throw mapSpotifyPlayerError(res, 'Impossible de passer au morceau suivant sur Spotify.');
}

async function seekSpotifyPlayback(user: User, positionMs: number): Promise<void> {
  const safeMs = Math.max(0, Math.floor(positionMs));
  const res = await spotifyPlayerRequest(
    user,
    'PUT',
    `https://api.spotify.com/v1/me/player/seek?position_ms=${safeMs}`
  );
  if (res.status === 204 || res.status === 200) return;
  throw mapSpotifyPlayerError(res, 'Impossible de repositionner Spotify.');
}

export interface SpotifyNowPlaying {
  active: boolean;
  isPlaying: boolean;
  progressMs: number;
  trackId?: string;
  title?: string;
  artist?: string;
  albumArtUrl?: string;
  externalUrl?: string;
}

type SpotifyPlayerItem = {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
};

type SpotifyPlayerResponse = {
  is_playing?: boolean;
  progress_ms?: number;
  item?: SpotifyPlayerItem | null;
};

function mapSpotifyPlayerPayload(data: SpotifyPlayerResponse): SpotifyNowPlaying | null {
  const item = data.item;
  if (!item?.id) return null;
  const artists = (item.artists ?? [])
    .map((a) => a.name?.trim())
    .filter((n): n is string => Boolean(n));
  return {
    active: true,
    isPlaying: Boolean(data.is_playing),
    progressMs: Math.max(0, Math.floor(data.progress_ms ?? 0)),
    trackId: item.id,
    title: item.name?.trim() || 'Morceau Spotify',
    artist: artists.join(', ') || 'Spotify',
    albumArtUrl: item.album?.images?.[0]?.url,
    externalUrl: item.external_urls?.spotify,
  };
}

/** Lecture en cours sur l'appareil Spotify actif de l'hôte (GET /v1/me/player). */
export async function getSpotifyNowPlaying(user: User): Promise<SpotifyNowPlaying> {
  const res = await spotifyPlayerRequest(user, 'GET', 'https://api.spotify.com/v1/me/player');
  if (res.status === 204) {
    return { active: false, isPlaying: false, progressMs: 0 };
  }
  if (!res.ok) {
    throw mapSpotifyPlayerError(res, 'Impossible de lire l’état Spotify.');
  }
  const data = (await res.json()) as SpotifyPlayerResponse;
  const mapped = mapSpotifyPlayerPayload(data);
  if (!mapped) {
    return { active: false, isPlaying: false, progressMs: 0 };
  }
  return mapped;
}

/** Repositionne la lecture Spotify (PUT /v1/me/player/seek). */
export async function seekSpotifyPlaybackPosition(user: User, positionMs: number): Promise<void> {
  await seekSpotifyPlayback(user, positionMs);
}

/** Remplace la lecture en cours par un morceau (PUT /v1/me/player/play, position 0). */
export async function playSpotifyTrackNow(user: User, trackId: string): Promise<void> {
  await playSpotifyTrack(user, trackId);
}

/** Contrôle la lecture Spotify de l'hôte (Connect / app ouverte). */
export async function controlSpotifyPlayback(
  user: User,
  action: SpotifyPlaybackAction,
  positionMs?: number
): Promise<void> {
  switch (action) {
    case 'pause':
      await pauseSpotifyPlayback(user);
      return;
    case 'play':
      await playSpotifyPlayback(user);
      return;
    case 'stop':
      await pauseSpotifyPlayback(user);
      try {
        await seekSpotifyPlayback(user, 0);
      } catch (e) {
        if (e instanceof SpotifyPlaybackError && e.code === 'no_active_device') {
          return;
        }
        throw e;
      }
      return;
    case 'seek': {
      if (positionMs === undefined || !Number.isFinite(positionMs)) {
        throw new SpotifyPlaybackError('position_ms requis pour seek.', 400, 'invalid_position');
      }
      await seekSpotifyPlayback(user, positionMs);
      return;
    }
    case 'next':
      await skipToNextSpotifyTrack(user);
      return;
    default:
      throw new SpotifyPlaybackError('Action Spotify invalide.', 400, 'invalid_action');
  }
}
