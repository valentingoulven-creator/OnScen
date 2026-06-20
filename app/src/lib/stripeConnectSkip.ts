const STRIPE_CONNECT_SKIP_KEY = 'soundy_stripe_connect_skipped';

export function isStripeConnectSkipped(): boolean {
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
