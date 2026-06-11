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
  if (status === 401 || status === 403) {
    if (detail?.toLowerCase().includes('not registered')) {
      return 'Compte Spotify non autorisé pour cette app — reconnectez Spotify (utilisateur allowlist requis en mode dev).';
    }
    return 'Session Spotify expirée — reconnectez votre compte Spotify.';
  }
  return 'Session Spotify expirée — reconnectez votre compte Spotify.';
}

export function spotifyNetworkErrorMessage(context: 'search' | 'playlist'): string {
  return context === 'search'
    ? 'Impossible de joindre Spotify — vérifiez votre connexion et réessayez.'
    : 'Impossible de joindre Spotify pour charger la playlist — réessayez.';
}
