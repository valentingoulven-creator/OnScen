import type { Gift } from '../models/schema';
import { db } from '../models/schema';
import {
  computeDonationPlatformFeeCents,
  getDonationPlatformFeePercent,
  isDonationSimulationMode,
} from './donations';
import { DONATION_PAYMENT_TERMS_DOC_KEY } from '../config/donationLegal';

export interface DonationsSummaryPeriod {
  totalDonationsCents: number;
  platformFeesCents: number;
  creatorPayoutsCents: number;
  count: number;
  simulationCount: number;
  stripeCount: number;
}

export interface DonationsSummaryReport {
  fetchedAt: string;
  platformFeePercent: number;
  paymentTermsDocKey: string;
  simulationMode: boolean;
  allTime: DonationsSummaryPeriod;
  thisMonth: DonationsSummaryPeriod;
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

function aggregatePeriod(gifts: Gift[]): DonationsSummaryPeriod {
  let totalDonationsCents = 0;
  let platformFeesCents = 0;
  let simulationCount = 0;
  let stripeCount = 0;

  for (const gift of gifts) {
    const amountCents = Math.trunc(gift.amount) * 100;
    totalDonationsCents += amountCents;
    platformFeesCents += platformFeeCentsForGift(gift);
    if (gift.paymentMode === 'simulation') simulationCount += 1;
    else if (gift.paymentMode === 'stripe') stripeCount += 1;
    else simulationCount += 1;
  }

  return {
    totalDonationsCents,
    platformFeesCents,
    creatorPayoutsCents: Math.max(0, totalDonationsCents - platformFeesCents),
    count: gifts.length,
    simulationCount,
    stripeCount,
  };
}

/** Agrège les pourboires live crédités (gifts `don`) — simulation msdev et Stripe confirmé. */
export function getDonationsSummaryReport(now = Date.now()): DonationsSummaryReport {
  const monthStart = startOfUtcMonth(now);
  const donationGifts = db.gifts.filter(isLiveDonationGift);
  const thisMonthGifts = donationGifts.filter((g) => g.timestamp >= monthStart);

  return {
    fetchedAt: new Date(now).toISOString(),
    platformFeePercent: getDonationPlatformFeePercent(),
    paymentTermsDocKey: DONATION_PAYMENT_TERMS_DOC_KEY,
    simulationMode: isDonationSimulationMode(),
    allTime: aggregatePeriod(donationGifts),
    thisMonth: aggregatePeriod(thisMonthGifts),
  };
}
