const PENDING_KEY = 'onscen_pending_profile_view';

function appBasePath(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === './' || base === '.') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function getProfilePath(userId: string): string {
  return `${appBasePath()}profile/${encodeURIComponent(userId)}`;
}

export function parseProfileIdFromLocation(loc: Location = window.location): string | null {
  const pathname = loc.pathname.replace(/\/+$/, '') || '/';
  const prefixed = pathname.match(/^\/tel\/profile\/([^/]+)$/i);
  if (prefixed) return decodeURIComponent(prefixed[1]);
  const bare = pathname.match(/^\/profile\/([^/]+)$/i);
  if (bare) return decodeURIComponent(bare[1]);
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

/** Garde tab / album / track dans l’URL profil (ex. nouveautés → compositions). */
export function syncProfileUrlInBar(
  userId: string,
  options?: { tab?: string; album?: string; track?: string }
): void {
  const path = getProfilePath(userId);
  const params = new URLSearchParams(window.location.search);
  if (options) {
    if (options.tab) params.set('tab', options.tab);
    else params.delete('tab');
    if (options.album) params.set('album', options.album);
    else params.delete('album');
    if (options.track) params.set('track', options.track);
    else params.delete('track');
  }
  const q = params.toString();
  const next = `${path}${q ? `?${q}` : ''}`;
  if (window.location.pathname === path && window.location.search === (q ? `?${q}` : '')) return;
  window.history.replaceState({}, '', next);
}

export function parseProfileTabFromLocation(loc: Location = window.location): string | null {
  return new URLSearchParams(loc.search).get('tab');
}

export function clearProfileUrlFromBar(): void {
  if (!parseProfileIdFromLocation()) return;
  const params = new URLSearchParams(window.location.search);
  const q = params.toString();
  window.history.replaceState({}, '', `${appBasePath()}${q ? `?${q}` : ''}`);
}
