export const MUSIC_FAVORITES_CHANGED = 'soundy:music-favorites-changed';

export function notifyMusicFavoritesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MUSIC_FAVORITES_CHANGED));
}
