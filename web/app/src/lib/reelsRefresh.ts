export const REELS_UPDATED_EVENT = 'onscen:reels-updated';

export function notifyReelsUpdated(): void {
  window.dispatchEvent(new CustomEvent(REELS_UPDATED_EVENT));
}
