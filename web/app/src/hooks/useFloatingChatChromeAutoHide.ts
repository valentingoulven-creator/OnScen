import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const FLOATING_CHAT_CHROME_IDLE_MS = 5_000;

/**
 * Auto-hide floating chat chrome (header bandeau + input bar) after idle.
 * Message feed stays visible. Reveals on pointer, scroll, keyboard, or focus inside panel.
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
    }, FLOATING_CHAT_CHROME_IDLE_MS);
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

    panel.addEventListener('pointerdown', onActivity);
    panel.addEventListener('touchstart', onActivity, { passive: true });
    panel.addEventListener('scroll', onActivity, true);
    panel.addEventListener('keydown', onActivity);
    panel.addEventListener('focusin', onActivity);
    panel.addEventListener('wheel', onActivity, { passive: true });

    return () => {
      clearHideTimer();
      panel.removeEventListener('pointerdown', onActivity);
      panel.removeEventListener('touchstart', onActivity);
      panel.removeEventListener('scroll', onActivity, true);
      panel.removeEventListener('keydown', onActivity);
      panel.removeEventListener('focusin', onActivity);
      panel.removeEventListener('wheel', onActivity);
    };
  }, [enabled, panelRef, revealChrome, scheduleHide, clearHideTimer]);

  return { chromeVisible, revealChrome };
}
