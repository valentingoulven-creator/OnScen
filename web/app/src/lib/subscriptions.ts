export const SUBSCRIPTION_MIN_AGE = 18;

export type SubscriptionTargetType = 'creator' | 'platform';

export type PlatformPlanId = 'free' | 'soundy_plus' | 'soundy_ultra';

export function canAccessArchivedLives(planId: string): boolean {
  return planId === 'soundy_plus' || planId === 'soundy_ultra';
}

export interface SubscriptionTierConfig {
  id: string;
  label: string;
  amountCents: number;
  amountEur: number;
  targetType: SubscriptionTargetType;
  stripeConfigured: boolean;
}

export interface SubscriptionsConfig {
  enabled: boolean;
  simulation: boolean;
  stripeConfigured: boolean;
  publishableKey: string | null;
  tiers: SubscriptionTierConfig[];
  currency: string;
  minAge: number;
  platformCommissionPercent: number;
  dailyCapRemaining: number | null;
  platformPlans?: PlatformPlanConfig[];
}

export interface PlatformPlanLimits {
  maxViewers: number | null;
  maxLiveMinutesPerDay: number | null;
  allowObs: boolean;
  allowLiveKit: boolean;
  allowCloudflare: boolean;
}

export interface PlatformPlanConfig {
  id: string;
  label: string;
  priceCents: number;
  priceDisplay: string;
  subscriptionTierId: string | null;
  limits: PlatformPlanLimits;
  featuresFr: string[];
}

export interface PlatformPlanStatusResponse {
  plan: PlatformPlanConfig;
  dailyLiveMinutesUsed: number;
  dailyLiveMinutesLimit: number | null;
  activePlatformSubscription: {
    tierId: string;
    tierLabel: string;
    currentPeriodEnd: number;
  } | null;
  plans: PlatformPlanConfig[];
}

export interface SubscriptionStatus {
  isSupporter: boolean;
  subscription: {
    id: string;
    tierId: string;
    tierLabel: string;
    currentPeriodEnd: number;
    status: string;
  } | null;
  subscriberCount?: number;
}

export function userCanSubscribeByAge(age: number | undefined, ageConfirmed: boolean): boolean {
  if (typeof age === 'number' && age >= SUBSCRIPTION_MIN_AGE) return true;
  return ageConfirmed;
}

export const SUBSCRIPTION_LEGAL_NOTICE =
  'Les abonnements sont des soutiens récurrents volontaires au créateur ou à Soundy (pas des dons associatifs ouvrant droit à reçu fiscal). Paiement sécurisé par Stripe Billing. Résiliation possible à tout moment ; aucune donnée de carte sur nos serveurs.';

export const SUBSCRIPTION_STRIPE_TERMS_URL = 'https://stripe.com/fr/legal/consumer';

export function formatTierPrice(amountEur: number): string {
  return `${amountEur.toFixed(2).replace('.', ',')} €/mois`;
}
