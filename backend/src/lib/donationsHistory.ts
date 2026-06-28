import type { Gift } from '../models/schema';
import { db } from '../models/schema';
import {
  computeDonationPlatformFeeCents,
  getDonationPlatformFeePercent,
  isDonationSimulationMode,
} from './donations';

export interface AdminDonationEntry {
  id: string;
  liveId: string;
  liveTitle: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amountEur: number;
  amountCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  paymentMode: 'simulation' | 'stripe';
  timestamp: number;
}

export interface AdminDonationsHistoryResponse {
  fetchedAt: string;
  simulationMode: boolean;
  platformFeePercent: number;
  total: number;
  items: AdminDonationEntry[];
}

function isLiveDonationGift(gift: Gift): boolean {
  return gift.giftType === 'don' && Number.isFinite(gift.amount) && gift.amount > 0;
}

function platformFeeCentsForGift(gift: Gift, amountCents: number): number {
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

export function mapGiftToAdminDonationEntry(gift: Gift): AdminDonationEntry | null {
  if (!isLiveDonationGift(gift)) return null;

  const live = db.lives.get(gift.liveId);
  const hostId = live?.hostId;
  if (!hostId) return null;

  const host = db.users.get(hostId);
  const amountCents = Math.trunc(gift.amount) * 100;
  const platformFeeCents = platformFeeCentsForGift(gift, amountCents);
  const sender = db.users.get(gift.senderId);

  return {
    id: gift.id,
    liveId: gift.liveId,
    liveTitle: live?.title?.trim() || 'Live',
    senderId: gift.senderId,
    senderName: gift.senderName?.trim() || sender?.username || '—',
    recipientId: hostId,
    recipientName: host?.username || '—',
    amountEur: gift.amount,
    amountCents,
    platformFeeCents,
    creatorNetCents: Math.max(0, amountCents - platformFeeCents),
    paymentMode: gift.paymentMode === 'stripe' ? 'stripe' : 'simulation',
    timestamp: gift.timestamp,
  };
}

export function getAdminDonationsHistory(opts?: {
  limit?: number;
  offset?: number;
  now?: number;
}): AdminDonationsHistoryResponse {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const donationGifts = db.gifts
    .filter(isLiveDonationGift)
    .sort((a, b) => b.timestamp - a.timestamp);

  const items = donationGifts
    .slice(offset, offset + limit)
    .map(mapGiftToAdminDonationEntry)
    .filter((entry): entry is AdminDonationEntry => entry != null);

  return {
    fetchedAt: new Date(opts?.now ?? Date.now()).toISOString(),
    simulationMode: isDonationSimulationMode(),
    platformFeePercent: getDonationPlatformFeePercent(),
    total: donationGifts.length,
    items,
  };
}
