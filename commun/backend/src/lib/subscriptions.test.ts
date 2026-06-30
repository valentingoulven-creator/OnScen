import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertCreatorCanReceiveSubscription,
  getActiveSubscription,
  getCreatorSubscriberCount,
  getSubscriptionTiers,
  getTierById,
  isSubscriptionSimulationMode,
  isSubscriptionsEnabled,
  isSupporter,
  recordCreatorSubscription,
  resolveCreatorId,
  userMeetsSubscriptionAge,
  PLATFORM_CREATOR_ID,
} from './subscriptions';
import { db } from '../models/schema';

describe('subscriptions validation', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.SUBSCRIPTIONS_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.APP_ENV;
    delete process.env.MSENV;
    db.creatorSubscriptions.length = 0;
    db.users.clear();
    db.users.set('creator1', {
      id: 'creator1',
      username: 'DJ',
      email: 'dj@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      age: 20,
    });
    db.users.set('fan1', {
      id: 'fan1',
      username: 'Fan',
      email: 'fan@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
    });
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('expose les paliers par défaut (4,99 € et 9,99 €)', () => {
    const creatorTiers = getSubscriptionTiers().filter((t) => t.targetType === 'creator');
    expect(creatorTiers).toHaveLength(2);
    expect(creatorTiers[0]?.amountCents).toBe(499);
    expect(creatorTiers[1]?.amountCents).toBe(999);
  });

  it('résout le créateur plateforme pour Soundy+', () => {
    expect(resolveCreatorId('platform')).toBe(PLATFORM_CREATOR_ID);
    expect(resolveCreatorId('creator', 'abc')).toBe('abc');
    expect(() => resolveCreatorId('creator')).toThrow(/Créateur requis/);
  });

  it('exige 18 ans minimum', () => {
    expect(userMeetsSubscriptionAge(17)).toBe(false);
    expect(userMeetsSubscriptionAge(18)).toBe(true);
  });

  it('active la simulation en msdev', () => {
    process.env.MSENV = 'msdev';
    expect(isSubscriptionSimulationMode()).toBe(true);
    expect(isSubscriptionsEnabled()).toBe(true);
  });

  it('désactive les abos prod sans Stripe', () => {
    process.env.SUBSCRIPTIONS_ENABLED = '1';
    expect(isSubscriptionsEnabled()).toBe(false);
  });

  it('active les abos prod avec Stripe et flag', () => {
    process.env.SUBSCRIPTIONS_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    expect(isSubscriptionsEnabled()).toBe(true);
    expect(isSubscriptionSimulationMode()).toBe(false);
  });

  it('refuse les abonnements vers un créateur de moins de 18 ans', () => {
    db.users.set('minor_creator', {
      id: 'minor_creator',
      username: 'Young',
      email: 'young@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      age: 16,
    });
    expect(() => assertCreatorCanReceiveSubscription('minor_creator')).toThrow(
      /monétisation disponible à partir de 18 ans/i
    );
    const tier = getTierById('tier1', 'creator');
    expect(() =>
      recordCreatorSubscription({
        subscriberId: 'fan1',
        creatorId: 'minor_creator',
        tierId: tier!.id,
        tierLabel: tier!.label,
        amountCents: tier!.amountCents,
        targetType: 'creator',
        paymentMode: 'simulation',
      })
    ).toThrow(/monétisation disponible à partir de 18 ans/i);
  });

  it('enregistre et détecte un abonnement actif', () => {
    const tier = getTierById('tier1', 'creator');
    expect(tier).not.toBeNull();
    recordCreatorSubscription({
      subscriberId: 'fan1',
      creatorId: 'creator1',
      tierId: tier!.id,
      tierLabel: tier!.label,
      amountCents: tier!.amountCents,
      targetType: 'creator',
      paymentMode: 'simulation',
    });
    expect(isSupporter('fan1', 'creator1')).toBe(true);
    expect(getCreatorSubscriberCount('creator1')).toBe(1);
    expect(getActiveSubscription('fan1', 'creator1')?.tierId).toBe('tier1');
  });
});
