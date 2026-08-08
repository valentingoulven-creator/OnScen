/** Deep link `/live/:liveId` — ouverture directe d'un live spectateur. */

const PENDING_KEY = 'onscen_pending_live_join';

export function getLivePath(liveId: string): string {
  return `/live/${encodeURIComponent(liveId)}`;
}

export function parseLiveIdFromLocation(loc: Location = window.location): string | null {
  const pathMatch = loc.pathname.match(/^\/live\/([^/]+)\/?$/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
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

/** Conserve `/live/:id` dans la barre d'adresse pendant la session spectateur. */
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
  window.history.replaceState({}, '', `/${q ? `?${q}` : ''}`);
}
