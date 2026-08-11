import type { Gift, Live } from '../models/schema';
import { db } from '../models/schema';
import { getIo } from './ioInstance';
import { notifyHostLiveDon } from './notifications';
import { persistGiftToPgAsync } from './pgDonations';
import { broadcastAdminDonationRecorded } from './donationsAdminBroadcast';
import { CREATOR_MONETIZATION_MIN_AGE, creatorMeetsMonetizationAgeFromProfile } from './ageGates';
import { getStripeClient } from './stripeClient';
import { isProductionEnv } from './jwtSecret';
import { isStripeLiveMode } from './stripeConfig';

export {
  computeDonationFeeBreakdown,
  computeDonationPlatformFeeCents,
  getDonationLegalConfig,
  getDonationPlatformFeePercent,
} from '../config/donationLegal';

export const DON_AMOUNT_MIN = 1;
export const DON_AMOUNT_MAX = 100;
export const LIVE_DON_TIERS_MS_DEV = [1, 2, 5] as const;
export const LIVE_DON_TIERS_PROD = [5, 10, 25] as const;
export const DONATION_MIN_AGE = 18;
export const DONATION_CURRENCY = 'eur';

export function isMsdevRuntime(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Dons activés : simulation msdev toujours ; staging si DONATIONS_ENABLED + Stripe ;
 * production stricte (onscen.com) uniquement si clé Stripe **live** — évite les
 * paiements « réussis » fictifs avec sk_test (audit STR-11, reco CTO 2026-08-07).
 */
export function isDonationsEnabled(): boolean {
  if (isMsdevRuntime()) return true;
  if (process.env.DONATIONS_ENABLED !== '1' || !isStripeConfigured()) return false;
  if (isProductionEnv()) return isStripeLiveMode();
  return true;
}

export function isDonationSimulationMode(): boolean {
  return isMsdevRuntime();
}

export function getDonationTiers(): readonly number[] {
  return isDonationSimulationMode() ? LIVE_DON_TIERS_MS_DEV : LIVE_DON_TIERS_PROD;
}

export function isValidDonAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= DON_AMOUNT_MIN && amount <= DON_AMOUNT_MAX;
}

export function assertDonAmount(amount: number): void {
  if (!isValidDonAmount(amount)) {
    throw new Error(`Montant invalide (${DON_AMOUNT_MIN} à ${DON_AMOUNT_MAX} €)`);
  }
}

export function userMeetsDonationAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= DONATION_MIN_AGE;
}

export function userMeetsDonationAgeFromProfile(
  user: { age?: number; birthDate?: string } | null | undefined
): boolean {
  return creatorMeetsMonetizationAgeFromProfile(user);
}

export function assertCreatorCanReceiveDonation(hostId: string): void {
  const host = db.users.get(hostId);
  if (!host || !creatorMeetsMonetizationAgeFromProfile(host)) {
    throw new Error(
      `Ce live ne peut pas recevoir de dons (monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans).`
    );
  }
}

export function getCreatorStripeConnectAccountId(hostId: string): string | null {
  const host = db.users.get(hostId);
  const id = host?.stripeConnectAccountId?.trim();
  return id || null;
}

export function assertCreatorCanReceiveStripeDonation(hostId: string): void {
  assertCreatorCanReceiveDonation(hostId);
  if (isDonationSimulationMode()) return;
  if (!getCreatorStripeConnectAccountId(hostId)) {
    throw new Error(
      'Ce créateur n’a pas encore ajouté son compte bancaire pour recevoir des pourboires.'
    );
  }
}

/** Pourboires acceptés sur ce live (spectateurs + API). */
export function liveAcceptsTips(live: Live | undefined): boolean {
  return live?.tipsEnabled !== false;
}

export function assertLiveAcceptsTips(live: Live): void {
  if (!liveAcceptsTips(live)) {
    throw new Error('Les pourboires sont désactivés sur ce live.');
  }
}

/** État pourboires figé au démarrage du live selon le choix hôte et Stripe Connect. */
export async function resolveLiveTipsEnabledAtStart(
  hostId: string,
  stripeConnectSkipped: boolean
): Promise<boolean> {
  if (stripeConnectSkipped) return false;
  if (isDonationSimulationMode()) return true;
  const accountId = getCreatorStripeConnectAccountId(hostId);
  if (!accountId) return false;
  const stripe = getStripeClient();
  if (!stripe) return false;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.charges_enabled === true;
  } catch {
    return false;
  }
}

function getMsdevDailyCap(): number | null {
  const raw = process.env.MSDEV_DON_DAILY_CAP?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < DON_AMOUNT_MIN) return null;
  return Math.trunc(n);
}

function startOfUtcDay(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Total des dons (simulation) de l'utilisateur aujourd'hui (UTC). */
export function getUserDailyDonationTotal(userId: string, now = Date.now()): number {
  const dayStart = startOfUtcDay(now);
  return db.gifts
    .filter(
      (g) =>
        g.senderId === userId &&
        g.giftType === 'don' &&
        g.paymentMode === 'simulation' &&
        g.timestamp >= dayStart
    )
    .reduce((sum, g) => sum + (g.amount || 0), 0);
}

export function getRemainingDailyDonationBudget(userId: string): number | null {
  const cap = getMsdevDailyCap();
  if (cap == null) return null;
  return Math.max(0, cap - getUserDailyDonationTotal(userId));
}

export function assertDailyDonationBudget(userId: string, amount: number): void {
  const cap = getMsdevDailyCap();
  if (cap == null) return;
  const used = getUserDailyDonationTotal(userId);
  if (used + amount > cap) {
    throw new Error(`Plafond journalier de simulation atteint (${cap} €)`);
  }
}

function emitGiftAnimation(
  liveId: string,
  gift: {
    id: string;
    senderId: string;
    giftType: string;
    senderName: string;
    amount: number;
    timestamp: number;
  }
) {
  getIo()?.to(`live_${liveId}`).emit('gift_animation', { liveId, ...gift });
}

/** Enregistre un don live crédité (simulation ou Stripe confirmé). */
export function recordLiveDonation(params: {
  liveId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  amount: number;
  paymentMode: 'simulation' | 'stripe';
  paymentIntentId?: string;
}): Gift {
  const { liveId, senderId, senderName, senderAvatarUrl, amount, paymentMode, paymentIntentId } = params;
  assertDonAmount(amount);

  const live = db.lives.get(liveId);
  if (!live?.isActive) {
    throw new Error('Live introuvable');
  }
  assertCreatorCanReceiveDonation(live.hostId);

  if (paymentIntentId) {
    const duplicate = db.gifts.find((g) => g.paymentIntentId === paymentIntentId);
    if (duplicate) return duplicate;
  }

  const gift: Gift = {
    id: `gift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    liveId,
    senderId,
    senderName,
    giftType: 'don',
    amount,
    timestamp: Date.now(),
    paymentMode,
    paymentIntentId,
  };
  db.gifts.push(gift);

  persistGiftToPgAsync(gift, live.hostId);

  emitGiftAnimation(liveId, {
    id: gift.id,
    senderId,
    giftType: 'don',
    senderName,
    amount,
    timestamp: gift.timestamp,
  });

  notifyHostLiveDon({
    hostId: live.hostId,
    senderId,
    senderName,
    senderAvatarUrl,
    amount,
    liveId,
  });

  broadcastAdminDonationRecorded(gift);

  return gift;
}
