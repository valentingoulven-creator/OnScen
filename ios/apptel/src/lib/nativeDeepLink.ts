/**
 * Deep links natifs (App Links / Universal Links) → routing React existant.
 */
import { App as CapApp } from '@capacitor/app';

const PROD_HOSTS = new Set<string>(['onscen.com', 'www.onscen.com']);

function isProdDeepLinkHost(hostname: string): boolean {
  return PROD_HOSTS.has(hostname.toLowerCase());
}

/** PWA `/tel/live/…` → chemin Capacitor `/live/…` (base `./`). */
function toNativeAppPath(pathname: string): string {
  if (pathname === '/tel' || pathname === '/tel/') return '/';
  if (pathname.startsWith('/tel/')) {
    const rest = pathname.slice(4);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}

function applyDeepLinkPath(pathname: string, search: string, hash: string): void {
  const nativePath = toNativeAppPath(pathname);
  const path = `${nativePath}${search}${hash}`;
  if (window.location.pathname + window.location.search + window.location.hash === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function initNativeDeepLinks(): void {
  void CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);
      if (!isProdDeepLinkHost(url.hostname)) return;
      applyDeepLinkPath(url.pathname, url.search, url.hash);
    } catch {
      /* ignore malformed */
    }
  });

  void CapApp.getLaunchUrl().then((result) => {
    if (!result?.url) return;
    try {
      const url = new URL(result.url);
      if (!isProdDeepLinkHost(url.hostname)) return;
      applyDeepLinkPath(url.pathname, url.search, url.hash);
    } catch {
      /* ignore */
    }
  });
}
