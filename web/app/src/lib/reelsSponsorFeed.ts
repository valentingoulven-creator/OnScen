import type { MusicReel } from '../content/reels';
import type { ReelsSponsorAd } from '../types';

export const DEFAULT_REELS_SPONSOR_EVERY_N = 5;

export type ReelsSponsorConfig = {
  reelsSponsorEnabled: boolean;
  reelsSponsorEveryN: number;
};

export const DEFAULT_REELS_SPONSOR_CONFIG: ReelsSponsorConfig = {
  reelsSponsorEnabled: true,
  reelsSponsorEveryN: DEFAULT_REELS_SPONSOR_EVERY_N,
};

export type ReelsFeedDisplayItem =
  | { kind: 'reel'; reel: MusicReel; key: string }
  | { kind: 'sponsor'; ad: ReelsSponsorAd; key: string };

export function sponsorDisplayKey(ad: ReelsSponsorAd): string {
  return `sponsor:${ad.id}`;
}

export function isSponsorDisplayKey(key: string): boolean {
  return key.startsWith('sponsor:');
}

export function normalizeReelsSponsorEveryN(
  raw: unknown,
  fallback = DEFAULT_REELS_SPONSOR_EVERY_N
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

/** Insère un reel sponsorisé tous les N reels organiques (rotation round-robin). */
export function interleaveReelsSponsors(
  reels: MusicReel[],
  ads: ReelsSponsorAd[],
  config: ReelsSponsorConfig
): ReelsFeedDisplayItem[] {
  if (!config.reelsSponsorEnabled || ads.length === 0 || reels.length === 0) {
    return reels.map((reel) => ({ kind: 'reel', reel, key: reel.id }));
  }

  const everyN = normalizeReelsSponsorEveryN(config.reelsSponsorEveryN);
  const result: ReelsFeedDisplayItem[] = [];
  let adIndex = 0;
  let organicSinceLastSponsor = 0;

  for (const reel of reels) {
    result.push({ kind: 'reel', reel, key: reel.id });
    organicSinceLastSponsor += 1;

    if (organicSinceLastSponsor >= everyN) {
      const ad = ads[adIndex % ads.length]!;
      result.push({ kind: 'sponsor', ad, key: sponsorDisplayKey(ad) });
      adIndex += 1;
      organicSinceLastSponsor = 0;
    }
  }

  return result;
}

export function mapApiItemToReelsSponsorAd(item: ReelsSponsorAd): ReelsSponsorAd {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    cta: item.cta,
    href: item.href,
    accent: item.accent,
    sponsor: item.sponsor,
    kind: item.kind,
    logoUrl: item.logoUrl,
    displayDurationSec: item.displayDurationSec,
    videoUrl: item.videoUrl,
    posterUrl: item.posterUrl,
  };
}
