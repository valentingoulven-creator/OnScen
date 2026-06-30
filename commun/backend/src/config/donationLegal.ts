/** Commission plateforme sur les pourboires live (hors abonnements). */
export const DEFAULT_DONATION_PLATFORM_FEE_PERCENT = 30;

export const DONATION_STRIPE_TERMS_URL = 'https://stripe.com/fr/legal/consumer';

/** Clé du document légal affiché dans l'app (creatorMonetization / donations). */
export const DONATION_PAYMENT_TERMS_DOC_KEY = 'creatorMonetization';

/** Préfixe i18n frontend pour les mentions légales du flux don. */
export const DONATION_LEGAL_I18N_PREFIX = 'donation.legal';

export const DONATION_LEGAL_I18N_KEYS = {
  nature: `${DONATION_LEGAL_I18N_PREFIX}.nature`,
  platformFee: `${DONATION_LEGAL_I18N_PREFIX}.platformFee`,
  creatorIncome: `${DONATION_LEGAL_I18N_PREFIX}.creatorIncome`,
  refund: `${DONATION_LEGAL_I18N_PREFIX}.refund`,
  rgpd: `${DONATION_LEGAL_I18N_PREFIX}.rgpd`,
  acceptCheckbox: `${DONATION_LEGAL_I18N_PREFIX}.acceptCheckbox`,
  paymentTermsLink: `${DONATION_LEGAL_I18N_PREFIX}.paymentTermsLink`,
  stripeTermsLink: `${DONATION_LEGAL_I18N_PREFIX}.stripeTermsLink`,
  breakdownTitle: `${DONATION_LEGAL_I18N_PREFIX}.breakdownTitle`,
  breakdownAmount: `${DONATION_LEGAL_I18N_PREFIX}.breakdownAmount`,
  breakdownPlatformFee: `${DONATION_LEGAL_I18N_PREFIX}.breakdownPlatformFee`,
  breakdownCreatorNet: `${DONATION_LEGAL_I18N_PREFIX}.breakdownCreatorNet`,
  breakdownStripeNote: `${DONATION_LEGAL_I18N_PREFIX}.breakdownStripeNote`,
} as const;

export function getDonationPlatformFeePercent(): number {
  const raw = process.env.DONATION_PLATFORM_FEE_PERCENT?.trim();
  if (!raw) return DEFAULT_DONATION_PLATFORM_FEE_PERCENT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_DONATION_PLATFORM_FEE_PERCENT;
  return n;
}

export interface DonationFeeBreakdown {
  amountEur: number;
  platformFeePercent: number;
  platformFeeEur: number;
  creatorNetEstimateEur: number;
}

/** Répartition affichée avant paiement (montants en euros, 2 décimales). */
export function computeDonationFeeBreakdown(
  amountEur: number,
  feePercent = getDonationPlatformFeePercent()
): DonationFeeBreakdown {
  const amount = Math.max(0, Math.round(amountEur * 100) / 100);
  const platformFeeEur = Math.round(amount * feePercent) / 100;
  const creatorNetEstimateEur = Math.round((amount - platformFeeEur) * 100) / 100;
  return {
    amountEur: amount,
    platformFeePercent: feePercent,
    platformFeeEur,
    creatorNetEstimateEur,
  };
}

/** Montant commission plateforme en centimes pour Stripe Connect `application_fee_amount`. */
export function computeDonationPlatformFeeCents(
  amountCents: number,
  feePercent = getDonationPlatformFeePercent()
): number {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 0;
  return Math.round((amountCents * feePercent) / 100);
}

export function getDonationLegalConfig() {
  return {
    platformFeePercent: getDonationPlatformFeePercent(),
    stripeTermsUrl: DONATION_STRIPE_TERMS_URL,
    paymentTermsDocKey: DONATION_PAYMENT_TERMS_DOC_KEY,
    i18nKeys: DONATION_LEGAL_I18N_KEYS,
  };
}
