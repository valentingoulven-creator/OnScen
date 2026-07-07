import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { LIVE_VIDEO_CHROME_IDLE_MS } from './useLiveVideoChromeAutoHide';

/**
 * Auto-hide floating chat chrome (header bandeau + input bar) after idle.
 * One shared timer for the whole panel ÔÇö reveals on any pointer/keyboard/scroll activity.
 */
export function useFloatingChatChromeAutoHide(
  panelRef: RefObject<HTMLElement | null>,
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

    const panel = panelRef.current;
    if (!panel) return;

    const onActivity = () => {
      revealChrome();
    };

    scheduleHide();

    const passiveCapture = { passive: true, capture: true } as AddEventListenerOptions;
    const passive = { passive: true } as AddEventListenerOptions;

    panel.addEventListener('mousemove', onActivity);
    panel.addEventListener('mouseenter', onActivity);
    panel.addEventListener('touchstart', onActivity, passive);
    panel.addEventListener('touchmove', onActivity, passive);
    panel.addEventListener('pointerdown', onActivity);
    panel.addEventListener('keydown', onActivity);
    panel.addEventListener('wheel', onActivity, passiveCapture);
    panel.addEventListener('scroll', onActivity, passiveCapture);

    return () => {
      clearHideTimer();
      panel.removeEventListener('mousemove', onActivity);
      panel.removeEventListener('mouseenter', onActivity);
      panel.removeEventListener('touchstart', onActivity);
      panel.removeEventListener('touchmove', onActivity);
      panel.removeEventListener('pointerdown', onActivity);
      panel.removeEventListener('keydown', onActivity);
      panel.removeEventListener('wheel', onActivity, passiveCapture);
      panel.removeEventListener('scroll', onActivity, passiveCapture);
    };
  }, [enabled, panelRef, revealChrome, scheduleHide, clearHideTimer]);

  return { chromeVisible, revealChrome };
}
