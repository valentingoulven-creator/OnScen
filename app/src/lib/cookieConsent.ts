const STORAGE_KEY = 'soundy_cookie_consent_v1';

export type CookieConsentChoice = 'all' | 'essential';

export function getCookieConsent(): CookieConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'all' || raw === 'essential') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function setCookieConsent(choice: CookieConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('soundy:cookie-consent', { detail: choice }));
}

/** Stripe, YouTube IFrame et autres services tiers nécessitent le consentement « tout accepter ». */
export function hasThirdPartyCookieConsent(): boolean {
  return getCookieConsent() === 'all';
}

export function resetCookieConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('soundy:cookie-consent-open'));
}

export const COOKIE_CONSENT_OPEN_EVENT = 'soundy:cookie-consent-open';

export function subscribeCookieConsent(listener: (choice: CookieConsentChoice) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentChoice>).detail;
    if (detail === 'all' || detail === 'essential') listener(detail);
  };
  window.addEventListener('soundy:cookie-consent', handler);
  return () => window.removeEventListener('soundy:cookie-consent', handler);
}
