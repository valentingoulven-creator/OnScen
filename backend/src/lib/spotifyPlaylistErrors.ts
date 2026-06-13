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
import { invalidateStoredSpotifyOAuthScopes } from './spotifyOAuth';

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

function classifyPlaylist403(
  detail: string | undefined,
  context: string,
  user?: User
): SpotifyPlaylistError | null {
  if (isSpotifyScopeMissingError(detail)) {
    if (user) invalidateStoredSpotifyOAuthScopes(user, `${context}:scope_explicit`);
    return new SpotifyPlaylistError(spotifyScopeMissingMessage(), 403, 'spotify_scope_missing');
  }
  if (isSpotifyBareForbiddenError(detail)) {
    console.warn('[spotify-playlist] bare 403 Forbidden on playlist tracks', {
      context,
      userId: user?.id,
    });
    return new SpotifyPlaylistError(
      'Playlist Spotify inaccessible — elle est peut-être privée ou réservée à son propriétaire.',
      403,
      'spotify_playlist_private'
    );
  }
  return null;
}

/** Mappe une erreur API Spotify playlist → SpotifyPlaylistError (codes stables pour le frontend). */
export function throwSpotifyPlaylistApiError(
  status: number,
  detail: string | undefined,
  context: string,
  user?: User
): never {
  if (status === 403) {
    const classified = classifyPlaylist403(detail, context, user);
    if (classified) throw classified;
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
        : 'Playlist Spotify inaccessible — elle est peut-être privée ou réservée à son propriétaire.',
      403,
      'spotify_playlist_private'
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
