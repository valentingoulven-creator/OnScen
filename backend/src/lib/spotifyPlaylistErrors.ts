import { User } from '../models/schema';
import {
  isSpotifyBareForbiddenError,
  isSpotifyDevUserNotAllowedError,
  isSpotifyPremiumRequiredError,
  isSpotifyScopeMissingError,
  isSpotifyTokenExpiredError,
  spotifyAuthErrorMessage,
  spotifyDevUserNotAllowedMessage,
  spotifyPremiumRequiredMessage,
  spotifyScopeMissingMessage,
} from './spotifyApi';
import {
  getMissingSpotifyPlaylistReadScopes,
  getStoredSpotifyOAuthScopes,
  invalidateStoredSpotifyOAuthScopes,
} from './spotifyOAuth';

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

function playlistReadScopesMissing(user: User): boolean {
  return getMissingSpotifyPlaylistReadScopes(getStoredSpotifyOAuthScopes(user)).length > 0;
}

/** Mappe une erreur API Spotify playlist → SpotifyPlaylistError (codes stables pour le frontend). */
export function throwSpotifyPlaylistApiError(
  status: number,
  detail: string | undefined,
  context: string,
  user?: User
): never {
  if (status === 403 && isSpotifyScopeMissingError(detail)) {
    if (user) invalidateStoredSpotifyOAuthScopes(user, `${context}:scope_explicit`);
    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }

  if (status === 403 && isSpotifyBareForbiddenError(detail)) {
    if (user) invalidateStoredSpotifyOAuthScopes(user, `${context}:403_forbidden`);
    console.warn('[spotify-playlist] bare 403 Forbidden → scope reconnect required', {
      context,
      userId: user?.id,
      storedScopes: user ? getStoredSpotifyOAuthScopes(user) : undefined,
    });
    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }

  if (status === 403 && user && playlistReadScopesMissing(user)) {
    if (user) invalidateStoredSpotifyOAuthScopes(user, `${context}:stored_scopes_missing`);
    throw new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }

  if (status === 403 && isSpotifyPremiumRequiredError(detail)) {
    throw new SpotifyPlaylistError(spotifyPremiumRequiredMessage(), 403, 'spotify_premium_required');
  }

  if (status === 403 && isSpotifyDevUserNotAllowedError(detail)) {
    throw new SpotifyPlaylistError(spotifyDevUserNotAllowedMessage(), 403, 'spotify_dev_user_not_allowed');
  }

  console.warn('[spotify-playlist] API error', { status, detail, context, userId: user?.id });

  if (status === 401 || (status === 403 && isSpotifyTokenExpiredError(detail))) {
    throw new SpotifyPlaylistError(spotifyAuthErrorMessage(status, detail), 403, 'spotify_token_expired');
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
    throw new SpotifyPlaylistError('Quota Spotify atteint — réessayez plus tard.', 429, 'spotify_rate_limited');
  }

  throw new SpotifyPlaylistError(
    detail
      ? `Impossible de charger la playlist — ${detail}`
      : 'Impossible de charger la playlist Spotify — réessayez.',
    502,
    'spotify_playlist_failed'
  );
}
