// MIGRATION TODO (CRIT-01): Les tokens JWT sont actuellement stockés dans
// localStorage/sessionStorage (vulnérables aux attaques XSS).
// La migration vers des cookies httpOnly/Secure/SameSite=Strict nécessite :
//   1. Backend : endpoint POST /api/auth/cookie-login qui pose un cookie httpOnly
//   2. Backend : middleware qui lit le cookie au lieu du header Authorization
//   3. Frontend : supprimer authStorage + adapter tous les appels API
//   4. Backend : endpoint POST /api/auth/logout qui efface le cookie
// Cette refactorisation nécessite une coordination backend+frontend dédiée.
// Durée token rememberMe réduite de 30j à 7j (paliatif, voir ELEV-02 backend).

const TOKEN_KEY = 'melosong_token';
const REMEMBER_KEY = 'melosong_remember_me';

/** Jeton au démarrage : sessionStorage prioritaire, sinon localStorage si « rester connecté » ou jeton legacy. */
export function getStoredToken(): string | null {
  const session = sessionStorage.getItem(TOKEN_KEY);
  if (session) return session;

  const remember = localStorage.getItem(REMEMBER_KEY);
  const local = localStorage.getItem(TOKEN_KEY);
  if (!local) return null;
  if (remember === '1' || remember === null) return local;
  return null;
}

export function persistToken(token: string, rememberMe: boolean): void {
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

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}
