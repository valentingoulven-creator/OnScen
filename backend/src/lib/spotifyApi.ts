export interface SpotifyApiErrorBody {
  error?: { status?: number; message?: string };
}

export function isFetchAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e instanceof Error && e.name === 'AbortError') return true;
  return false;
}

export function isFetchNetworkError(e: unknown): boolean {
  return e instanceof TypeError;
}

export async function parseSpotifyErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as SpotifyApiErrorBody;
    return body.error?.message?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function isSpotifyScopeMissingError(detail?: string): boolean {
  const d = detail?.toLowerCase() ?? '';
  return (
    d.includes('insufficient client scope') ||
    d.includes('insufficient scope') ||
    d.includes('missing scope') ||
    d.includes('scope not granted')
  );
}

/** 403 Spotify sans détail explicite — souvent scope manquant ou jeton invalide. */
export function isSpotifyBareForbiddenError(detail?: string): boolean {
  const d = detail?.trim().toLowerCase() ?? '';
  return !d || d === 'forbidden' || d === 'access denied';
}

export function isSpotifyPremiumRequiredError(detail?: string): boolean {
  const d = detail?.toLowerCase() ?? '';
  return (
    d.includes('premium required') ||
    d.includes('requires premium') ||
    d.includes('non-premium') ||
    (d.includes('premium') && d.includes('subscription'))
  );
}

export function isSpotifyDevUserNotAllowedError(detail?: string): boolean {
  const d = detail?.toLowerCase() ?? '';
  return d.includes('not registered') || d.includes('user not registered');
}

/** 403 Spotify lié au jeton (pas scope manquant ni premium). */
export function isSpotifyTokenExpiredError(detail?: string): boolean {
  if (!detail) return false;
  const d = detail.toLowerCase();
  return (
    d.includes('expired') ||
    d.includes('invalid access token') ||
    d.includes('token revoked') ||
    d.includes('invalid token')
  );
}

export type SpotifyProduct = 'premium' | 'free' | 'open' | 'unknown';

export function normalizeSpotifyProduct(product?: string): SpotifyProduct {
  const p = product?.trim().toLowerCase();
  if (p === 'premium') return 'premium';
  if (p === 'free') return 'free';
  if (p === 'open') return 'open';
  return 'unknown';
}

export function isSpotifyPlaybackHostProduct(product: SpotifyProduct): boolean {
  return product === 'premium';
}

export function spotifyPlaybackControlScopeMissingMessage(): string {
  return 'Reconnectez Spotify pour autoriser le contrôle de lecture (play/pause).';
}

export function spotifyPremiumRequiredMessage(): string {
  return 'Spotify Premium requis — un compte Free ne peut pas lancer ni contrôler la lecture via Connect.';
}

export function spotifyDevUserNotAllowedMessage(): string {
  return 'Compte Spotify non autorisé pour cette app — reconnectez Spotify (utilisateur allowlist requis en mode dev).';
}

/** 401 ou 403 générique (hors scope manquant) — tenter refresh + retry une fois. */
export function isSpotifyRetryableAuthError(status: number, detail?: string): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;
  return !isSpotifyScopeMissingError(detail);
}

export function spotifyScopeMissingMessage(): string {
  return 'Reconnectez Spotify pour autoriser l’accès aux playlists (autorisation requise).';
}

export function spotifyAuthErrorMessage(status: number, detail?: string): string {
  if (status === 403 && isSpotifyScopeMissingError(detail)) {
    return spotifyScopeMissingMessage();
  }
  if (status === 403 && isSpotifyPremiumRequiredError(detail)) {
    return spotifyPremiumRequiredMessage();
  }
  if (status === 401 || status === 403) {
    if (isSpotifyDevUserNotAllowedError(detail)) {
      return spotifyDevUserNotAllowedMessage();
    }
    return 'Session Spotify expirée — reconnectez votre compte Spotify.';
  }
  return 'Session Spotify expirée — reconnectez votre compte Spotify.';
}

export type SpotifyPlayerErrorCode =
  | 'no_active_device'
  | 'spotify_scope_missing'
  | 'spotify_premium_required'
  | 'spotify_token_expired'
  | 'spotify_dev_user_not_allowed'
  | 'spotify_rate_limited'
  | 'spotify_playback_failed';

export function classifySpotifyPlayerApiError(
  status: number,
  detail: string | undefined,
  fallback: string
): { message: string; code: SpotifyPlayerErrorCode; status: number } {
  if (status === 404) {
    return {
      message: 'Aucun appareil Spotify actif — ouvrez l’app Spotify et relancez la lecture.',
      code: 'no_active_device',
      status: 404,
    };
  }
  if (status === 403 && isSpotifyScopeMissingError(detail)) {
    return {
      message: spotifyPlaybackControlScopeMissingMessage(),
      code: 'spotify_scope_missing',
      status: 403,
    };
  }
  if (status === 403 && isSpotifyPremiumRequiredError(detail)) {
    return {
      message: spotifyPremiumRequiredMessage(),
      code: 'spotify_premium_required',
      status: 403,
    };
  }
  if (status === 403 && isSpotifyDevUserNotAllowedError(detail)) {
    return {
      message: spotifyDevUserNotAllowedMessage(),
      code: 'spotify_dev_user_not_allowed',
      status: 403,
    };
  }
  if (status === 401 || status === 403) {
    return {
      message: 'Session Spotify expirée — reconnectez Spotify.',
      code: 'spotify_token_expired',
      status: 403,
    };
  }
  if (status === 429) {
    return {
      message: 'Spotify temporairement indisponible — réessayez.',
      code: 'spotify_rate_limited',
      status: 429,
    };
  }
  return {
    message: fallback,
    code: 'spotify_playback_failed',
    status: status || 502,
  };
}

export function spotifyNetworkErrorMessage(context: 'search' | 'playlist'): string {
  return context === 'search'
    ? 'Impossible de joindre Spotify — vérifiez votre connexion et réessayez.'
    : 'Impossible de joindre Spotify pour charger la playlist — réessayez.';
}
