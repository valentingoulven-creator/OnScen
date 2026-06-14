import { invalidatePlatformStatusCache } from './platformStatusCache';

/** Déclenché après retour OAuth (?spotify_oauth=ok / ?youtube_oauth=ok) pour rafraîchir les cartes plateforme. */
export const PLATFORM_STATUS_REFRESH_EVENT = 'soundly:platform-status-refresh';

export function dispatchPlatformStatusRefresh(): void {
  invalidatePlatformStatusCache();
  window.dispatchEvent(new Event(PLATFORM_STATUS_REFRESH_EVENT));
}
