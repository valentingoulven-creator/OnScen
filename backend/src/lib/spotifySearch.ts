import { User } from '../models/schema';
import { parseMusicLink, buildPlatformTrackUrl } from './musicLinks';
import {
  getSpotifyAccessToken,
  getSpotifyAppAccessToken,
  isSpotifyApiConfigured,
  isSpotifyOAuthConfigured,
  refreshSpotifyToken,
} from './spotifyOAuth';

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

/** Spotify GET /v1/search — limit 1–10 (doc officielle, pas 50). */
export const SPOTIFY_SEARCH_DEFAULT_LIMIT = 10;
const SPOTIFY_SEARCH_MIN_LIMIT = 1;
const SPOTIFY_SEARCH_MAX_LIMIT = 10;

/** Normalise limit (0, undefined, string, float, >10) → entier 1–10. */
export function normalizeSpotifySearchLimit(raw?: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return SPOTIFY_SEARCH_DEFAULT_LIMIT;
  }
  const parsed =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed < SPOTIFY_SEARCH_MIN_LIMIT) {
    return SPOTIFY_SEARCH_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(parsed), SPOTIFY_SEARCH_MAX_LIMIT);
}

function defaultSpotifySearchMarket(): string {
  const fromEnv = process.env.SPOTIFY_DEFAULT_MARKET?.trim().toUpperCase();
  if (fromEnv && /^[A-Z]{2}$/.test(fromEnv)) return fromEnv;
  return 'FR';
}

async function ensureHostSpotifyAccessToken(user: User): Promise<string | null> {
  let token = getSpotifyAccessToken(user);
  if (token) return token;
  if (!isSpotifyOAuthConfigured()) return null;
  return (await refreshSpotifyToken(user)) ?? null;
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

async function readSpotifyErrorBody(res: Response): Promise<string | undefined> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message?.trim();
  } catch {
    return undefined;
  }
}

function classifySpotifySearchFailure(
  status: number,
  spotifyMessage?: string
): SpotifySearchError {
  if (status === 401 || status === 403) {
    const devUserHint = spotifyMessage?.toLowerCase().includes('user may not be registered');
    if (devUserHint) {
      return new SpotifySearchError(
        'Compte Spotify non autorisé sur cette app (mode développement Spotify : ajoutez l’utilisateur dans le dashboard).',
        403,
        'spotify_dev_user_not_allowed'
      );
    }
    return new SpotifySearchError(
      'Session Spotify expirée — reconnectez votre compte Spotify.',
      403,
      'spotify_token_expired'
    );
  }
  if (status === 429) {
    return new SpotifySearchError(
      'Quota Spotify atteint (mode développement : 5 utilisateurs max). Réessayez plus tard.',
      429,
      'spotify_rate_limited'
    );
  }
  if (status === 400) {
    return new SpotifySearchError(
      spotifyMessage
        ? `Requête Spotify invalide : ${spotifyMessage}`
        : 'Requête de recherche Spotify invalide.',
      400,
      'spotify_bad_request'
    );
  }
  return new SpotifySearchError(
    spotifyMessage
      ? `Recherche Spotify indisponible (${status}) : ${spotifyMessage}`
      : `Recherche Spotify indisponible (erreur Spotify ${status}).`,
    502,
    'spotify_search_failed'
  );
}

async function fetchSpotifySearch(
  accessToken: string,
  query: string,
  opts?: { limit?: number; market?: string }
): Promise<{ ok: boolean; status: number; items: SpotifySearchResult[]; spotifyMessage?: string }> {
  const limit = normalizeSpotifySearchLimit(opts?.limit);
  const params = new URLSearchParams({
    q: query,
    type: 'track',
    limit: String(limit),
  });
  if (opts?.market) params.set('market', opts.market);
  let res: Response;
  try {
    res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    const isTimeout =
      e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new SpotifySearchError(
      isTimeout
        ? 'Recherche Spotify trop lente — réessayez.'
        : 'Impossible de joindre l’API Spotify — réessayez.',
      502,
      'spotify_network_error'
    );
  }

  if (!res.ok) {
    const spotifyMessage = await readSpotifyErrorBody(res);
    return { ok: false, status: res.status, items: [], spotifyMessage };
  }

  const data = (await res.json()) as {
    tracks?: { items?: Array<Parameters<typeof mapTrackItem>[0]> };
  };
  const items = (data.tracks?.items ?? [])
    .map(mapTrackItem)
    .filter((r): r is SpotifySearchResult => Boolean(r));
  return { ok: true, status: res.status, items };
}

export async function searchSpotifyTracks(
  user: User,
  query: string,
  opts?: { limit?: unknown }
): Promise<SpotifySearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const searchLimit = normalizeSpotifySearchLimit(opts?.limit);

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

  if (!isSpotifyApiConfigured()) {
    throw new SpotifySearchError(
      'Recherche Spotify non configurée côté serveur (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).',
      503,
      'spotify_oauth_not_configured'
    );
  }

  const hostToken = await ensureHostSpotifyAccessToken(user);
  if (hostToken) {
    let result = await fetchSpotifySearch(hostToken, q, { limit: searchLimit });

    if (!result.ok && result.status === 401) {
      const refreshed = await refreshSpotifyToken(user);
      if (refreshed) {
        result = await fetchSpotifySearch(refreshed, q, { limit: searchLimit });
      }
    }

    if (result.ok) return result.items;
    if (result.status === 429) {
      throw classifySpotifySearchFailure(result.status, result.spotifyMessage);
    }
  }

  // Repli client_credentials : recherche publique (hôte OAuth déjà vérifié en amont).
  const appToken = await getSpotifyAppAccessToken();
  if (!appToken) {
    if (!hostToken) {
      throw new SpotifySearchError(
        'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
        403,
        'spotify_not_connected'
      );
    }
    throw new SpotifySearchError(
      'Recherche Spotify indisponible — vérifiez SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET sur le serveur.',
      503,
      'spotify_oauth_not_configured'
    );
  }

  const fallback = await fetchSpotifySearch(appToken, q, {
    limit: searchLimit,
    market: defaultSpotifySearchMarket(),
  });
  if (!fallback.ok) {
    throw classifySpotifySearchFailure(fallback.status, fallback.spotifyMessage);
  }
  return fallback.items;
}
