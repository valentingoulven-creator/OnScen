import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertCreatorCanReceiveDonation,
  assertDonAmount,
  DON_AMOUNT_MAX,
  DON_AMOUNT_MIN,
  getUserDailyDonationTotal,
  isDonationSimulationMode,
  isDonationsEnabled,
  isValidDonAmount,
  recordLiveDonation,
  userMeetsDonationAge,
} from './donations';
import { db } from '../models/schema';

describe('donations validation', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.DONATIONS_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.APP_ENV;
    delete process.env.MSENV;
    db.gifts.length = 0;
    db.lives.clear();
    db.users.clear();
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('accepte les montants entiers dans la plage légale', () => {
    expect(isValidDonAmount(DON_AMOUNT_MIN)).toBe(true);
    expect(isValidDonAmount(DON_AMOUNT_MAX)).toBe(true);
    expect(isValidDonAmount(50)).toBe(true);
  });

  it('refuse montants hors plage ou non entiers', () => {
    expect(isValidDonAmount(0)).toBe(false);
    expect(isValidDonAmount(DON_AMOUNT_MAX + 1)).toBe(false);
    expect(isValidDonAmount(2.5)).toBe(false);
    expect(isValidDonAmount(NaN)).toBe(false);
  });

  it('assertDonAmount lève une erreur explicite', () => {
    expect(() => assertDonAmount(0)).toThrow(/Montant invalide/);
    expect(() => assertDonAmount(101)).toThrow(/Montant invalide/);
  });

  it('exige 18 ans minimum pour les dons', () => {
    expect(userMeetsDonationAge(17)).toBe(false);
    expect(userMeetsDonationAge(18)).toBe(true);
    expect(userMeetsDonationAge(undefined)).toBe(false);
  });

  it('active la simulation en msdev', () => {
    process.env.MSENV = 'msdev';
    expect(isDonationSimulationMode()).toBe(true);
    expect(isDonationsEnabled()).toBe(true);
  });

  it('désactive les dons prod sans Stripe', () => {
    process.env.DONATIONS_ENABLED = '1';
    expect(isDonationsEnabled()).toBe(false);
  });

  it('active les dons prod avec Stripe et flag', () => {
    process.env.DONATIONS_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    expect(isDonationsEnabled()).toBe(true);
    expect(isDonationSimulationMode()).toBe(false);
  });

  it('refuse les dons vers un hôte de moins de 18 ans', () => {
    db.users.set('minor_host', {
      id: 'minor_host',
      username: 'TeenDJ',
      email: 'teen@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      age: 17,
    });
    db.lives.set('live_minor', {
      id: 'live_minor',
      hostId: 'minor_host',
      hostName: 'TeenDJ',
      title: 'Live test',
      platform: 'spotify',
      playbackState: {
        platform: 'spotify',
        trackId: 't1',
        title: 'Track',
        artist: 'Artist',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
      },
      latitude: 48.85,
      longitude: 2.35,
      blurredLatitude: 48.85,
      blurredLongitude: 2.35,
      viewersCount: 0,
      isActive: true,
      startedAt: Date.now(),
      vipModeratorIds: [],
    });
    expect(() => assertCreatorCanReceiveDonation('minor_host')).toThrow(/monétisation disponible à partir de 18 ans/i);
    expect(() =>
      recordLiveDonation({
        liveId: 'live_minor',
        senderId: 'fan1',
        senderName: 'Fan',
        amount: 2,
        paymentMode: 'simulation',
      })
    ).toThrow(/monétisation disponible à partir de 18 ans/i);
  });

  it('calcule le total journalier simulation', () => {
    const dayStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    db.gifts.push(
      {
        id: 'g1',
        liveId: 'live1',
        senderId: 'u1',
        senderName: 'Alice',
        giftType: 'don',
        amount: 2,
        timestamp: dayStart + 1000,
        paymentMode: 'simulation',
      },
      {
        id: 'g2',
        liveId: 'live1',
        senderId: 'u1',
        senderName: 'Alice',
        giftType: 'don',
        amount: 5,
        timestamp: dayStart + 2000,
        paymentMode: 'simulation',
      },
      {
        id: 'g3',
        liveId: 'live1',
        senderId: 'u2',
        senderName: 'Bob',
        giftType: 'don',
        amount: 10,
        timestamp: dayStart + 3000,
        paymentMode: 'simulation',
      }
    );
    expect(getUserDailyDonationTotal('u1')).toBe(7);
    expect(getUserDailyDonationTotal('u2')).toBe(10);
  });
});
