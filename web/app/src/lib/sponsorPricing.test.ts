import { describe, it, expect } from 'vitest';
import {
  computeSponsorCampaignPriceEur,
  computeTierCampaignPriceEur,
  computeTierExposedUsers,
  computeTierPlacementQuotes,
  getSponsorScaleTier,
} from './sponsorPricing';

describe('sponsorPricing', () => {
  it('calcule le prix Soundy et la fourchette benchmark', () => {
    const quote = computeSponsorCampaignPriceEur({
      placement: 'reels_sponsored',
      audienceUsers: 10_000,
      displayDays: 7,
    });
    expect(quote.impressions).toBe(70_000);
    expect(quote.soundyPriceEur).toBeCloseTo(315, 0);
    expect(quote.benchmarkPriceMinEur).toBeCloseTo(210, 0);
    expect(quote.benchmarkPriceMaxEur).toBeCloseTo(630, 0);
  });

  it('projette les utilisateurs exposés au palier 50 K (Carte · Sponso)', () => {
    const tier = getSponsorScaleTier('50k');
    const exposed = computeTierExposedUsers(tier, 'map_sidebar_events');
    expect(exposed).toBe(6_000);
  });

  it('calcule le prix palier 50 K · Sponso · 7 j (memo CTO ~150 €)', () => {
    const price = computeTierCampaignPriceEur({
      tierId: '50k',
      placement: 'map_sidebar_events',
      displayDays: 7,
    });
    expect(price).toBeCloseTo(147, 0);
  });

  it('retourne les prix 7 / 14 / 30 j pour chaque emplacement', () => {
    const rows = computeTierPlacementQuotes('50k');
    expect(rows).toHaveLength(7);
    const sidebar = rows.find((r) => r.placement === 'map_sidebar_events');
    expect(sidebar?.pricesByDays[7]).toBeCloseTo(147, 0);
    expect(sidebar?.pricesByDays[14]).toBeCloseTo(294, 0);
    expect(sidebar?.pricesByDays[30]).toBeCloseTo(630, 0);
  });
});
