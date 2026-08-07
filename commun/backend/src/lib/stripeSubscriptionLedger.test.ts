import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import {
  getStripeReconciledMrrCents,
  normalizeInvoiceToMonthlyMrrCents,
  recordStripeSubscriptionInvoicePaid,
  restoreStripeSubscriptionLedger,
} from './stripeSubscriptionLedger';
import type { InvoiceWithLegacyFields } from './stripeLegacyTypes';

function monthlyInvoice(id: string, amountPaid: number): InvoiceWithLegacyFields {
  return {
    id,
    amount_paid: amountPaid,
    application_fee_amount: 0,
    created: Math.floor(Date.now() / 1000),
    lines: {
      data: [
        {
          price: { recurring: { interval: 'month', interval_count: 1 } },
        },
      ],
    },
  } as InvoiceWithLegacyFields;
}

describe('stripeSubscriptionLedger', () => {
  beforeEach(() => {
    restoreStripeSubscriptionLedger(undefined);
    db.creatorSubscriptions.length = 0;
  });

  it('normalizes yearly invoice to monthly MRR', () => {
    const inv = {
      amount_paid: 12000,
      lines: { data: [{ price: { recurring: { interval: 'year', interval_count: 1 } } }] },
    } as InvoiceWithLegacyFields;
    expect(normalizeInvoiceToMonthlyMrrCents(inv)).toBe(1000);
  });

  it('aggregates reconciled MRR for active stripe subs', () => {
    db.creatorSubscriptions.push({
      id: 'sub1',
      subscriberId: 'u1',
      creatorId: 'c1',
      tierId: 't1',
      tierLabel: 'Tier',
      amountCents: 500,
      targetType: 'creator',
      status: 'active',
      paymentMode: 'stripe',
      stripeSubscriptionId: 'sub_stripe_1',
      currentPeriodEnd: Date.now() + 86_400_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    recordStripeSubscriptionInvoicePaid(monthlyInvoice('in_1', 999), 'sub_stripe_1');
    expect(getStripeReconciledMrrCents()).toBe(999);
  });

  it('ignores duplicate invoice id on webhook retry', () => {
    const inv = monthlyInvoice('in_dup', 800);
    expect(recordStripeSubscriptionInvoicePaid(inv, 'sub_x')).toBe(true);
    expect(recordStripeSubscriptionInvoicePaid(inv, 'sub_x')).toBe(false);
  });
});
