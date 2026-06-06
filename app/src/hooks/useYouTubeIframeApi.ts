import { useEffect, useState } from 'react';

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

/** Charge l’API IFrame YouTube une seule fois (lecture salon synchronisée). */
export function useYouTubeIframeApi(): boolean {
  const [ready, setReady] = useState(() => Boolean(window.YT?.Player));

  useEffect(() => {
    if (window.YT?.Player) {
      setReady(true);
      return;
    }
    if (!loadPromise) {
      loadPromise = new Promise<void>((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve();
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      });
    }
    loadPromise.then(() => setReady(true)).catch(() => setReady(false));
  }, []);

  return ready;
}
