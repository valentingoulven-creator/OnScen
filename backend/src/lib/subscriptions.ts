import { db, type CreatorSubscription } from '../models/schema';
import { isMsdevRuntime, isStripeConfigured, userMeetsDonationAge } from './donations';
import { CREATOR_MONETIZATION_MIN_AGE, creatorMeetsMonetizationAge } from './ageGates';

export const SUBSCRIPTION_MIN_AGE = 18;
export const SUBSCRIPTION_CURRENCY = 'eur';
export const PLATFORM_CREATOR_ID = 'platform';

export type SubscriptionTargetType = 'creator' | 'platform';

export interface SubscriptionTier {
  id: string;
  label: string;
  amountCents: number;
  stripePriceId: string | null;
  targetType: SubscriptionTargetType;
}

export function isSubscriptionsEnabled(): boolean {
  if (isMsdevRuntime()) return true;
  return process.env.SUBSCRIPTIONS_ENABLED === '1' && isStripeConfigured();
}

export function isSubscriptionSimulationMode(): boolean {
  return isMsdevRuntime();
}

export function userMeetsSubscriptionAge(age: number | undefined): boolean {
  return userMeetsDonationAge(age);
}

export function assertCreatorCanReceiveSubscription(creatorId: string): void {
  if (creatorId === PLATFORM_CREATOR_ID) return;
  const creator = db.users.get(creatorId);
  if (!creator || !creatorMeetsMonetizationAge(creator.age)) {
    throw new Error(
      `Ce créateur ne peut pas recevoir d'abonnements (monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans).`
    );
  }
}

function parseAmountCents(envKey: string, fallbackCents: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallbackCents;
  const euros = Number(raw.replace(',', '.'));
  if (!Number.isFinite(euros) || euros <= 0) return fallbackCents;
  return Math.round(euros * 100);
}

function parseCommissionPercent(): number {
  const raw = process.env.SUBSCRIPTION_PLATFORM_COMMISSION_PERCENT?.trim();
  if (!raw) return 10;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 10;
  return n;
}

export function getPlatformCommissionPercent(): number {
  return parseCommissionPercent();
}

export function getSubscriptionTiers(): SubscriptionTier[] {
  const tier1Cents = parseAmountCents('SUBSCRIPTION_TIER1_AMOUNT_EUR', 499);
  const tier2Cents = parseAmountCents('SUBSCRIPTION_TIER2_AMOUNT_EUR', 999);
  const soundyPlusCents = parseAmountCents('SUBSCRIPTION_SOUNDY_PLUS_AMOUNT_EUR', 999);
  const soundyUltraCents = parseAmountCents('SUBSCRIPTION_SOUNDY_ULTRA_AMOUNT_EUR', 1999);

  const tier1Label = process.env.SUBSCRIPTION_TIER1_LABEL?.trim() || 'Supporter';
  const tier2Label = process.env.SUBSCRIPTION_TIER2_LABEL?.trim() || 'Super fan';
  const soundyPlusLabel = process.env.SUBSCRIPTION_SOUNDY_PLUS_LABEL?.trim() || 'Soundy+';
  const soundyUltraLabel = process.env.SUBSCRIPTION_SOUNDY_ULTRA_LABEL?.trim() || 'SoundyUltra';

  const tiers: SubscriptionTier[] = [
    {
      id: 'tier1',
      label: tier1Label,
      amountCents: tier1Cents,
      stripePriceId: process.env.STRIPE_PRICE_ID_TIER1?.trim() || null,
      targetType: 'creator',
    },
    {
      id: 'tier2',
      label: tier2Label,
      amountCents: tier2Cents,
      stripePriceId: process.env.STRIPE_PRICE_ID_TIER2?.trim() || null,
      targetType: 'creator',
    },
    {
      id: 'soundy_plus',
      label: soundyPlusLabel,
      amountCents: soundyPlusCents,
      stripePriceId: process.env.STRIPE_PRICE_ID_SOUNDY_PLUS?.trim() || null,
      targetType: 'platform',
    },
    {
      id: 'soundy_ultra',
      label: soundyUltraLabel,
      amountCents: soundyUltraCents,
      stripePriceId: process.env.STRIPE_PRICE_ID_SOUNDY_ULTRA?.trim() || null,
      targetType: 'platform',
    },
  ];
  return tiers;
}

export function getTierById(tierId: string, targetType: SubscriptionTargetType): SubscriptionTier | null {
  return (
    getSubscriptionTiers().find((t) => t.id === tierId && t.targetType === targetType) ?? null
  );
}

export function resolveCreatorId(targetType: SubscriptionTargetType, creatorId?: string): string {
  if (targetType === 'platform') return PLATFORM_CREATOR_ID;
  if (!creatorId?.trim()) throw new Error('Créateur requis');
  return creatorId.trim();
}

export function getActiveSubscription(
  subscriberId: string,
  creatorId: string,
  now = Date.now()
): CreatorSubscription | null {
  return (
    db.creatorSubscriptions.find(
      (s) =>
        s.subscriberId === subscriberId &&
        s.creatorId === creatorId &&
        s.status === 'active' &&
        s.currentPeriodEnd > now
    ) ?? null
  );
}

export function isSupporter(subscriberId: string, creatorId: string): boolean {
  return getActiveSubscription(subscriberId, creatorId) != null;
}

export function getCreatorSubscriberCount(creatorId: string, now = Date.now()): number {
  const ids = new Set<string>();
  for (const s of db.creatorSubscriptions) {
    if (s.creatorId === creatorId && s.status === 'active' && s.currentPeriodEnd > now) {
      ids.add(s.subscriberId);
    }
  }
  return ids.size;
}

function getMsdevDailyCap(): number | null {
  const raw = process.env.MSDEV_SUB_DAILY_CAP?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.trunc(n);
}

function startOfUtcDay(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getUserDailySimulationSubCount(userId: string, now = Date.now()): number {
  const dayStart = startOfUtcDay(now);
  return db.creatorSubscriptions.filter(
    (s) =>
      s.subscriberId === userId &&
      s.paymentMode === 'simulation' &&
      s.createdAt >= dayStart
  ).length;
}

export function getRemainingDailySimulationSubBudget(userId: string): number | null {
  const cap = getMsdevDailyCap();
  if (cap == null) return null;
  return Math.max(0, cap - getUserDailySimulationSubCount(userId));
}

export function assertDailySimulationSubBudget(userId: string): void {
  const cap = getMsdevDailyCap();
  if (cap == null) return;
  if (getUserDailySimulationSubCount(userId) >= cap) {
    throw new Error(`Plafond journalier de simulation atteint (${cap} abonnement(s))`);
  }
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Active ou renouvelle un abonnement créateur / Soundly+ (simulation ou Stripe confirmé). */
export function recordCreatorSubscription(params: {
  subscriberId: string;
  creatorId: string;
  tierId: string;
  tierLabel: string;
  amountCents: number;
  targetType: SubscriptionTargetType;
  paymentMode: 'simulation' | 'stripe';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodEnd?: number;
}): CreatorSubscription {
  const {
    subscriberId,
    creatorId,
    tierId,
    tierLabel,
    amountCents,
    targetType,
    paymentMode,
    stripeSubscriptionId,
    stripeCustomerId,
    currentPeriodEnd,
  } = params;

  if (creatorId !== PLATFORM_CREATOR_ID) {
    assertCreatorCanReceiveSubscription(creatorId);
  }

  const subscriber = db.users.get(subscriberId);
  if (!subscriber) throw new Error('Abonné introuvable');

  if (stripeSubscriptionId) {
    const existing = db.creatorSubscriptions.find(
      (s) => s.stripeSubscriptionId === stripeSubscriptionId
    );
    if (existing) {
      existing.status = 'active';
      existing.currentPeriodEnd = currentPeriodEnd ?? existing.currentPeriodEnd;
      existing.updatedAt = Date.now();
      return existing;
    }
  }

  const now = Date.now();
  const periodEnd = currentPeriodEnd ?? now + MONTH_MS;

  const existingActive = getActiveSubscription(subscriberId, creatorId, now);
  if (existingActive && paymentMode === 'simulation') {
    existingActive.tierId = tierId;
    existingActive.tierLabel = tierLabel;
    existingActive.amountCents = amountCents;
    existingActive.currentPeriodEnd = periodEnd;
    existingActive.updatedAt = now;
    return existingActive;
  }

  if (existingActive && paymentMode === 'stripe' && stripeSubscriptionId) {
    existingActive.status = 'canceled';
    existingActive.updatedAt = now;
  }

  const sub: CreatorSubscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subscriberId,
    creatorId,
    tierId,
    tierLabel,
    amountCents,
    targetType,
    status: 'active',
    paymentMode,
    stripeSubscriptionId,
    stripeCustomerId,
    currentPeriodEnd: periodEnd,
    createdAt: now,
    updatedAt: now,
  };
  db.creatorSubscriptions.push(sub);
  return sub;
}

export function cancelSubscriptionRecord(
  stripeSubscriptionId: string,
  status: 'canceled' | 'past_due' = 'canceled'
): CreatorSubscription | null {
  const sub = db.creatorSubscriptions.find((s) => s.stripeSubscriptionId === stripeSubscriptionId);
  if (!sub) return null;
  sub.status = status;
  sub.updatedAt = Date.now();
  return sub;
}

export function renewSubscriptionFromInvoice(
  stripeSubscriptionId: string,
  periodEnd: number
): CreatorSubscription | null {
  const sub = db.creatorSubscriptions.find((s) => s.stripeSubscriptionId === stripeSubscriptionId);
  if (!sub) return null;
  sub.status = 'active';
  sub.currentPeriodEnd = periodEnd;
  sub.updatedAt = Date.now();
  return sub;
}
