export type StripeKeyMode = 'test' | 'live' | 'disabled';

/** Préfixe de clé uniquement — jamais la valeur. */
export function getStripeKeyMode(): StripeKeyMode {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!key) return 'disabled';
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  return 'disabled';
}
