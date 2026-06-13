import { User } from '../models/schema';
import { buildPlatformTrackUrl, parseSpotifyPlaylistId } from './musicLinks';
import { isPlatformConnected } from './platformConnect';
import {
  isFetchAbortError,
  isFetchNetworkError,
  isSpotifyRetryableAuthError,
  isSpotifyScopeMissingError,
  isSpotifyBareForbiddenError,
  isSpotifyDevUserNotAllowedError,
  isSpotifyPlaybackHostProduct,
  normalizeSpotifyProduct,
  parseSpotifyErrorMessage,
  spotifyNetworkErrorMessage,
  spotifyScopeMissingMessage,
} from './spotifyApi';
import { SpotifyPlaylistError, throwSpotifyPlaylistApiError } from './spotifyPlaylistErrors';
import {
  disconnectSpotifyOnAuthFailure,
  getValidSpotifyHostToken,
  getMissingSpotifyScopes,
  getMissingSpotifyPlaylistReadScopes,
  getStoredSpotifyOAuthScopes,
  invalidateStoredSpotifyOAuthScopes,
  isRealSpotifyAccount,
  refreshSpotifyAccessToken,
  type SpotifyHostTokenResult,
  type SpotifyRefreshResult,
} from './spotifyOAuth';

export { SpotifyPlaylistError } from './spotifyPlaylistErrors';

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

export type SpotifyHostSessionResult =
  | { ok: true; product: ReturnType<typeof normalizeSpotifyProduct> }
  | {
      ok: false;
      code: string;
      disconnected?: boolean;
      product?: ReturnType<typeof normalizeSpotifyProduct>;
    };

function throwFromRefreshFailure(result: Extract<SpotifyRefreshResult, { ok: false }>): never {
  if (result.reason === 'invalid_refresh') {
    throw new SpotifyPlaylistError(
      'Session Spotify expirée — reconnectez votre compte Spotify.',
      403,
      'spotify_token_expired'
    );
  }
  if (result.reason === 'not_connected' || result.reason === 'not_configured') {
    throw new SpotifyPlaylistError(
      'Compte Spotify non connecté ou session expirée — reconnectez Spotify.',
      403,
      'spotify_not_connected'
    );
  }
  throw new SpotifyPlaylistError(
    'Impossible de joindre Spotify pour renouveler la session — réessayez.',
    502,
    'spotify_network_error'
  );
}

function throwFromHostTokenFailure(result: Extract<SpotifyHostTokenResult, { ok: false }>): never {
  throwFromRefreshFailure({ ok: false, reason: result.reason });
}

async function ensureSpotifyAccessToken(user: User): Promise<string> {
  const result = await getValidSpotifyHostToken(user);
  if (result.ok) return result.accessToken;
  throwFromHostTokenFailure(result);
}

async function spotifyApiFetch(url: string, accessToken: string): Promise<Response> {
  try {
    return await fetch(url, {
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
}

async function prepareAccessTokenForPlaylistTracks(user: User): Promise<string> {
  const refreshed = await refreshSpotifyAccessToken(user);
  if (refreshed.ok) return refreshed.accessToken;
  return ensureSpotifyAccessToken(user);
}

function playlistReadScopesMissing(user: User): boolean {
  return getMissingSpotifyPlaylistReadScopes(getStoredSpotifyOAuthScopes(user)).length > 0;
}

async function spotifyFetch(
  user: User,
  url: string,
  accessToken: string
): Promise<{ res: Response; accessToken: string }> {
  let res = await spotifyApiFetch(url, accessToken);

  for (let attempt = 0; attempt < 2; attempt++) {
    const detail = res.status === 403 ? await parseSpotifyErrorMessage(res.clone()) : undefined;
    if (!isSpotifyRetryableAuthError(res.status, detail)) break;
    if (res.status === 403 && isSpotifyScopeMissingError(detail)) break;
    if (res.status === 403 && isSpotifyBareForbiddenError(detail) && playlistReadScopesMissing(user)) break;

    const refreshed = await refreshSpotifyAccessToken(user);
    if (!refreshed.ok) {
      if (refreshed.reason === 'invalid_refresh') {
        disconnectSpotifyOnAuthFailure(user, refreshed.reason);
      }
      throwFromRefreshFailure(refreshed);
    }
    accessToken = refreshed.accessToken;
    res = await spotifyApiFetch(url, accessToken);
  }

  return { res, accessToken };
}

function buildPlaylistTracksUrl(playlistId: string, limit: number): string {
  return `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&market=from_token&additional_types=track`;
}

/** Vérifie en live que le jeton peut lire les morceaux (pas seulement /me/playlists). */
async function probeSpotifyPlaylistTracksAccess(
  user: User,
  accessToken: string
): Promise<{ ok: true } | { ok: false; code: string }> {
  let listRes: Response;
  try {
    listRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn('[spotify-playlist] track probe: list network error', { userId: user.id, e });
    return { ok: false, code: 'spotify_network_error' };
  }

  if (!listRes.ok) {
    const detail = await parseSpotifyErrorMessage(listRes);
    console.warn('[spotify-playlist] track probe: list failed', { userId: user.id, status: listRes.status, detail });
    if (listRes.status === 403 && (isSpotifyScopeMissingError(detail) || isSpotifyBareForbiddenError(detail))) {
      invalidateStoredSpotifyOAuthScopes(user, 'probe:list_403');
      return { ok: false, code: 'spotify_scope_missing' };
    }
    if (isSpotifyRetryableAuthError(listRes.status, detail)) {
      return { ok: false, code: 'spotify_token_expired' };
    }
    return { ok: false, code: 'spotify_network_error' };
  }

  const listData = (await listRes.json()) as { items?: Array<{ id?: string }> };
  const probePlaylistId = listData.items?.[0]?.id?.trim();
  if (!probePlaylistId) return { ok: true };

  let tracksRes: Response;
  try {
    tracksRes = await fetch(buildPlaylistTracksUrl(probePlaylistId, 1), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn('[spotify-playlist] track probe: tracks network error', { userId: user.id, e });
    return { ok: false, code: 'spotify_network_error' };
  }

  if (tracksRes.ok) return { ok: true };

  const tracksDetail = await parseSpotifyErrorMessage(tracksRes);
  console.warn('[spotify-playlist] track probe: tracks failed', {
    userId: user.id,
    playlistId: probePlaylistId,
    status: tracksRes.status,
    detail: tracksDetail,
    storedScopes: getStoredSpotifyOAuthScopes(user),
  });

  if (
    tracksRes.status === 403 &&
    (isSpotifyScopeMissingError(tracksDetail) || isSpotifyBareForbiddenError(tracksDetail))
  ) {
    invalidateStoredSpotifyOAuthScopes(user, 'probe:tracks_403');
    return { ok: false, code: 'spotify_scope_missing' };
  }
  if (isSpotifyRetryableAuthError(tracksRes.status, tracksDetail)) {
    return { ok: false, code: 'spotify_token_expired' };
  }
  return { ok: false, code: 'spotify_network_error' };
}

async function finishHostSessionProbe(
  user: User,
  accessToken: string,
  product: ReturnType<typeof normalizeSpotifyProduct>
): Promise<SpotifyHostSessionResult> {
  if (!isSpotifyPlaybackHostProduct(product)) {
    return { ok: false, code: 'spotify_premium_required', product };
  }
  const trackProbe = await probeSpotifyPlaylistTracksAccess(user, accessToken);
  if (!trackProbe.ok) return { ok: false, code: trackProbe.code, product };
  return { ok: true, product };
}

export async function probeSpotifyHostSession(user: User): Promise<SpotifyHostSessionResult> {
  if (!isPlatformConnected(user, 'spotify')) {
    return { ok: false, code: 'spotify_not_connected' };
  }

  const storedScopes = getStoredSpotifyOAuthScopes(user);
  if (!storedScopes?.trim()) {
    console.warn('[spotify-playlist] stored OAuth scopes missing — reconnect required', { userId: user.id });
    return { ok: false, code: 'spotify_scope_missing' };
  }

  const missingScopes = getMissingSpotifyScopes(storedScopes);
  if (missingScopes.length > 0) {
    console.warn('[spotify-playlist] missing playback scopes', { userId: user.id, missingScopes });
    return { ok: false, code: 'spotify_scope_missing' };
  }

  const missingPlaylistScopes = getMissingSpotifyPlaylistReadScopes(storedScopes);
  if (missingPlaylistScopes.length > 0) {
    console.warn('[spotify-playlist] missing playlist read scopes', { userId: user.id, missingPlaylistScopes });
    return { ok: false, code: 'spotify_scope_missing' };
  }

  const tokenResult = await getValidSpotifyHostToken(user);
  if (!tokenResult.ok) {
    return {
      ok: false,
      code:
        tokenResult.reason === 'invalid_refresh'
          ? 'spotify_token_expired'
          : tokenResult.reason === 'not_connected' || tokenResult.reason === 'not_configured'
            ? 'spotify_not_connected'
            : 'spotify_network_error',
      disconnected: tokenResult.disconnected,
    };
  }

  try {
    const probe = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (probe.ok) {
      const profile = (await probe.json()) as { product?: string };
      return finishHostSessionProbe(user, tokenResult.accessToken, normalizeSpotifyProduct(profile.product));
    }

    const detail = await parseSpotifyErrorMessage(probe);
    if (probe.status === 403 && (isSpotifyScopeMissingError(detail) || isSpotifyBareForbiddenError(detail))) {
      return { ok: false, code: 'spotify_scope_missing' };
    }

    if (isSpotifyRetryableAuthError(probe.status, detail)) {
      const refreshed = await refreshSpotifyAccessToken(user);
      if (refreshed.ok) {
        try {
          const retryProbe = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${refreshed.accessToken}` },
            signal: AbortSignal.timeout(8000),
          });
          if (retryProbe.ok) {
            const profile = (await retryProbe.json()) as { product?: string };
            return finishHostSessionProbe(
              user,
              refreshed.accessToken,
              normalizeSpotifyProduct(profile.product)
            );
          }
          const retryDetail = await parseSpotifyErrorMessage(retryProbe);
          if (
            retryProbe.status === 403 &&
            (isSpotifyScopeMissingError(retryDetail) || isSpotifyBareForbiddenError(retryDetail))
          ) {
            return { ok: false, code: 'spotify_scope_missing' };
          }
          console.warn('[spotify-playlist] /me failed after refresh', {
            status: retryProbe.status,
            detail: retryDetail,
          });
          return { ok: false, code: 'spotify_token_expired' };
        } catch (e) {
          console.warn('[spotify-playlist] /me network error after refresh', e);
          return { ok: false, code: 'spotify_network_error' };
        }
      }
      if (refreshed.reason === 'invalid_refresh') {
        disconnectSpotifyOnAuthFailure(user, refreshed.reason);
        return { ok: false, code: 'spotify_token_expired', disconnected: true };
      }
      if (refreshed.reason === 'network' || refreshed.reason === 'not_configured') {
        return { ok: false, code: 'spotify_network_error' };
      }
      return { ok: false, code: 'spotify_not_connected' };
    }

    if (probe.status === 429) return { ok: false, code: 'spotify_rate_limited' };
    if (probe.status >= 500) return { ok: false, code: 'spotify_network_error' };
    if (probe.status === 403 && isSpotifyDevUserNotAllowedError(detail)) {
      return { ok: false, code: 'spotify_dev_user_not_allowed' };
    }

    console.warn('[spotify-playlist] /me failed', { status: probe.status, detail });
    return { ok: false, code: 'spotify_token_expired' };
  } catch (e) {
    console.warn('[spotify-playlist] /me network error', e);
    return { ok: false, code: 'spotify_network_error' };
  }
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
    const fetched = await spotifyFetch(user, nextUrl, accessToken);
    accessToken = fetched.accessToken;
    if (!fetched.res.ok) break;

    const data = (await fetched.res.json()) as {
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
  if (playlistReadScopesMissing(user)) {
    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }

  let accessToken = await prepareAccessTokenForPlaylistTracks(user);
  const tracks: SpotifyPlaylistTrack[] = [];
  let skippedItems = 0;
  let nextUrl: string | null = buildPlaylistTracksUrl(playlistId, 100);

  while (nextUrl && tracks.length < 200) {
    const fetched = await spotifyFetch(user, nextUrl, accessToken);
    accessToken = fetched.accessToken;
    if (!fetched.res.ok) {
      const detail = await parseSpotifyErrorMessage(fetched.res);
      throwSpotifyPlaylistApiError(fetched.res.status, detail, 'resolveSpotifyPlaylistTracks', user);
    }

    const data = (await fetched.res.json()) as {
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
    throw new SpotifyPlaylistError('Playlist Spotify introuvable ou vide.', 404, 'spotify_playlist_empty');
  }

  return tracks;
}

/** Pré-vol léger avant création de salon (évite un salon vide si la playlist est inaccessible). */
export async function verifySpotifyPlaylistTrackAccess(
  user: User,
  playlistIdOrUrl: string
): Promise<void> {
  const playlistId = parseSpotifyPlaylistId(playlistIdOrUrl) ?? playlistIdOrUrl.trim();
  if (!playlistId) {
    throw new SpotifyPlaylistError(
      'Lien ou identifiant playlist Spotify invalide.',
      400,
      'spotify_playlist_invalid'
    );
  }
  if (playlistReadScopesMissing(user)) {
    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }

  const accessToken = await prepareAccessTokenForPlaylistTracks(user);
  const fetched = await spotifyFetch(user, buildPlaylistTracksUrl(playlistId, 1), accessToken);
  if (!fetched.res.ok) {
    const detail = await parseSpotifyErrorMessage(fetched.res);
    throwSpotifyPlaylistApiError(fetched.res.status, detail, 'verifySpotifyPlaylistTrackAccess', user);
  }
}
