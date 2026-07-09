import { getDonationPlatformFeePercent } from '../config/donationLegal';
import { isDonationSimulationMode, isStripeConfigured } from './donations';
import { getStripeClient } from './stripeClient';
import { getStripeKeyMode, type StripeKeyMode } from './stripeConfig';

export interface StripePlatformStatusReport {
  fetchedAt: string;
  stripeConfigured: boolean;
  simulationMode: boolean;
  keyMode: StripeKeyMode;
  platformFeePercent: number;
  connected: boolean;
  accountId: string | null;
  businessName: string | null;
  email: string | null;
  country: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  availableBalanceEur: number | null;
  pendingBalanceEur: number | null;
  dashboardUrl: string;
  applicationFeesUrl: string;
  setupHint: string | null;
  error: string | null;
}

function stripeDashboardBase(keyMode: StripeKeyMode): string {
  return keyMode === 'test' ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com';
}

function sumEurCents(
  entries: Array<{ amount: number; currency: string }> | undefined
): number | null {
  if (!entries?.length) return null;
  const eur = entries.filter((e) => e.currency === 'eur');
  if (!eur.length) return null;
  return eur.reduce((sum, e) => sum + e.amount, 0);
}

export async function getStripePlatformStatusReport(): Promise<StripePlatformStatusReport> {
  const keyMode = getStripeKeyMode();
  const dashboardBase = stripeDashboardBase(keyMode);
  const base: StripePlatformStatusReport = {
    fetchedAt: new Date().toISOString(),
    stripeConfigured: isStripeConfigured(),
    simulationMode: isDonationSimulationMode(),
    keyMode,
    platformFeePercent: getDonationPlatformFeePercent(),
    connected: false,
    accountId: null,
    businessName: null,
    email: null,
    country: null,
    chargesEnabled: null,
    payoutsEnabled: null,
    detailsSubmitted: null,
    availableBalanceEur: null,
    pendingBalanceEur: null,
    dashboardUrl: dashboardBase,
    applicationFeesUrl: `${dashboardBase}/connect/application_fees`,
    setupHint: null,
    error: null,
  };

  if (!isStripeConfigured()) {
    base.setupHint = 'missing_keys';
    return base;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    base.setupHint = 'missing_keys';
    return base;
  }

  try {
    // stripe-node v22 : l'ancien `retrieve()` sans argument (compte du propriétaire
    // de la clé API) est remplacé par `retrieveCurrent()` — comportement identique.
    const account = await stripe.accounts.retrieveCurrent();
    base.connected = true;
    base.accountId = account.id;
    base.businessName = account.business_profile?.name?.trim() || account.settings?.dashboard?.display_name?.trim() || null;
    base.email = account.email ?? null;
    base.country = account.country ?? null;
    base.chargesEnabled = account.charges_enabled ?? null;
    base.payoutsEnabled = account.payouts_enabled ?? null;
    base.detailsSubmitted = account.details_submitted ?? null;

    if (!base.payoutsEnabled) {
      base.setupHint = 'payouts_pending';
    }

    try {
      const balance = await stripe.balance.retrieve();
      const availableCents = sumEurCents(balance.available);
      const pendingCents = sumEurCents(balance.pending);
      if (availableCents != null) base.availableBalanceEur = availableCents / 100;
      if (pendingCents != null) base.pendingBalanceEur = pendingCents / 100;
    } catch {
      // Balance optionnelle — ne pas bloquer le statut compte
    }
  } catch (e) {
    base.error = e instanceof Error ? e.message : 'Erreur Stripe';
    base.setupHint = 'api_error';
  }

  return base;
}
