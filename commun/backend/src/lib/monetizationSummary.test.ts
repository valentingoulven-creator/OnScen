import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import { getMonetizationSummary } from './monetizationSummary';

describe('getMonetizationSummary', () => {
  beforeEach(() => {
    db.creatorSubscriptions.length = 0;
    db.gifts.length = 0;
  });

  it('sums active subscription MRR', () => {
    db.creatorSubscriptions.push({
      id: 'sub1',
      subscriberId: 'u1',
      creatorId: 'platform',
      tierId: 'plus',
      tierLabel: 'OnScen+',
      amountCents: 999,
      targetType: 'platform',
      status: 'active',
      paymentMode: 'simulation',
      currentPeriodEnd: Date.now() + 86_400_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const summary = getMonetizationSummary();
    expect(summary.estimatedMrrCents).toBe(999);
    expect(summary.estimatedMrrPlatformCents).toBe(999);
  });
});
