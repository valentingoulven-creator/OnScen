import type Stripe from 'stripe';

/**
 * Types d'appoint pour des champs Stripe toujours présents dans les payloads
 * réels de l'API version pinnée ("2025-02-24.acacia", voir stripeClient.ts)
 * mais retirés des typings du SDK `stripe` depuis la v21/v22 — le SDK ne
 * génère désormais ses types que pour la dernière version d'API ("dahlia").
 *
 * Stripe garantit que les anciennes versions d'API pinnées continuent de
 * renvoyer exactement la même forme de payload indéfiniment ; ces types ne
 * font que combler l'écart entre ce payload réel et les typings du SDK.
 *
 * ⚠️ Ne pas réutiliser ces types si `STRIPE_API_VERSION` est un jour mis à
 * jour vers une version où ces champs ont réellement disparu du payload.
 */
export type InvoiceWithLegacyFields = Stripe.Invoice & {
  payment_intent?: string | Stripe.PaymentIntent | null;
  subscription?: string | Stripe.Subscription | null;
  application_fee_amount?: number | null;
};

export type SubscriptionWithLegacyPeriod = Stripe.Subscription & {
  current_period_end: number;
};
