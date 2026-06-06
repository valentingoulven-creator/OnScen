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
