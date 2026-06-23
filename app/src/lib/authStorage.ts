/**
 * Auth token storage — platform-aware.
 *
 * WEB (browser):
 *   JWT is stored in an httpOnly Secure SameSite=Strict cookie set by the backend.
 *   JavaScript has no access to the cookie value, so get/persist are no-ops here.
 *   Authentication state is derived from GET /api/auth/me (cookie sent automatically).
 *   Logout calls POST /api/auth/logout to clear the server-side cookie.
 *
 *   CSRF mitigation: SameSite=Strict prevents the cookie from being sent on any
 *   cross-site request (form submissions, cross-origin XHR/fetch). No CSRF token
 *   is required as long as SameSite=Strict is enforced. Reviewed 2026-06-21.
 *
 * NATIVE (Capacitor / apptel):
 *   Cookies are not reliably shared in native WebViews for cross-origin calls, so
 *   the JWT is kept in secure native storage (Keychain / Keystore) via apptel override.
 *   The backend auth middleware accepts both the httpOnly cookie AND the X-Auth-Token
 *   header, so native clients continue to work unchanged.
 */

const TOKEN_KEY = 'melosong_token';
const REMEMBER_KEY = 'melosong_remember_me';

/** True when running inside a Capacitor native wrapper (iOS / Android). */
function isNativePlatform(): boolean {
  try {
    return !!(
      (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform?.()
    );
  } catch {
    return false;
  }
}

/**
 * Returns the stored JWT token.
 *   - Native: reads from sessionStorage / localStorage.
 *   - Web: always returns null (token lives in httpOnly cookie, inaccessible to JS).
 */
export function getStoredToken(): string | null {
  if (!isNativePlatform()) return null;

  const session = sessionStorage.getItem(TOKEN_KEY);
  if (session) return session;

  const remember = localStorage.getItem(REMEMBER_KEY);
  const local = localStorage.getItem(TOKEN_KEY);
  if (!local) return null;
  if (remember === '1' || remember === null) return local;
  return null;
}

/**
 * Persists the JWT token.
 *   - Native: stores in sessionStorage (session) or localStorage (rememberMe).
 *   - Web: no-op (backend sets the httpOnly cookie directly).
 */
export function persistToken(token: string, rememberMe: boolean): void {
  if (!isNativePlatform()) return;

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);

  if (rememberMe) {
    localStorage.setItem(REMEMBER_KEY, '1');
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.setItem(REMEMBER_KEY, '0');
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Clears the stored JWT token.
 *   - Native: removes from sessionStorage / localStorage.
 *   - Web: no-op (cookie is cleared by POST /api/auth/logout on the backend).
 */
export function clearStoredToken(): void {
  if (!isNativePlatform()) return;

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

/** No-op on web; apptel override loads secure storage on native. */
export async function initAuthStorage(): Promise<string | null> {
  return null;
}

/** Exposed for use in AuthContext to determine whether to attempt a cookie-based boot. */
export { isNativePlatform };
