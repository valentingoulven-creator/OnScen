import Stripe from 'stripe';

/**
 * Version d'API Stripe pinnée — doit rester alignée avec la version du SDK
 * `stripe` installée (voir `commun/backend/package.json`). Évite qu'un
 * changement de version par défaut côté Dashboard Stripe ne modifie
 * silencieusement le comportement de l'intégration.
 */
export const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

let cachedClient: Stripe | null = null;
let cachedKey: string | null = null;

/** Factory unique pour toutes les instanciations du SDK Stripe côté backend. */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  cachedKey = key;
  return cachedClient;
}
