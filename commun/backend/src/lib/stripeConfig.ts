/** Stripe key mode — no secret values exposed. */
export type StripeKeyMode = 'live' | 'test' | 'unknown';

export function getStripeKeyMode(): StripeKeyMode {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

export function isStripeLiveMode(): boolean {
  return getStripeKeyMode() === 'live';
}

export function isStripeTestMode(): boolean {
  return getStripeKeyMode() === 'test';
}
