import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../models/schema';
import { recordLiveDonation } from './donations';
import { getAdminDonationsHistory, mapGiftToAdminDonationEntry } from './donationsHistory';

describe('donationsHistory', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'msdev';
    db.gifts.length = 0;
    db.donationPayments.length = 0;
    db.lives.clear();
    db.users.clear();

    db.users.set('host1', {
      id: 'host1',
      username: 'DJ_Test',
      email: 'dj@test.local',
      passwordHash: 'x',
      birthDate: '1990-01-01',
    });
    db.users.set('fan1', {
      id: 'fan1',
      username: 'Fan_Test',
      email: 'fan@test.local',
      passwordHash: 'x',
      birthDate: '1995-01-01',
    });
    db.lives.set('live1', {
      id: 'live1',
      hostId: 'host1',
      title: 'Session test',
      isActive: true,
      viewersCount: 1,
      startedAt: Date.now(),
    });
  });

  it('mappe payeur, destinataire et montants', () => {
    const gift = recordLiveDonation({
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'Fan_Test',
      amount: 10,
      paymentMode: 'simulation',
    });

    const entry = mapGiftToAdminDonationEntry(gift);
    expect(entry).toMatchObject({
      senderName: 'Fan_Test',
      recipientName: 'DJ_Test',
      recipientId: 'host1',
      amountEur: 10,
      amountCents: 1000,
      platformFeeCents: 300,
      creatorNetCents: 700,
      liveTitle: 'Session test',
      paymentMode: 'simulation',
    });
  });

  it('retourne l’historique trié du plus récent au plus ancien', () => {
    recordLiveDonation({
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'Fan_Test',
      amount: 5,
      paymentMode: 'simulation',
    });
    recordLiveDonation({
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'Fan_Test',
      amount: 25,
      paymentMode: 'simulation',
    });

    const history = getAdminDonationsHistory({ limit: 10 });
    expect(history.total).toBe(2);
    expect(history.items[0]?.amountEur).toBe(25);
    expect(history.items[1]?.amountEur).toBe(5);
  });
});
