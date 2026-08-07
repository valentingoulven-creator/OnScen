import type { InvoiceWithLegacyFields } from './stripeLegacyTypes';
import { db } from '../models/schema';

export interface StripeSubInvoiceSnapshot {
  stripeSubscriptionId: string;
  invoiceId: string;
  paidAt: number;
  amountPaidCents: number;
  applicationFeeCents: number;
  monthlyMrrCents: number;
}

const latestBySubscription = new Map<string, StripeSubInvoiceSnapshot>();
/** Clé YYYY-MM → somme amount_paid des factures abonnement. */
const invoicePaidByMonth = new Map<string, number>();
/** Clé YYYY-MM → somme application_fee des factures abonnement. */
const platformFeeByMonth = new Map<string, number>();

function monthKeyFromTs(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

/** Normalise amount_paid en MRR mensuel à partir des lignes facture Stripe. */
export function normalizeInvoiceToMonthlyMrrCents(invoice: InvoiceWithLegacyFields): number {
  const paid = invoice.amount_paid ?? 0;
  if (paid <= 0) return 0;

  const line = invoice.lines?.data?.[0] as
    | {
        price?: { recurring?: { interval?: string; interval_count?: number } };
        plan?: { interval?: string; interval_count?: number };
      }
    | undefined;
  const recurring = line?.price?.recurring;
  const interval = recurring?.interval ?? line?.plan?.interval;
  const intervalCount = recurring?.interval_count ?? line?.plan?.interval_count ?? 1;

  if (interval === 'year') return Math.round(paid / (12 * Math.max(1, intervalCount)));
  if (interval === 'week') return Math.round((paid * 52) / (12 * Math.max(1, intervalCount)));
  if (interval === 'day') return Math.round((paid * 365) / (12 * Math.max(1, intervalCount)));
  return Math.round(paid / Math.max(1, intervalCount));
}

export function recordStripeSubscriptionInvoicePaid(
  invoice: InvoiceWithLegacyFields,
  stripeSubscriptionId: string
): boolean {
  const prev = latestBySubscription.get(stripeSubscriptionId);
  if (prev?.invoiceId === invoice.id) return false;

  const paidAt =
    (invoice.status_transitions?.paid_at ?? invoice.created ?? Math.floor(Date.now() / 1000)) * 1000;
  const amountPaidCents = invoice.amount_paid ?? 0;
  const applicationFeeCents = invoice.application_fee_amount ?? 0;
  const monthlyMrrCents = normalizeInvoiceToMonthlyMrrCents(invoice);

  latestBySubscription.set(stripeSubscriptionId, {
    stripeSubscriptionId,
    invoiceId: invoice.id,
    paidAt,
    amountPaidCents,
    applicationFeeCents,
    monthlyMrrCents,
  });

  const monthKey = monthKeyFromTs(paidAt);
  invoicePaidByMonth.set(monthKey, (invoicePaidByMonth.get(monthKey) ?? 0) + amountPaidCents);
  platformFeeByMonth.set(
    monthKey,
    (platformFeeByMonth.get(monthKey) ?? 0) + applicationFeeCents
  );
  return true;
}

/** MRR Stripe reconstruit depuis la dernière facture payée par abo actif. */
export function getStripeReconciledMrrCents(): number {
  let total = 0;
  for (const sub of db.creatorSubscriptions) {
    if (sub.status !== 'active' || sub.paymentMode !== 'stripe' || !sub.stripeSubscriptionId) continue;
    const snap = latestBySubscription.get(sub.stripeSubscriptionId);
    if (snap) total += snap.monthlyMrrCents;
  }
  return total;
}

export function getStripeReconciledPlatformMrrCents(): number {
  let total = 0;
  for (const sub of db.creatorSubscriptions) {
    if (
      sub.status !== 'active' ||
      sub.paymentMode !== 'stripe' ||
      sub.targetType !== 'platform' ||
      !sub.stripeSubscriptionId
    ) {
      continue;
    }
    const snap = latestBySubscription.get(sub.stripeSubscriptionId);
    if (snap) total += snap.monthlyMrrCents;
  }
  return total;
}

export function getSubscriptionInvoicesPaidMonthCents(monthStartMs: number): number {
  return invoicePaidByMonth.get(monthKeyFromTs(monthStartMs)) ?? 0;
}

export function getSubscriptionPlatformFeesMonthCents(monthStartMs: number): number {
  return platformFeeByMonth.get(monthKeyFromTs(monthStartMs)) ?? 0;
}

export function snapshotStripeSubscriptionLedger(): {
  latestBySubscription: Record<string, StripeSubInvoiceSnapshot>;
  invoicePaidByMonth: Record<string, number>;
  platformFeeByMonth: Record<string, number>;
} {
  return {
    latestBySubscription: Object.fromEntries(latestBySubscription.entries()),
    invoicePaidByMonth: Object.fromEntries(invoicePaidByMonth.entries()),
    platformFeeByMonth: Object.fromEntries(platformFeeByMonth.entries()),
  };
}

export function restoreStripeSubscriptionLedger(data: {
  latestBySubscription?: Record<string, StripeSubInvoiceSnapshot>;
  invoicePaidByMonth?: Record<string, number>;
  platformFeeByMonth?: Record<string, number>;
} | undefined): void {
  latestBySubscription.clear();
  invoicePaidByMonth.clear();
  platformFeeByMonth.clear();
  if (!data) return;
  for (const [k, v] of Object.entries(data.latestBySubscription ?? {})) {
    if (v?.stripeSubscriptionId) latestBySubscription.set(k, v);
  }
  for (const [k, v] of Object.entries(data.invoicePaidByMonth ?? {})) {
    if (typeof v === 'number') invoicePaidByMonth.set(k, v);
  }
  for (const [k, v] of Object.entries(data.platformFeeByMonth ?? {})) {
    if (typeof v === 'number') platformFeeByMonth.set(k, v);
  }
}

export function stripeLedgerSnapshotCount(): number {
  return latestBySubscription.size;
}
