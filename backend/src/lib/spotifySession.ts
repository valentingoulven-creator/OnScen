import type { Response } from 'express';
import {
  spotifyAuthErrorMessage,
  spotifyDevUserNotAllowedMessage,
  spotifyPremiumRequiredMessage,
  spotifyScopeMissingMessage,
} from './spotifyApi';

/** Codes session Spotify renvoyés par probeSpotifyHostSession et les routes playlist. */
export type SpotifySessionFailureCode =
  | 'spotify_token_expired'
  | 'spotify_scope_missing'
  | 'spotify_not_connected'
  | 'spotify_premium_required'
  | 'spotify_dev_user_not_allowed'
  | 'spotify_network_error'
  | 'spotify_rate_limited';

/** Codes nécessitant reconnexion OAuth ou nouvelle autorisation. */
export const SPOTIFY_SESSION_AUTH_CODES = new Set<string>([
  'spotify_token_expired',
  'spotify_scope_missing',
  'spotify_not_connected',
  'spotify_premium_required',
  'spotify_dev_user_not_allowed',
]);

export function isSpotifySessionAuthCode(code: string): code is SpotifySessionFailureCode {
  return SPOTIFY_SESSION_AUTH_CODES.has(code);
}

/** Message utilisateur FR unique pour un code session (source de vérité backend). */
export function spotifySessionFailureMessage(code: string): string {
  switch (code) {
    case 'spotify_scope_missing':
      return spotifyScopeMissingMessage();
    case 'spotify_premium_required':
      return spotifyPremiumRequiredMessage();
    case 'spotify_dev_user_not_allowed':
      return spotifyDevUserNotAllowedMessage();
    case 'spotify_not_connected':
      return 'Compte Spotify non connecté — reconnectez Spotify.';
    case 'spotify_token_expired':
      return spotifyAuthErrorMessage(403);
    default:
      return spotifyAuthErrorMessage(403);
  }
}

/** Réponse HTTP 403 standardisée pour échec session Spotify (routes playlist / salon). */
export function respondSpotifySessionAuthFailure(res: Response, code: string): boolean {
  if (!isSpotifySessionAuthCode(code)) return false;
  res.status(403).json({ error: spotifySessionFailureMessage(code), code });
  return true;
}
