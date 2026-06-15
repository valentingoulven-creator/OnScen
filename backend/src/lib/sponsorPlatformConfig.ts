import { db } from '../models/schema';

export interface SponsorPlatformConfig {
  /** Afficher des reels sponsorisés dans le feed Reels. */
  reelsSponsorEnabled: boolean;
  /** Insérer un reel sponsorisé tous les N reels organiques. */
  reelsSponsorEveryN: number;
}

export const REELS_SPONSOR_EVERY_N_MIN = 1;
export const REELS_SPONSOR_EVERY_N_MAX = 50;
export const DEFAULT_REELS_SPONSOR_EVERY_N = 5;

export const DEFAULT_SPONSOR_PLATFORM_CONFIG: SponsorPlatformConfig = {
  reelsSponsorEnabled: true,
  reelsSponsorEveryN: DEFAULT_REELS_SPONSOR_EVERY_N,
};

export function normalizeReelsSponsorEveryN(raw: unknown, fallback = DEFAULT_REELS_SPONSOR_EVERY_N): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(REELS_SPONSOR_EVERY_N_MAX, Math.max(REELS_SPONSOR_EVERY_N_MIN, Math.floor(n)));
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
  return getSponsorPlatformConfig();
}

export function ensureDefaultSponsorPlatformConfig(): void {
  if (!db.sponsorPlatformConfig) {
    db.sponsorPlatformConfig = { ...DEFAULT_SPONSOR_PLATFORM_CONFIG };
    return;
  }
  db.sponsorPlatformConfig.reelsSponsorEveryN = normalizeReelsSponsorEveryN(
    db.sponsorPlatformConfig.reelsSponsorEveryN
  );
}
