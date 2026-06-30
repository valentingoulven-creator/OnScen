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

/**
 * Runs callbacks when the OS locks the screen or the app is backgrounded
 * (`visibilitychange`, `pagehide`). Pas de `blur` : évite d’arrêter la lecture à tort sur mobile.
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

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [enabled]);
}

export type PauseMediaElementsOptions = {
  /** Keep host/viewer live stage videos playing (`.live-video-container`). */
  exceptLiveStage?: boolean;
};

/** Pause and mute every video/audio under `root` (defaults to document). */
export function pauseMediaElements(
  root: ParentNode = document,
  opts?: PauseMediaElementsOptions
) {
  root.querySelectorAll('video, audio').forEach((node) => {
    if (!(node instanceof HTMLMediaElement)) return;
    if (opts?.exceptLiveStage && node.closest('.live-video-container')) return;
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
