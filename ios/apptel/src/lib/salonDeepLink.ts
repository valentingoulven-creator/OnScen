/** Query param legacy / alternate: `/?join=salonId` */
export const SALON_JOIN_QUERY = 'join';

const PENDING_KEY = 'onscen_pending_salon_join';

function appBasePath(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === './' || base === '.') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Same format as POST /salons (backend). Use before creation for shareable invite links. */
export function generateSalonId(): string {
  return `salon_${crypto.randomUUID()}`;
}

export function getSalonPath(salonId: string): string {
  return `${appBasePath()}salon/${encodeURIComponent(salonId)}`;
}

export function parseSalonIdFromLocation(loc: Location = window.location): string | null {
  const pathname = loc.pathname.replace(/\/+$/, '') || '/';
  const prefixed = pathname.match(/^\/tel\/salon\/([^/]+)$/i);
  if (prefixed) return decodeURIComponent(prefixed[1]);
  const bare = pathname.match(/^\/salon\/([^/]+)$/i);
  if (bare) return decodeURIComponent(bare[1]);
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

/** Keep shareable `/tel/salon/:id` in the address bar after navigation. */
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
  window.history.replaceState({}, '', `${appBasePath()}${q ? `?${q}` : ''}`);
}
