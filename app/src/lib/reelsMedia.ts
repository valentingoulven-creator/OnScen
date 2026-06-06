/** Root container for the Reels tab — used to stop all media synchronously on tab change. */
export const REELS_ROOT_SELECTOR = '[data-reels-root]';

export interface PauseAllReelsMediaOptions {
  /** Remet currentTime à 0 (ex. quitter l’onglet Reels). Défaut : false pour ne pas casser la lecture au tap. */
  resetPosition?: boolean;
}

function pauseReelsMediaNode(media: HTMLMediaElement, resetPosition: boolean): void {
  media.pause();
  media.playbackRate = 1;
  if (resetPosition) {
    try {
      media.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  media.muted = true;
  media.volume = 0;
}

/** Pause every audio/video inside the reels root (sync, before React unmount). */
export function pauseAllReelsMediaInDom(options?: PauseAllReelsMediaOptions): void {
  const resetPosition = options?.resetPosition === true;
  const root = document.querySelector(REELS_ROOT_SELECTOR);
  if (!root) return;
  root.querySelectorAll('video, audio').forEach((node) => {
    pauseReelsMediaNode(node as HTMLMediaElement, resetPosition);
  });
}

/** Pause inactive reels only — avoids muting/pausing the slide that is about to play. */
export function pauseInactiveReelsMediaInDom(
  activeReelId: string,
  options?: PauseAllReelsMediaOptions
): void {
  const resetPosition = options?.resetPosition === true;
  const root = document.querySelector(REELS_ROOT_SELECTOR);
  if (!root) return;
  root.querySelectorAll('[data-reel-id]').forEach((slide) => {
    const reelId = slide.getAttribute('data-reel-id');
    if (!reelId || reelId === activeReelId) return;
    slide.querySelectorAll('video, audio').forEach((node) => {
      pauseReelsMediaNode(node as HTMLMediaElement, resetPosition);
    });
  });
}
