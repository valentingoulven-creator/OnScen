import Stripe from 'stripe';

/**
 * Version d'API Stripe pinnée — volontairement PAS mise à jour lors du passage
 * du SDK `stripe` de v17 à v22 (voir MODIF migration Stripe). Le SDK ne type
 * désormais `Stripe.LatestApiVersion` que sur la toute dernière version
 * ("2026-06-24.dahlia" au moment de l'upgrade), mais Stripe garantit que les
 * anciennes versions d'API pinnées restent servies à l'identique indéfiniment
 * — c'est exactement le rôle de ce paramètre. On garde donc ce pin pour ne
 * changer AUCUN comportement runtime (formes de payload webhook, champs de
 * réponse) : seul le SDK (bugfixes, Node moderne, typings) est mis à jour.
 * Type volontairement large (`string`, pas `Stripe.LatestApiVersion`) pour ne
 * pas dépendre du literal type qui change à chaque major du SDK.
 */
export const STRIPE_API_VERSION: string = '2025-02-24.acacia';

let cachedClient: Stripe | null = null;
let cachedKey: string | null = null;

/** Factory unique pour toutes les instanciations du SDK Stripe côté backend. */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  });
  cachedKey = key;
  return cachedClient;
}
