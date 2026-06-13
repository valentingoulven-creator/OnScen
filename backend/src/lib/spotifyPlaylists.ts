import { User } from '../models/schema';

import { buildPlatformTrackUrl, parseSpotifyPlaylistId } from './musicLinks';

import { isPlatformConnected } from './platformConnect';

import {

  isFetchAbortError,

  isFetchNetworkError,

  isSpotifyRetryableAuthError,

  isSpotifyScopeMissingError,

  isSpotifyDevUserNotAllowedError,

  isSpotifyPremiumRequiredError,

  isSpotifyPlaybackHostProduct,

  isSpotifyTokenExpiredError,

  normalizeSpotifyProduct,

  parseSpotifyErrorMessage,

  spotifyAuthErrorMessage,

  spotifyDevUserNotAllowedMessage,

  spotifyNetworkErrorMessage,

  spotifyPremiumRequiredMessage,

  spotifyScopeMissingMessage,

} from './spotifyApi';

import {

  disconnectSpotifyOnAuthFailure,

  getValidSpotifyHostToken,

  getMissingSpotifyScopes,

  getMissingSpotifyPlaylistReadScopes,

  getStoredSpotifyOAuthScopes,

  isRealSpotifyAccount,

  refreshSpotifyAccessToken,

  type SpotifyHostTokenResult,

  type SpotifyRefreshResult,

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



/** Renouvelle le jeton avant load tracks — /me/playlists peut réussir alors que /tracks renvoie 401/403. */

async function prepareAccessTokenForPlaylistTracks(user: User): Promise<string> {

  const refreshed = await refreshSpotifyAccessToken(user);

  if (refreshed.ok) return refreshed.accessToken;

  return ensureSpotifyAccessToken(user);

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



function throwPlaylistApiError(status: number, detail?: string, context?: string): never {

  if (status === 403 && isSpotifyScopeMissingError(detail)) {

    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');

  }

  if (status === 403 && isSpotifyPremiumRequiredError(detail)) {

    throw new SpotifyPlaylistError(spotifyPremiumRequiredMessage(), 403, 'spotify_premium_required');

  }

  if (status === 403 && isSpotifyDevUserNotAllowedError(detail)) {

    throw new SpotifyPlaylistError(spotifyDevUserNotAllowedMessage(), 403, 'spotify_dev_user_not_allowed');

  }

  console.warn('[spotify-playlist] API error', { status, detail, context });

  if (status === 401 || (status === 403 && isSpotifyTokenExpiredError(detail))) {

    throw new SpotifyPlaylistError(

      spotifyAuthErrorMessage(status, detail),

      403,

      'spotify_token_expired'

    );

  }

  if (status === 403) {

    throw new SpotifyPlaylistError(

      detail

        ? `Impossible de charger la playlist — ${detail}`

        : 'Accès à la playlist Spotify refusé — vérifiez le lien ou reconnectez Spotify.',

      403,

      'spotify_playlist_forbidden'

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



export async function probeSpotifyHostSession(

  user: User

): Promise<
  | { ok: true; product: ReturnType<typeof normalizeSpotifyProduct> }
  | { ok: false; code: string; disconnected?: boolean; product?: ReturnType<typeof normalizeSpotifyProduct> }
> {

  if (!isPlatformConnected(user, 'spotify')) {

    return { ok: false, code: 'spotify_not_connected' };

  }

  const storedScopes = getStoredSpotifyOAuthScopes(user);

  const missingScopes = getMissingSpotifyScopes(storedScopes);

  if (storedScopes && missingScopes.length > 0) {

    console.warn('[spotify-playlist] stored OAuth scopes missing playback scopes', {

      userId: user.id,

      missingScopes,

    });

    return { ok: false, code: 'spotify_scope_missing' };

  }

  const missingPlaylistScopes = getMissingSpotifyPlaylistReadScopes(storedScopes);

  if (storedScopes && missingPlaylistScopes.length > 0) {

    console.warn('[spotify-playlist] stored OAuth scopes missing playlist read scopes', {

      userId: user.id,

      missingPlaylistScopes,

    });

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
      const product = normalizeSpotifyProduct(profile.product);
      if (!isSpotifyPlaybackHostProduct(product)) {
        return { ok: false, code: 'spotify_premium_required', product };
      }
      return { ok: true, product };
    }

    const detail = await parseSpotifyErrorMessage(probe);

    if (probe.status === 403 && isSpotifyScopeMissingError(detail)) {

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

            const product = normalizeSpotifyProduct(profile.product);

            if (!isSpotifyPlaybackHostProduct(product)) {

              return { ok: false, code: 'spotify_premium_required', product };

            }

            return { ok: true, product };

          }

          const retryDetail = await parseSpotifyErrorMessage(retryProbe);

          if (retryProbe.status === 403 && isSpotifyScopeMissingError(retryDetail)) {

            return { ok: false, code: 'spotify_scope_missing' };

          }

          console.warn('[spotify-playlist] pre-flight /me failed after refresh', {

            status: retryProbe.status,

            detail: retryDetail,

          });

          return { ok: false, code: 'spotify_token_expired' };

        } catch (e) {

          console.warn('[spotify-playlist] pre-flight /me network error after refresh', e);

          return { ok: false, code: 'spotify_network_error' };

        }

      } else if (refreshed.reason === 'invalid_refresh') {

        disconnectSpotifyOnAuthFailure(user, refreshed.reason);

        return { ok: false, code: 'spotify_token_expired', disconnected: true };

      } else if (refreshed.reason === 'network' || refreshed.reason === 'not_configured') {

        return { ok: false, code: 'spotify_network_error' };

      } else {

        return { ok: false, code: 'spotify_not_connected' };

      }

    }

    if (probe.status === 429) {

      return { ok: false, code: 'spotify_rate_limited' };

    }

    if (probe.status >= 500) {

      return { ok: false, code: 'spotify_network_error' };

    }

    if (probe.status === 403 && isSpotifyDevUserNotAllowedError(detail)) {

      return { ok: false, code: 'spotify_dev_user_not_allowed' };

    }

    console.warn('[spotify-playlist] pre-flight /me failed', { status: probe.status, detail });

    return { ok: false, code: 'spotify_token_expired' };

  } catch (e) {

    console.warn('[spotify-playlist] pre-flight /me network error', e);

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

    const res = fetched.res;

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



  let accessToken = await prepareAccessTokenForPlaylistTracks(user);



  const tracks: SpotifyPlaylistTrack[] = [];

  let skippedItems = 0;

  let nextUrl: string | null =

    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=from_token&additional_types=track`;



  while (nextUrl && tracks.length < 200) {

    const fetched = await spotifyFetch(user, nextUrl, accessToken);

    accessToken = fetched.accessToken;

    const res = fetched.res;

    if (!res.ok) {

      const detail = await parseSpotifyErrorMessage(res);

      throwPlaylistApiError(res.status, detail, 'resolveSpotifyPlaylistTracks');

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


