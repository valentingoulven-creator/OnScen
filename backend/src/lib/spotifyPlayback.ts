import { User } from '../models/schema';
import { getSpotifyAccessToken, refreshSpotifyToken } from './spotifyOAuth';

export type SpotifyPlaybackAction = 'pause' | 'play' | 'stop';

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
  let token = getSpotifyAccessToken(user);
  if (token) return token;
  token = (await refreshSpotifyToken(user)) ?? undefined;
  if (!token) {
    throw new SpotifyPlaybackError(
      'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
      403,
      'spotify_not_connected'
    );
  }
  return token;
}

async function spotifyPlayerRequest(
  user: User,
  method: 'PUT',
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
  if (res.status === 401) {
    const refreshed = await refreshSpotifyToken(user);
    if (refreshed) {
      accessToken = refreshed;
      headers.Authorization = `Bearer ${accessToken}`;
      res = await fetch(url, init);
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

/** Contrôle la lecture Spotify de l'hôte (Connect / app ouverte). */
export async function controlSpotifyPlayback(user: User, action: SpotifyPlaybackAction): Promise<void> {
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
    default:
      throw new SpotifyPlaybackError('Action Spotify invalide.', 400, 'invalid_action');
  }
}
