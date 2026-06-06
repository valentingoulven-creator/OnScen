const PENDING_KEY = 'melosong_pending_profile_view';

export function getProfilePath(userId: string): string {
  return `/profile/${encodeURIComponent(userId)}`;
}

export function parseProfileIdFromLocation(loc: Location = window.location): string | null {
  const pathMatch = loc.pathname.match(/^\/profile\/([^/]+)\/?$/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  return null;
}

export function persistPendingProfileView(userId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function consumePendingProfileView(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_KEY);
    if (id) sessionStorage.removeItem(PENDING_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Keep shareable `/profile/:id` in the address bar after navigation. */
export function syncProfileUrlInBar(userId: string): void {
  const path = getProfilePath(userId);
  if (window.location.pathname === path) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.toString();
  window.history.replaceState({}, '', `${path}${q ? `?${q}` : ''}`);
}

export function clearProfileUrlFromBar(): void {
  if (!parseProfileIdFromLocation()) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.toString();
  window.history.replaceState({}, '', `/${q ? `?${q}` : ''}`);
}
