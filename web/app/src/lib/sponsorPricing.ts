import type { SponsorPlacement } from '../types';

/** Références marché France 2026 (Instagram / TikTok / Meta — fourchettes CPM €). */
export type SponsorPricingBenchmark = {
  benchmarkPlatform: 'instagram' | 'tiktok' | 'meta';
  benchmarkCpmMinEur: number;
  benchmarkCpmMaxEur: number;
  /** CPM OnScen suggéré (~45–55 % sous le milieu de marché, inventaire early-stage). */
  onscenCpmEur: number;
  pricingCompKey: string;
};

export const SPONSOR_PLACEMENT_PRICING: Record<SponsorPlacement, SponsorPricingBenchmark> = {
  map_banner: {
    benchmarkPlatform: 'meta',
    benchmarkCpmMinEur: 8,
    benchmarkCpmMaxEur: 14,
    onscenCpmEur: 6.5,
    pricingCompKey: 'admin.sponsors.pricingCompMapBanner',
  },
  map_sidebar_events: {
    benchmarkPlatform: 'instagram',
    benchmarkCpmMinEur: 6,
    benchmarkCpmMaxEur: 12,
    onscenCpmEur: 5.5,
    pricingCompKey: 'admin.sponsors.pricingCompMapSidebar',
  },
  feed_inline: {
    benchmarkPlatform: 'instagram',
    benchmarkCpmMinEur: 10,
    benchmarkCpmMaxEur: 18,
    onscenCpmEur: 8,
    pricingCompKey: 'admin.sponsors.pricingCompFeed',
  },
  stories_banner: {
    benchmarkPlatform: 'instagram',
    benchmarkCpmMinEur: 6,
    benchmarkCpmMaxEur: 12,
    onscenCpmEur: 5,
    pricingCompKey: 'admin.sponsors.pricingCompStoriesBanner',
  },
  stories_sponsored: {
    benchmarkPlatform: 'instagram',
    benchmarkCpmMinEur: 9,
    benchmarkCpmMaxEur: 16,
    onscenCpmEur: 7.5,
    pricingCompKey: 'admin.sponsors.pricingCompStoriesSponsored',
  },
  reels_sponsored: {
    benchmarkPlatform: 'tiktok',
    benchmarkCpmMinEur: 3,
    benchmarkCpmMaxEur: 9,
    onscenCpmEur: 4.5,
    pricingCompKey: 'admin.sponsors.pricingCompReels',
  },
  salon_theater: {
    benchmarkPlatform: 'meta',
    benchmarkCpmMinEur: 12,
    benchmarkCpmMaxEur: 20,
    onscenCpmEur: 9,
    pricingCompKey: 'admin.sponsors.pricingCompSalon',
  },
};

export const SPONSOR_PRICING_PLACEMENTS: SponsorPlacement[] = [
  'map_banner',
  'map_sidebar_events',
  'feed_inline',
  'stories_banner',
  'stories_sponsored',
  'reels_sponsored',
  'salon_theater',
];

export type SponsorCampaignPriceQuote = SponsorPricingBenchmark & {
  impressions: number;
  onscenPriceEur: number;
  benchmarkPriceMinEur: number;
  benchmarkPriceMaxEur: number;
};

/** Prix campagne = audience × jours × CPM / 1000 (1 exposition / jour / utilisateur actif). */
export function computeSponsorCampaignPriceEur(opts: {
  placement: SponsorPlacement;
  audienceUsers: number;
  displayDays: number;
}): SponsorCampaignPriceQuote {
  const config = SPONSOR_PLACEMENT_PRICING[opts.placement];
  const audience = Math.max(0, Math.floor(opts.audienceUsers));
  const days = Math.max(1, Math.floor(opts.displayDays));
  const impressions = audience * days;
  return {
    ...config,
    impressions,
    onscenPriceEur: (impressions / 1000) * config.onscenCpmEur,
    benchmarkPriceMinEur: (impressions / 1000) * config.benchmarkCpmMinEur,
    benchmarkPriceMaxEur: (impressions / 1000) * config.benchmarkCpmMaxEur,
  };
}

export function formatEurPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

/** Paliers de projection commerciale (inscrits → actifs 30 j). */
export type SponsorScaleTierId = '50k' | '100k' | '500k' | '1m';

export type SponsorScaleTier = {
  id: SponsorScaleTierId;
  registeredUsers: number;
  /** Part des inscrits actifs sur 30 jours. */
  active30dRate: number;
  labelKey: string;
  descriptionKey: string;
};

export const SPONSOR_SCALE_TIERS: SponsorScaleTier[] = [
  {
    id: '50k',
    registeredUsers: 50_000,
    active30dRate: 0.4,
    labelKey: 'admin.sponsors.pricingTier50k',
    descriptionKey: 'admin.sponsors.pricingTier50kDesc',
  },
  {
    id: '100k',
    registeredUsers: 100_000,
    active30dRate: 0.38,
    labelKey: 'admin.sponsors.pricingTier100k',
    descriptionKey: 'admin.sponsors.pricingTier100kDesc',
  },
  {
    id: '500k',
    registeredUsers: 500_000,
    active30dRate: 0.35,
    labelKey: 'admin.sponsors.pricingTier500k',
    descriptionKey: 'admin.sponsors.pricingTier500kDesc',
  },
  {
    id: '1m',
    registeredUsers: 1_000_000,
    active30dRate: 0.32,
    labelKey: 'admin.sponsors.pricingTier1m',
    descriptionKey: 'admin.sponsors.pricingTier1mDesc',
  },
];

/** Part des actifs 30 j exposés au sponsor sur la durée de campagne (France entière). */
export const SPONSOR_PLACEMENT_PENETRATION: Record<SponsorPlacement, number> = {
  map_banner: 0.45,
  map_sidebar_events: 0.3,
  feed_inline: 0.75,
  stories_banner: 0.35,
  stories_sponsored: 0.4,
  reels_sponsored: 0.35,
  salon_theater: 0.1,
};

/** CPM OnScen par palier (€) — lancement bas, remontée progressive vers la grille mature. */
export const SPONSOR_TIER_CPM: Record<SponsorScaleTierId, Record<SponsorPlacement, number>> = {
  '50k': {
    map_banner: 4.0,
    map_sidebar_events: 3.5,
    feed_inline: 5.0,
    stories_banner: 3.0,
    stories_sponsored: 5.0,
    reels_sponsored: 3.0,
    salon_theater: 6.0,
  },
  '100k': {
    map_banner: 5.0,
    map_sidebar_events: 4.5,
    feed_inline: 6.5,
    stories_banner: 4.0,
    stories_sponsored: 6.0,
    reels_sponsored: 3.5,
    salon_theater: 7.5,
  },
  '500k': {
    map_banner: 6.0,
    map_sidebar_events: 5.0,
    feed_inline: 7.5,
    stories_banner: 4.5,
    stories_sponsored: 7.0,
    reels_sponsored: 4.0,
    salon_theater: 8.5,
  },
  '1m': {
    map_banner: 6.5,
    map_sidebar_events: 5.5,
    feed_inline: 8.0,
    stories_banner: 5.0,
    stories_sponsored: 7.5,
    reels_sponsored: 4.5,
    salon_theater: 9.0,
  },
};

export const SPONSOR_TIER_DURATION_PRESETS = [7, 14, 30] as const;

export type SponsorTierPlacementQuote = {
  placement: SponsorPlacement;
  tier: SponsorScaleTier;
  exposedUsers: number;
  active30dUsers: number;
  penetrationRate: number;
  onscenCpmEur: number;
  pricesByDays: Record<(typeof SPONSOR_TIER_DURATION_PRESETS)[number], number>;
};

export function getSponsorScaleTier(id: SponsorScaleTierId): SponsorScaleTier {
  const tier = SPONSOR_SCALE_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown sponsor scale tier: ${id}`);
  return tier;
}

export function computeTierActive30dUsers(tier: SponsorScaleTier): number {
  return Math.round(tier.registeredUsers * tier.active30dRate);
}

export function computeTierExposedUsers(
  tier: SponsorScaleTier,
  placement: SponsorPlacement
): number {
  const active = computeTierActive30dUsers(tier);
  const penetration = SPONSOR_PLACEMENT_PENETRATION[placement];
  return Math.round(active * penetration);
}

export function computeTierCampaignPriceEur(opts: {
  tierId: SponsorScaleTierId;
  placement: SponsorPlacement;
  displayDays: number;
}): number {
  const tier = getSponsorScaleTier(opts.tierId);
  const exposed = computeTierExposedUsers(tier, opts.placement);
  const days = Math.max(1, Math.floor(opts.displayDays));
  const cpm = SPONSOR_TIER_CPM[opts.tierId][opts.placement];
  return (exposed * days * cpm) / 1000;
}

export function computeTierPlacementQuotes(tierId: SponsorScaleTierId): SponsorTierPlacementQuote[] {
  const tier = getSponsorScaleTier(tierId);
  const active30dUsers = computeTierActive30dUsers(tier);
  return SPONSOR_PRICING_PLACEMENTS.map((placement) => {
    const penetrationRate = SPONSOR_PLACEMENT_PENETRATION[placement];
    const exposedUsers = Math.round(active30dUsers * penetrationRate);
    const onscenCpmEur = SPONSOR_TIER_CPM[tierId][placement];
    const pricesByDays = Object.fromEntries(
      SPONSOR_TIER_DURATION_PRESETS.map((days) => [
        days,
        (exposedUsers * days * onscenCpmEur) / 1000,
      ])
    ) as SponsorTierPlacementQuote['pricesByDays'];
    return {
      placement,
      tier,
      exposedUsers,
      active30dUsers,
      penetrationRate,
      onscenCpmEur,
      pricesByDays,
    };
  });
}
