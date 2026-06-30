const STRIPE_CONNECT_SKIP_KEY = 'soundy_stripe_connect_skipped';

/** Dev/msdev only — lancer un live sans Stripe Connect configuré. */
export function canBypassStripeConnect(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_APP_ENV === 'msdev';
}

export function isStripeConnectSkipped(): boolean {
  if (canBypassStripeConnect()) return true;
  try {
    return sessionStorage.getItem(STRIPE_CONNECT_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStripeConnectSkipped(): void {
  try {
    sessionStorage.setItem(STRIPE_CONNECT_SKIP_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function clearStripeConnectSkipped(): void {
  try {
    sessionStorage.removeItem(STRIPE_CONNECT_SKIP_KEY);
  } catch {
    // ignore
  }
}
