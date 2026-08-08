import { db } from '../models/schema';
import type { Gift } from '../models/schema';
import { computeDonationPlatformFeeCents } from './donations';
import { getDonationsSummaryReport } from './donationsSummary';
import {
  getStripeReconciledMrrCents,
  getStripeReconciledPlatformMrrCents,
  getSubscriptionInvoicesPaidMonthCents,
  getSubscriptionPlatformFeesMonthCents,
} from './stripeSubscriptionLedger';

export interface MonetizationSummary {
  estimatedMrrCents: number;
  estimatedMrrCreatorCents: number;
  estimatedMrrPlatformCents: number;
  stripeMrrCents: number;
  simulationMrrCents: number;
  activeSubscriptions: number;
  activeCreatorSubscriptions: number;
  activePlatformSubscriptions: number;
  subscriptionsStripe: number;
  subscriptionsSimulation: number;
  tipsMonthCents: number;
  tipsAllTimeCents: number;
  tipsMonthStripeCents: number;
  tipsMonthSimulationCents: number;
  platformFeesMonthCents: number;
  platformFeesAllTimeCents: number;
  platformFeesMonthStripeCents: number;
  platformRevenueMonthEstimateCents: number;
  /** MRR OnScen+ Stripe + commissions pourboires Stripe du mois UTC. */
  platformRevenueMonthStripeCents: number;
  /** MRR Stripe reconstruit depuis la dernière invoice.paid par abo actif. */
  stripeReconciledMrrCents: number;
  stripeReconciledPlatformMrrCents: number;
  /** stripeReconciledMrrCents − stripeMrrCents (catalogue). */
  stripeMrrReconcileDeltaCents: number;
  /** Somme amount_paid des factures abo payées ce mois UTC. */
  subscriptionInvoicesPaidMonthCents: number;
  /** Somme application_fee des factures abo payées ce mois UTC. */
  subscriptionPlatformFeesMonthCents: number;
  platformFeePercent: number;
  donationsSimulationMode: boolean;
}

function startOfUtcMonth(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function isLiveDonationGift(gift: Gift): boolean {
  return gift.giftType === 'don' && Number.isFinite(gift.amount) && gift.amount > 0;
}

function platformFeeCentsForGift(gift: Gift): number {
  const amountCents = Math.trunc(gift.amount) * 100;
  if (gift.paymentIntentId) {
    const payment = db.donationPayments?.find(
      (p) => p.paymentIntentId === gift.paymentIntentId && p.status === 'succeeded'
    );
    if (payment?.platformFeeCents != null && payment.platformFeeCents >= 0) {
      return payment.platformFeeCents;
    }
  }
  return computeDonationPlatformFeeCents(amountCents);
}

function sumTipsAndFeesStripeMonth(sinceMs: number): {
  tipsStripe: number;
  feesStripe: number;
} {
  let tipsStripe = 0;
  let feesStripe = 0;
  for (const gift of db.gifts.filter(isLiveDonationGift)) {
    if (gift.timestamp < sinceMs) continue;
    if (gift.paymentMode !== 'stripe') continue;
    tipsStripe += Math.trunc(gift.amount) * 100;
    feesStripe += platformFeeCentsForGift(gift);
  }
  return { tipsStripe, feesStripe };
}

function sumTipsByMode(sinceMs: number): { stripe: number; simulation: number } {
  let stripe = 0;
  let simulation = 0;
  for (const gift of db.gifts.filter(isLiveDonationGift)) {
    if (gift.timestamp < sinceMs) continue;
    const cents = Math.trunc(gift.amount) * 100;
    if (gift.paymentMode === 'stripe') stripe += cents;
    else simulation += cents;
  }
  return { stripe, simulation };
}

/** Vue agrégée pour admin : abonnements actifs (MRR indicatif) + pourboires live. */
export function getMonetizationSummary(now = Date.now()): MonetizationSummary {
  const donations = getDonationsSummaryReport(now);
  const activeSubs = db.creatorSubscriptions.filter((s) => s.status === 'active');
  const monthStart = startOfUtcMonth(now);
  const tipsMonthByMode = sumTipsByMode(monthStart);
  const stripeMonth = sumTipsAndFeesStripeMonth(monthStart);

  let estimatedMrrCents = 0;
  let estimatedMrrCreatorCents = 0;
  let estimatedMrrPlatformCents = 0;
  let stripeMrrCents = 0;
  let simulationMrrCents = 0;
  let subscriptionsStripe = 0;
  let subscriptionsSimulation = 0;

  for (const sub of activeSubs) {
    estimatedMrrCents += sub.amountCents;
    if (sub.targetType === 'platform') estimatedMrrPlatformCents += sub.amountCents;
    else estimatedMrrCreatorCents += sub.amountCents;
    if (sub.paymentMode === 'stripe') {
      subscriptionsStripe += 1;
      stripeMrrCents += sub.amountCents;
    } else {
      subscriptionsSimulation += 1;
      simulationMrrCents += sub.amountCents;
    }
  }

  const platformFeesMonthStripeCents = stripeMonth.feesStripe;

  const platformRevenueMonthEstimateCents =
    donations.thisMonth.platformFeesCents + estimatedMrrPlatformCents;

  const platformRevenueMonthStripeCents =
    stripeMonth.feesStripe +
    (getStripeReconciledPlatformMrrCents() ||
      activeSubs
        .filter((s) => s.targetType === 'platform' && s.paymentMode === 'stripe')
        .reduce((a, s) => a + s.amountCents, 0));

  const stripeReconciledMrrCents = getStripeReconciledMrrCents();
  const stripeReconciledPlatformMrrCents = getStripeReconciledPlatformMrrCents();
  const subscriptionInvoicesPaidMonthCents = getSubscriptionInvoicesPaidMonthCents(monthStart);
  const subscriptionPlatformFeesMonthCents = getSubscriptionPlatformFeesMonthCents(monthStart);

  return {
    estimatedMrrCents,
    estimatedMrrCreatorCents,
    estimatedMrrPlatformCents,
    stripeMrrCents,
    simulationMrrCents,
    activeSubscriptions: activeSubs.length,
    activeCreatorSubscriptions: activeSubs.filter((s) => s.targetType === 'creator').length,
    activePlatformSubscriptions: activeSubs.filter((s) => s.targetType === 'platform').length,
    subscriptionsStripe,
    subscriptionsSimulation,
    tipsMonthCents: donations.thisMonth.totalDonationsCents,
    tipsAllTimeCents: donations.allTime.totalDonationsCents,
    tipsMonthStripeCents: tipsMonthByMode.stripe,
    tipsMonthSimulationCents: tipsMonthByMode.simulation,
    platformFeesMonthCents: donations.thisMonth.platformFeesCents,
    platformFeesAllTimeCents: donations.allTime.platformFeesCents,
    platformFeesMonthStripeCents,
    platformRevenueMonthEstimateCents,
    platformRevenueMonthStripeCents,
    stripeReconciledMrrCents,
    stripeReconciledPlatformMrrCents,
    stripeMrrReconcileDeltaCents: stripeReconciledMrrCents - stripeMrrCents,
    subscriptionInvoicesPaidMonthCents,
    subscriptionPlatformFeesMonthCents,
    platformFeePercent: donations.platformFeePercent,
    donationsSimulationMode: donations.simulationMode,
  };
}
