import { db, type Live } from '../models/schema';
import type { LiveStreamMode } from './liveStreamMode';
import { isCloudflareStreamConfigured } from './cloudflareStream';
import { isLiveKitConfigured } from './livekit';
import { getActiveSubscription, PLATFORM_CREATOR_ID } from './subscriptions';

export type PlatformPlanId = 'free' | 'soundy_plus' | 'soundy_ultra';

export interface PlatformPlanLimits {
  /** null = illimité */
  maxViewers: number | null;
  /** null = illimité */
  maxLiveMinutesPerDay: number | null;
  allowObs: boolean;
  allowLiveKit: boolean;
  allowCloudflare: boolean;
}

export interface PlatformPlanDefinition {
  id: PlatformPlanId;
  label: string;
  priceCents: number;
  priceDisplay: string;
  /** Identifiant du palier Stripe / abonnement plateforme (absent pour free). */
  subscriptionTierId: string | null;
  limits: PlatformPlanLimits;
  featuresFr: string[];
}

export class PlatformPlanError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'PlatformPlanError';
  }
}

const PLATFORM_PLANS: Record<PlatformPlanId, PlatformPlanDefinition> = {
  free: {
    id: 'free',
    label: 'Gratuit',
    priceCents: 0,
    priceDisplay: 'Gratuit',
    subscriptionTierId: null,
    limits: {
      maxViewers: 30,
      maxLiveMinutesPerDay: 120,
      allowObs: false,
      allowLiveKit: true,
      allowCloudflare: false,
    },
    featuresFr: [
      'Jusqu’à 30 spectateurs en live',
      '2 h de live par jour',
      'Diffusion LiveKit (sans OBS)',
    ],
  },
  soundy_plus: {
    id: 'soundy_plus',
    label: 'Soundy+',
    priceCents: 999,
    priceDisplay: '9,99 €/mois',
    subscriptionTierId: 'soundy_plus',
    limits: {
      maxViewers: 400,
      maxLiveMinutesPerDay: 240,
      allowObs: false,
      allowLiveKit: true,
      allowCloudflare: false,
    },
    featuresFr: [
      'Jusqu’à 400 spectateurs (LiveKit)',
      '4 h de live par jour',
      'Sans diffusion OBS / Cloudflare',
    ],
  },
  soundy_ultra: {
    id: 'soundy_ultra',
    label: 'SoundyUltra',
    priceCents: 1999,
    priceDisplay: '19,99 €/mois',
    subscriptionTierId: 'soundy_ultra',
    limits: {
      maxViewers: null,
      maxLiveMinutesPerDay: null,
      allowObs: true,
      allowLiveKit: true,
      allowCloudflare: true,
    },
    featuresFr: [
      'Spectateurs illimités',
      'Diffusion OBS via Cloudflare',
      'Temps de live illimité',
    ],
  },
};

export function getPlatformPlan(planId: PlatformPlanId): PlatformPlanDefinition {
  return PLATFORM_PLANS[planId];
}

export function listPlatformPlans(): PlatformPlanDefinition[] {
  return [PLATFORM_PLANS.free, PLATFORM_PLANS.soundy_plus, PLATFORM_PLANS.soundy_ultra];
}

export function resolvePlatformPlanIdFromTier(tierId: string | undefined): PlatformPlanId {
  if (tierId === 'soundy_ultra') return 'soundy_ultra';
  if (tierId === 'soundy_plus') return 'soundy_plus';
  return 'free';
}

export function getUserPlatformPlan(userId: string, now = Date.now()): PlatformPlanDefinition {
  const sub = getActiveSubscription(userId, PLATFORM_CREATOR_ID, now);
  if (!sub) return PLATFORM_PLANS.free;
  return getPlatformPlan(resolvePlatformPlanIdFromTier(sub.tierId));
}

/** Rediffusions de lives archivés sur le profil personnel (Soundy+ / SoundyUltra). */
export function canAccessArchivedLives(userId: string, now = Date.now()): boolean {
  const plan = getUserPlatformPlan(userId, now);
  return plan.id === 'soundy_plus' || plan.id === 'soundy_ultra';
}

function startOfUtcDay(ts = Date.now()): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function liveMinutesOnDay(live: Live, dayStart: number, now: number): number {
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const started = live.startedAt;
  const ended = live.isActive ? now : (live.endedAt ?? live.startedAt);
  if (ended <= dayStart || started >= dayEnd) return 0;
  const effectiveStart = Math.max(started, dayStart);
  const effectiveEnd = Math.min(ended, dayEnd);
  return Math.max(0, Math.ceil((effectiveEnd - effectiveStart) / 60_000));
}

export function getHostDailyLiveMinutesUsed(hostId: string, now = Date.now()): number {
  const dayStart = startOfUtcDay(now);
  let total = 0;
  for (const live of db.lives.values()) {
    if (live.hostId !== hostId) continue;
    total += liveMinutesOnDay(live, dayStart, now);
  }
  return total;
}

export function formatDailyLimitHours(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function assertCanStartLive(hostId: string, now = Date.now()): void {
  const user = db.users.get(hostId);
  // Les comptes admin n'ont aucune limite de diffusion
  if (user?.isAdmin) return;
  const plan = getUserPlatformPlan(hostId, now);
  const limit = plan.limits.maxLiveMinutesPerDay;
  if (limit == null) return;
  const used = getHostDailyLiveMinutesUsed(hostId, now);
  if (used >= limit) {
    const limitLabel = formatDailyLimitHours(limit);
    throw new PlatformPlanError(
      'LIVE_DAILY_LIMIT',
      `Vous avez atteint votre limite de diffusion live pour aujourd’hui (${limitLabel}). Passez à Soundy+ ou SoundyUltra pour plus de temps.`
    );
  }
}

export function assertCanJoinLiveAsViewer(
  hostId: string,
  currentViewers: number,
  viewerId?: string
): void {
  if (viewerId && viewerId === hostId) return;
  // L'admin peut toujours rejoindre
  const viewer = viewerId ? db.users.get(viewerId) : undefined;
  if (viewer?.isAdmin) return;
  const plan = getUserPlatformPlan(hostId);
  const max = plan.limits.maxViewers;
  if (max == null) return;
  if (currentViewers >= max) {
    throw new PlatformPlanError(
      'LIVE_VIEWER_LIMIT',
      `Ce live est complet (limite de ${max} spectateurs pour le forfait ${plan.label} de l’hôte).`
    );
  }
}

export function assertCanUseCloudflareObs(hostId: string): void {
  const user = db.users.get(hostId);
  if (user?.isAdmin) return;
  const plan = getUserPlatformPlan(hostId);
  if (!plan.limits.allowCloudflare || !plan.limits.allowObs) {
    throw new PlatformPlanError(
      'OBS_NOT_ALLOWED',
      'La diffusion OBS (Cloudflare Stream) est réservée à l’abonnement SoundyUltra.'
    );
  }
}

export function resolveStreamModeForHost(hostId: string): LiveStreamMode {
  const plan = getUserPlatformPlan(hostId);
  if (plan.limits.allowLiveKit && isLiveKitConfigured()) return 'livekit';
  if (plan.limits.allowCloudflare && isCloudflareStreamConfigured()) return 'cloudflare';
  return 'webrtc';
}

export interface PlatformPlanStatus {
  plan: PlatformPlanDefinition;
  dailyLiveMinutesUsed: number;
  dailyLiveMinutesLimit: number | null;
  activePlatformSubscription: {
    tierId: string;
    tierLabel: string;
    currentPeriodEnd: number;
  } | null;
}

export function getPlatformPlanStatus(userId: string, now = Date.now()): PlatformPlanStatus {
  const plan = getUserPlatformPlan(userId, now);
  const sub = getActiveSubscription(userId, PLATFORM_CREATOR_ID, now);
  return {
    plan,
    dailyLiveMinutesUsed: getHostDailyLiveMinutesUsed(userId, now),
    dailyLiveMinutesLimit: plan.limits.maxLiveMinutesPerDay,
    activePlatformSubscription: sub
      ? {
          tierId: sub.tierId,
          tierLabel: sub.tierLabel,
          currentPeriodEnd: sub.currentPeriodEnd,
        }
      : null,
  };
}
