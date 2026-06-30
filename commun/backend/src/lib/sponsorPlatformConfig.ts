import { db } from '../models/schema';

export interface SponsorPlatformConfig {
  /** Afficher des reels sponsorisés dans le feed Reels. */
  reelsSponsorEnabled: boolean;
  /** Insérer un reel sponsorisé tous les N reels organiques. */
  reelsSponsorEveryN: number;
  /** Afficher des stories sponsorisées dans le visionneur. */
  storiesSponsorEnabled: boolean;
  /** Insérer une pub tous les N segments story. */
  storiesSponsorEveryN: number;
}

export const REELS_SPONSOR_EVERY_N_MIN = 1;
export const REELS_SPONSOR_EVERY_N_MAX = 50;
export const DEFAULT_REELS_SPONSOR_EVERY_N = 5;

export const STORIES_SPONSOR_EVERY_N_MIN = 1;
export const STORIES_SPONSOR_EVERY_N_MAX = 50;
export const DEFAULT_STORIES_SPONSOR_EVERY_N = 4;

export const DEFAULT_SPONSOR_PLATFORM_CONFIG: SponsorPlatformConfig = {
  reelsSponsorEnabled: true,
  reelsSponsorEveryN: DEFAULT_REELS_SPONSOR_EVERY_N,
  storiesSponsorEnabled: true,
  storiesSponsorEveryN: DEFAULT_STORIES_SPONSOR_EVERY_N,
};

export function normalizeReelsSponsorEveryN(raw: unknown, fallback = DEFAULT_REELS_SPONSOR_EVERY_N): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(REELS_SPONSOR_EVERY_N_MAX, Math.max(REELS_SPONSOR_EVERY_N_MIN, Math.floor(n)));
}

export function normalizeStoriesSponsorEveryN(raw: unknown, fallback = DEFAULT_STORIES_SPONSOR_EVERY_N): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(STORIES_SPONSOR_EVERY_N_MAX, Math.max(STORIES_SPONSOR_EVERY_N_MIN, Math.floor(n)));
}

export function getSponsorPlatformConfig(): SponsorPlatformConfig {
  return { ...db.sponsorPlatformConfig };
}

export function getPublicReelsSponsorConfig(): Pick<SponsorPlatformConfig, 'reelsSponsorEnabled' | 'reelsSponsorEveryN'> {
  const c = db.sponsorPlatformConfig;
  return {
    reelsSponsorEnabled: c.reelsSponsorEnabled,
    reelsSponsorEveryN: c.reelsSponsorEveryN,
  };
}

export function getPublicStoriesSponsorConfig(): Pick<
  SponsorPlatformConfig,
  'storiesSponsorEnabled' | 'storiesSponsorEveryN'
> {
  const c = db.sponsorPlatformConfig;
  return {
    storiesSponsorEnabled: c.storiesSponsorEnabled ?? true,
    storiesSponsorEveryN: normalizeStoriesSponsorEveryN(c.storiesSponsorEveryN),
  };
}

export function updateSponsorPlatformConfig(
  patch: Partial<SponsorPlatformConfig>
): SponsorPlatformConfig {
  if (patch.reelsSponsorEnabled !== undefined) {
    db.sponsorPlatformConfig.reelsSponsorEnabled = Boolean(patch.reelsSponsorEnabled);
  }
  if (patch.reelsSponsorEveryN !== undefined) {
    db.sponsorPlatformConfig.reelsSponsorEveryN = normalizeReelsSponsorEveryN(
      patch.reelsSponsorEveryN,
      db.sponsorPlatformConfig.reelsSponsorEveryN
    );
  }
  if (patch.storiesSponsorEnabled !== undefined) {
    db.sponsorPlatformConfig.storiesSponsorEnabled = Boolean(patch.storiesSponsorEnabled);
  }
  if (patch.storiesSponsorEveryN !== undefined) {
    db.sponsorPlatformConfig.storiesSponsorEveryN = normalizeStoriesSponsorEveryN(
      patch.storiesSponsorEveryN,
      db.sponsorPlatformConfig.storiesSponsorEveryN ?? DEFAULT_STORIES_SPONSOR_EVERY_N
    );
  }
  return getSponsorPlatformConfig();
}

export function ensureDefaultSponsorPlatformConfig(): void {
  if (!db.sponsorPlatformConfig) {
    db.sponsorPlatformConfig = { ...DEFAULT_SPONSOR_PLATFORM_CONFIG };
    return;
  }
  if (db.sponsorPlatformConfig.storiesSponsorEnabled == null) {
    db.sponsorPlatformConfig.storiesSponsorEnabled = DEFAULT_SPONSOR_PLATFORM_CONFIG.storiesSponsorEnabled;
  }
  db.sponsorPlatformConfig.reelsSponsorEveryN = normalizeReelsSponsorEveryN(
    db.sponsorPlatformConfig.reelsSponsorEveryN
  );
  db.sponsorPlatformConfig.storiesSponsorEveryN = normalizeStoriesSponsorEveryN(
    db.sponsorPlatformConfig.storiesSponsorEveryN
  );
}
