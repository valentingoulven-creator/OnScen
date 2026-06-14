export const DONATION_MIN_AGE = 18;

export interface DonationLegalConfig {
  platformFeePercent: number;
  stripeTermsUrl: string;
  paymentTermsDocKey: string;
  i18nKeys: Record<string, string>;
}

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
  platformFeePercent: number;
  legal?: DonationLegalConfig;
  dailyCapRemaining: number | null;
}

export interface DonationFeeBreakdown {
  amountEur: number;
  platformFeePercent: number;
  platformFeeEur: number;
  creatorNetEstimateEur: number;
}

export function userCanDonateByAge(age: number | undefined, ageConfirmed: boolean): boolean {
  if (typeof age === 'number' && age >= DONATION_MIN_AGE) return true;
  return ageConfirmed;
}

export function computeDonationFeeBreakdown(
  amountEur: number,
  platformFeePercent: number
): DonationFeeBreakdown {
  const amount = Math.max(0, Math.round(amountEur * 100) / 100);
  const platformFeeEur = Math.round(amount * platformFeePercent) / 100;
  const creatorNetEstimateEur = Math.round((amount - platformFeeEur) * 100) / 100;
  return {
    amountEur: amount,
    platformFeePercent,
    platformFeeEur,
    creatorNetEstimateEur,
  };
}

export const DONATION_STRIPE_TERMS_URL = 'https://stripe.com/fr/legal/consumer';

export const DONATION_PAYMENT_TERMS_DOC_KEY = 'creatorMonetization';
