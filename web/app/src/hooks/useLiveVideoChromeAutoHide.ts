import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const LIVE_VIDEO_CHROME_IDLE_MS = 10_000;

/**
 * Auto-hide live video chrome (fullscreen, PiP, chat, pause) after idle.
 * Reveals on pointer activity over the stage area (mouse move/enter, touch).
 */
export function useLiveVideoChromeAutoHide(
  stageAreaRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
    }, LIVE_VIDEO_CHROME_IDLE_MS);
  }, [clearHideTimer]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      setChromeVisible(true);
      return;
    }

    const stage = stageAreaRef.current;
    if (!stage) return;

    const onActivity = () => {
      revealChrome();
    };

    scheduleHide();

    stage.addEventListener('mousemove', onActivity);
    stage.addEventListener('mouseenter', onActivity);
    stage.addEventListener('touchstart', onActivity, { passive: true });
    stage.addEventListener('touchmove', onActivity, { passive: true });
    stage.addEventListener('pointerdown', onActivity);

    return () => {
      clearHideTimer();
      stage.removeEventListener('mousemove', onActivity);
      stage.removeEventListener('mouseenter', onActivity);
      stage.removeEventListener('touchstart', onActivity);
      stage.removeEventListener('touchmove', onActivity);
      stage.removeEventListener('pointerdown', onActivity);
    };
  }, [enabled, stageAreaRef, revealChrome, scheduleHide, clearHideTimer]);

  return { chromeVisible, revealChrome };
}
