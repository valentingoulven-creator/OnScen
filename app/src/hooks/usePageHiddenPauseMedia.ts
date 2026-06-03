import { useEffect, useRef } from 'react';

export interface UsePageHiddenPauseMediaOptions {
  /** When false, listeners are not attached. */
  enabled?: boolean;
  onPageHidden: () => void;
  /** Fired when the page becomes visible again (unlock, tab focus). */
  onPageVisible?: () => void;
}

function shouldTreatPageAsHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || document.visibilityState === 'hidden';
}

function shouldPauseFromBlur(): boolean {
  if (shouldTreatPageAsHidden()) return true;
  if (typeof document !== 'undefined' && !document.hasFocus()) return true;
  return false;
}

/**
 * Pauses media when the OS locks the screen, the app is backgrounded, or the PWA loses focus
 * (`visibilitychange`, `pagehide`, and `blur` for iOS/Android PWA).
 */
export function usePageHiddenPauseMedia({
  enabled = true,
  onPageHidden,
  onPageVisible,
}: UsePageHiddenPauseMediaOptions) {
  const onHiddenRef = useRef(onPageHidden);
  const onVisibleRef = useRef(onPageVisible);
  onHiddenRef.current = onPageHidden;
  onVisibleRef.current = onPageVisible;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (shouldTreatPageAsHidden()) onHiddenRef.current();
      else onVisibleRef.current?.();
    };

    const handlePageHide = () => {
      if (shouldTreatPageAsHidden()) onHiddenRef.current();
    };

    const handleBlur = () => {
      window.setTimeout(() => {
        if (shouldPauseFromBlur()) onHiddenRef.current();
      }, 0);
    };

    const handleFocus = () => {
      if (!shouldTreatPageAsHidden()) onVisibleRef.current?.();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled]);
}

/** Pause and mute every video/audio under `root` (defaults to document). */
export function pauseMediaElements(root: ParentNode = document) {
  root.querySelectorAll('video, audio').forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    node.pause();
    node.muted = true;
    if ('volume' in node) node.volume = 0;
  });
}

/** Stops YouTube embed audio by unloading iframe src (returns saved src for restore). */
export function pauseYoutubeEmbeds(root: ParentNode = document): string[] {
  const saved: string[] = [];
  root.querySelectorAll('iframe').forEach((node) => {
    if (!(node instanceof HTMLIFrameElement)) return;
    const src = node.src?.trim();
    if (!src || src === 'about:blank') return;
    if (!/youtube\.com|youtu\.be/i.test(src)) return;
    saved.push(src);
    node.src = 'about:blank';
  });
  return saved;
}

/** Restores YouTube iframe URLs previously cleared by `pauseYoutubeEmbeds`. */
export function restoreYoutubeEmbeds(root: ParentNode, urls: string[]) {
  const iframes = [...root.querySelectorAll('iframe')].filter(
    (n): n is HTMLIFrameElement => n instanceof HTMLIFrameElement
  );
  urls.forEach((url, i) => {
    const iframe = iframes[i];
    if (!iframe || !url) return;
    iframe.src = url;
  });
}
