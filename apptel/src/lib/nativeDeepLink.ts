/**
 * Deep links natifs (App Links / Universal Links) → routing React existant.
 */
import { App as CapApp } from '@capacitor/app';

const PROD_HOST = 'getsoundy.com';

function applyDeepLinkPath(pathname: string, search: string, hash: string): void {
  const path = `${pathname}${search}${hash}`;
  if (window.location.pathname + window.location.search + window.location.hash === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function initNativeDeepLinks(): void {
  void CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);
      if (url.hostname !== PROD_HOST && url.hostname !== `www.${PROD_HOST}`) return;
      applyDeepLinkPath(url.pathname, url.search, url.hash);
    } catch {
      /* ignore malformed */
    }
  });

  void CapApp.getLaunchUrl().then((result) => {
    if (!result?.url) return;
    try {
      const url = new URL(result.url);
      if (url.hostname !== PROD_HOST && url.hostname !== `www.${PROD_HOST}`) return;
      applyDeepLinkPath(url.pathname, url.search, url.hash);
    } catch {
      /* ignore */
    }
  });
}
