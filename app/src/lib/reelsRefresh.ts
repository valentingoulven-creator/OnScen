export const REELS_UPDATED_EVENT = 'soundy:reels-updated';

export function notifyReelsUpdated(): void {
  window.dispatchEvent(new CustomEvent(REELS_UPDATED_EVENT));
}
