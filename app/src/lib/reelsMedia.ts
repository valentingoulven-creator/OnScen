/** Root container for the Reels tab — used to stop all media synchronously on tab change. */
export const REELS_ROOT_SELECTOR = '[data-reels-root]';

/** Pause every audio/video inside the reels root (sync, before React unmount). */
export function pauseAllReelsMediaInDom(): void {
  const root = document.querySelector(REELS_ROOT_SELECTOR);
  if (!root) return;
  root.querySelectorAll('video, audio').forEach((node) => {
    const media = node as HTMLMediaElement;
    media.pause();
    media.playbackRate = 1;
    try {
      media.currentTime = 0;
    } catch {
      /* ignore */
    }
    media.muted = true;
    media.volume = 0;
  });
}
