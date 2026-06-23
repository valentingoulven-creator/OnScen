import { useEffect, useState } from 'react';
import {
  getCookieConsent,
  hasThirdPartyCookieConsent,
  subscribeCookieConsent,
} from '../lib/cookieConsent';

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
  const [consent, setConsent] = useState(hasThirdPartyCookieConsent);

  useEffect(() => subscribeCookieConsent(() => setConsent(hasThirdPartyCookieConsent())), []);

  useEffect(() => {
    if (!consent) {
      setReady(false);
      return;
    }
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
  }, [consent]);

  return ready;
}

export function useYoutubeConsentBlocked(): boolean {
  const [blocked, setBlocked] = useState(() => getCookieConsent() === 'essential');
  useEffect(() => subscribeCookieConsent((choice) => setBlocked(choice === 'essential')), []);
  return blocked;
}
