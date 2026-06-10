export const DONATION_MIN_AGE = 18;

export interface DonationsConfig {
  enabled: boolean;
  simulation: boolean;
  stripeConfigured: boolean;
  publishableKey: string | null;
  tiers: number[];
  minAmount: number;
  maxAmount: number;
  currency: string;
  minAge: number;
  dailyCapRemaining: number | null;
}

export function userCanDonateByAge(age: number | undefined, ageConfirmed: boolean): boolean {
  if (typeof age === 'number' && age >= DONATION_MIN_AGE) return true;
  return ageConfirmed;
}

export const DONATION_LEGAL_NOTICE =
  'Les montants versés sont des pourboires volontaires au créateur du live (hôte), et non des dons associatifs ouvrant droit à reçu fiscal. Paiement sécurisé par Stripe (DSP2 / authentification forte). Aucune donnée de carte n’est stockée sur nos serveurs.';

export const DONATION_STRIPE_TERMS_URL = 'https://stripe.com/fr/legal/consumer';
