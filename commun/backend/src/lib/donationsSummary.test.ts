import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../models/schema';
import { getDonationsSummaryReport } from './donationsSummary';
import { recordLiveDonation } from './donations';

describe('getDonationsSummaryReport', () => {
  const envBackup = { ...process.env };
  const now = Date.UTC(2026, 5, 15, 12, 0, 0);

  beforeEach(() => {
    process.env = { ...envBackup, APP_ENV: 'msdev' };
    db.gifts.length = 0;
    db.donationPayments.length = 0;
    db.lives.clear();
    db.users.clear();

    db.users.set('host1', {
      id: 'host1',
      username: 'host',
      email: 'host@test.com',
      age: 25,
    } as (typeof db.users extends Map<string, infer U> ? U : never));
    db.users.set('fan1', {
      id: 'fan1',
      username: 'fan',
      email: 'fan@test.com',
      age: 20,
    } as (typeof db.users extends Map<string, infer U> ? U : never));

    db.lives.set('live1', {
      id: 'live1',
      hostId: 'host1',
      title: 'Test live',
      isActive: true,
    } as (typeof db.lives extends Map<string, infer U> ? U : never));
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('agrège simulation msdev (commission par défaut 50 %) et stripe (fee enregistré)', () => {
    recordLiveDonation({
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'fan',
      amount: 5,
      paymentMode: 'simulation',
    });

    db.gifts.push({
      id: 'gift_stripe',
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'fan',
      giftType: 'don',
      amount: 10,
      timestamp: now,
      paymentMode: 'stripe',
      paymentIntentId: 'pi_test',
    });
    db.donationPayments.push({
      id: 'dp1',
      paymentIntentId: 'pi_test',
      liveId: 'live1',
      senderId: 'fan1',
      hostId: 'host1',
      amountCents: 1000,
      platformFeeCents: 300,
      status: 'succeeded',
      createdAt: now,
    });

    const report = getDonationsSummaryReport(now);

    expect(report.allTime.count).toBe(2);
    expect(report.allTime.totalDonationsCents).toBe(1500);
    // Simulation (5 €) utilise le défaut courant 50 % => 250 c. Stripe (10 €) garde son fee enregistré (300 c).
    expect(report.allTime.platformFeesCents).toBe(550);
    expect(report.allTime.creatorPayoutsCents).toBe(950);
    expect(report.allTime.simulationCount).toBe(1);
    expect(report.allTime.stripeCount).toBe(1);
    expect(report.simulationMode).toBe(true);
  });

  it('sépare all time et mois en cours', () => {
    db.gifts.push(
      {
        id: 'old',
        liveId: 'live1',
        senderId: 'fan1',
        senderName: 'fan',
        giftType: 'don',
        amount: 2,
        timestamp: Date.UTC(2026, 3, 1),
        paymentMode: 'simulation',
      },
      {
        id: 'current',
        liveId: 'live1',
        senderId: 'fan1',
        senderName: 'fan',
        giftType: 'don',
        amount: 5,
        timestamp: now,
        paymentMode: 'simulation',
      }
    );

    const report = getDonationsSummaryReport(now);

    expect(report.allTime.count).toBe(2);
    expect(report.allTime.totalDonationsCents).toBe(700);
    expect(report.thisMonth.count).toBe(1);
    expect(report.thisMonth.totalDonationsCents).toBe(500);
  });

  it('ignore les cadeaux non-don', () => {
    db.gifts.push({
      id: 'heart',
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'fan',
      giftType: 'heart',
      amount: 0,
      timestamp: now,
    });

    const report = getDonationsSummaryReport(now);
    expect(report.allTime.count).toBe(0);
  });
});
