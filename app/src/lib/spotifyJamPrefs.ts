import { normalizeSpotifyJamUrl } from './spotifyJam';

const URL_KEY = 'melosong_saved_spotify_jam_url';
const ENABLED_KEY = 'melosong_save_spotify_jam';

export function isSaveSpotifyJamEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function getSavedSpotifyJamUrl(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(URL_KEY);
    if (!raw) return null;
    return normalizeSpotifyJamUrl(raw);
  } catch {
    return null;
  }
}

export function setSaveSpotifyJamEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, '1');
    } else {
      localStorage.removeItem(ENABLED_KEY);
      localStorage.removeItem(URL_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Enregistre un lien Jam normalisé si l’option est activée. Retourne l’URL canonique ou null. */
export function persistSavedSpotifyJamUrl(input: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  const normalized = normalizeSpotifyJamUrl(input);
  if (!normalized) return null;
  try {
    localStorage.setItem(URL_KEY, normalized);
    localStorage.setItem(ENABLED_KEY, '1');
  } catch {
    /* ignore */
  }
  return normalized;
}

/** Met à jour le lien enregistré uniquement si l’option est déjà activée. */
export function updateSavedSpotifyJamUrlIfEnabled(input: string): void {
  if (!isSaveSpotifyJamEnabled()) return;
  const normalized = normalizeSpotifyJamUrl(input);
  if (typeof localStorage === 'undefined') return;
  try {
    if (normalized) {
      localStorage.setItem(URL_KEY, normalized);
    } else {
      localStorage.removeItem(URL_KEY);
    }
  } catch {
    /* ignore */
  }
}
