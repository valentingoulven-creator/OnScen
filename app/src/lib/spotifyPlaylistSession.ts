import type { TFunction } from 'i18next';
import { ApiRequestError, api } from './api';

/** Codes session Spotify renvoyés par GET /platforms/status et /spotify/playlists. */
export type SpotifySessionCode =
  | 'spotify_token_expired'
  | 'spotify_scope_missing'
  | 'spotify_not_connected'
  | 'spotify_premium_required'
  | 'spotify_dev_user_not_allowed'
  | 'spotify_playlist_forbidden'
  | 'spotify_network_error';

/** Codes API déclenchant le bouton « Reconnecter Spotify » dans les pickers playlist. */
export const SPOTIFY_PLAYLIST_RECONNECT_CODES = new Set<string>([
  'spotify_token_expired',
  'spotify_scope_missing',
  'spotify_not_connected',
  'spotify_playlist_forbidden',
]);

export type SpotifyPlaylistRef = { playlistId?: string; playlistUrl?: string };

export function spotifySessionCodeNeedsReconnect(code?: string): boolean {
  return Boolean(code && SPOTIFY_PLAYLIST_RECONNECT_CODES.has(code));
}

export function spotifyApiErrorNeedsReconnect(error: unknown): boolean {
  return error instanceof ApiRequestError && spotifySessionCodeNeedsReconnect(error.code);
}

/** Clé i18n pour un code session Spotify (null = pas de message dédié). */
export function spotifySessionCodeI18nKey(code?: string): string | null {
  switch (code) {
    case 'spotify_scope_missing':
      return 'salon.spotifySearch.errorPlaylistScopeMissing';
    case 'spotify_premium_required':
      return 'salon.spotifySearch.errorPremiumRequired';
    case 'spotify_token_expired':
      return 'salon.spotifySearch.errorTokenExpired';
    case 'spotify_not_connected':
      return 'salon.spotifySearch.errorNotConnected';
    case 'spotify_playlist_forbidden':
      return 'salon.spotifySearch.errorPlaylistForbidden';
    default:
      return code ? 'salon.spotifySearch.playlistSessionError' : null;
  }
}

export function translateSpotifySessionCode(t: TFunction, code?: string): string | null {
  const key = spotifySessionCodeI18nKey(code);
  return key ? t(key) : null;
}

export function translateSpotifyApiError(t: TFunction, error: unknown, fallbackKey: string): string {
  if (error instanceof ApiRequestError) {
    const fromCode = error.code ? translateSpotifySessionCode(t, error.code) : null;
    if (fromCode) return fromCode;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return t(fallbackKey);
}

export function toSpotifyPlaylistRef(
  selection: { playlistId?: string; playlistUrl?: string } | null | undefined
): SpotifyPlaylistRef | null {
  if (!selection) return null;
  if (selection.playlistUrl?.trim()) return { playlistUrl: selection.playlistUrl.trim() };
  if (selection.playlistId?.trim()) return { playlistId: selection.playlistId.trim() };
  return null;
}

export async function redirectToSpotifyReconnect(token: string): Promise<void> {
  const { url } = await api.getSpotifyOAuthUrl(token, { reconnect: true });
  window.location.href = url;
}

/** Erreurs création salon (Spotify + codes métier Soundy). */
export function translateSalonCreateError(
  t: TFunction,
  error: unknown,
  platform: 'spotify' | 'youtube'
): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'spotify_premium_required') return t('salon.create.spotifyPremiumRequired');
    if (error.code === 'HOST_PLATFORM_NOT_LINKED') {
      return platform === 'spotify'
        ? t('salon.create.errorPlatformNotLinkedSpotify')
        : t('salon.create.errorPlatformNotLinkedYoutube');
    }
  }
  return translateSpotifyApiError(t, error, 'salon.create.errorFailed');
}

/** Applique l'état session depuis la réponse GET /spotify/playlists. */
export function applySpotifyPlaylistListSession(
  spotifySessionValid: boolean | undefined,
  spotifySessionCode: string | undefined,
  t: TFunction
): { needsReconnect: boolean; error: string | null } {
  if (spotifySessionValid !== false) {
    return { needsReconnect: false, error: null };
  }
  return {
    needsReconnect: true,
    error: translateSpotifySessionCode(t, spotifySessionCode) ?? t('salon.spotifySearch.playlistSessionError'),
  };
}
