import { describe, expect, it } from 'vitest';
import { buildExecutiveReportAnalysis } from './adminReportAnalysis';
import type { AdminReportBundle } from './adminReportFetch';
import { adminStatsOverviewFixture } from './adminStatsOverviewFixture';

const platform = adminStatsOverviewFixture({
  users: { total: 100, onlineNow: 5, activeToday: 10, activeWeek: 40, activeMonth: 60 },
  content: {
    totalReels: 10,
    activeSalonsNow: 1,
    totalSalonsCreated: 50,
    activeLivesNow: 1,
    totalLivesStarted: 20,
    totalEvents: 5,
    totalUpvotes: 12,
    totalAlbums: 2,
    totalCompositions: 8,
  },
  topReels: [],
  topSalons: [],
  topLives: [],
});

describe('buildExecutiveReportAnalysis', () => {
  it('includes cloudflare and donations when present', () => {
    const bundle: AdminReportBundle = {
      generatedAt: new Date().toISOString(),
      scope: 'full',
      platform,
      partialErrors: [],
      cloudflare: {
        configured: true,
        fetchedAt: new Date().toISOString(),
        periodStart: '',
        periodEnd: '',
        minutesDelivered: 1000,
        minutesDeliveredSource: 'graphql',
        storageMinutes: 100,
        storageMinutesSource: 'videos_api',
        liveInputsTotal: 1,
        liveInputsActive: 1,
        estimatedCostUsd: { delivery: 1, storage: 0.5, total: 1.5 },
        estimatedCostEur: { delivery: 0.9, storage: 0.45, total: 1.35 },
        usdToEurRate: 0.9,
        warnings: [],
      },
      donations: {
        fetchedAt: new Date().toISOString(),
        platformFeePercent: 10,
        paymentTermsDocKey: '',
        simulationMode: true,
        allTime: {
          totalDonationsCents: 5000,
          platformFeesCents: 500,
          creatorPayoutsCents: 4500,
          count: 3,
          simulationCount: 3,
          stripeCount: 0,
        },
        thisMonth: {
          totalDonationsCents: 1000,
          platformFeesCents: 100,
          creatorPayoutsCents: 900,
          count: 1,
          simulationCount: 1,
          stripeCount: 0,
        },
      },
    };
    const lines = buildExecutiveReportAnalysis(bundle, 'fr');
    expect(lines.some((l) => l.includes('Cloudflare'))).toBe(true);
    expect(lines.some((l) => l.includes('Pourboires'))).toBe(true);
  });
});
