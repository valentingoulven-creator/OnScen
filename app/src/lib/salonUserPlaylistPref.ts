/** Dernière playlist choisie par utilisateur + plateforme (localStorage). */

export type SalonUserPlaylistPref = {
  playlistId?: string;
  playlistUrl?: string;
  title?: string;
};

const STORAGE_KEY = 'soundy_salon_playlist_pref_v1';

function storageKey(userId: string, platform: string): string {
  return `${userId}:${platform}`;
}

export function readSalonUserPlaylistPref(
  userId: string,
  platform: string
): SalonUserPlaylistPref | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, SalonUserPlaylistPref>;
    const entry = map[storageKey(userId, platform)];
    if (!entry) return null;
    if (!entry.playlistId?.trim() && !entry.playlistUrl?.trim()) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeSalonUserPlaylistPref(
  userId: string,
  platform: string,
  pref: SalonUserPlaylistPref
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, SalonUserPlaylistPref>;
    map[storageKey(userId, platform)] = pref;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}
