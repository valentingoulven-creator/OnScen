/** Query param legacy / alternate: `/?join=salonId` */
export const SALON_JOIN_QUERY = 'join';

const PENDING_KEY = 'melosong_pending_salon_join';

export function getSalonPath(salonId: string): string {
  return `/salon/${encodeURIComponent(salonId)}`;
}

export function parseSalonIdFromLocation(loc: Location = window.location): string | null {
  const pathMatch = loc.pathname.match(/^\/salon\/([^/]+)\/?$/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const join = new URLSearchParams(loc.search).get(SALON_JOIN_QUERY);
  if (join?.trim()) return join.trim();
  return null;
}

export function persistPendingSalonJoin(salonId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, salonId);
  } catch {
    /* ignore */
  }
}

export function consumePendingSalonJoin(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    if (id) sessionStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}

export function peekPendingSalonJoin(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/** Keep shareable `/salon/:id` in the address bar after navigation. */
export function syncSalonUrlInBar(salonId: string): void {
  const path = getSalonPath(salonId);
  if (window.location.pathname === path) return;
  const params = new URLSearchParams(window.location.search);
  params.delete(SALON_JOIN_QUERY);
  const q = params.toString();
  window.history.replaceState({}, '', `${path}${q ? `?${q}` : ''}`);
}

export function clearSalonUrlFromBar(): void {
  if (!parseSalonIdFromLocation()) return;
  const params = new URLSearchParams(window.location.search);
  params.delete(SALON_JOIN_QUERY);
  const q = params.toString();
  window.history.replaceState({}, '', `/${q ? `?${q}` : ''}`);
}
