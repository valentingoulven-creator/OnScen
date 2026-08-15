/** Deep link `/tel/live/:liveId` (Vite base `/tel/`) — aussi `/live/:id` natif. */

const PENDING_KEY = 'onscen_pending_live_join';

function appBasePath(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === './' || base === '.') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function getLivePath(liveId: string): string {
  return `${appBasePath()}live/${encodeURIComponent(liveId)}`;
}

export function parseLiveIdFromLocation(loc: Location = window.location): string | null {
  const pathname = loc.pathname.replace(/\/+$/, '') || '/';
  const prefixed = pathname.match(/^\/tel\/live\/([^/]+)$/i);
  if (prefixed) return decodeURIComponent(prefixed[1]);
  const bare = pathname.match(/^\/live\/([^/]+)$/i);
  if (bare) return decodeURIComponent(bare[1]);
  return null;
}

export function persistPendingLiveJoin(liveId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, liveId);
  } catch {
    /* ignore */
  }
}

export function consumePendingLiveJoin(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    if (id) sessionStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}

export function peekPendingLiveJoin(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/** Conserve `/tel/live/:id` dans la barre d'adresse pendant la session spectateur. */
export function syncLiveUrlInBar(liveId: string): void {
  const path = getLivePath(liveId);
  if (window.location.pathname === path) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.toString();
  window.history.replaceState({}, '', `${path}${q ? `?${q}` : ''}`);
}

export function clearLiveUrlFromBar(): void {
  if (!parseLiveIdFromLocation()) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.toString();
  const home = appBasePath();
  window.history.replaceState({}, '', `${home}${q ? `?${q}` : ''}`);
}
