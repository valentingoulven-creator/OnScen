import { describe, expect, it } from 'vitest';
import { statsOverviewToCsv, adminReportBundleToCsv } from './adminStatsCsvExport';
import { adminStatsOverviewFixture } from './adminStatsOverviewFixture';

describe('adminStatsCsvExport', () => {
  it('includes monetization and retention rows', () => {
    const csv = statsOverviewToCsv(adminStatsOverviewFixture());
    expect(csv).toContain('monetization,stripeMrrCents');
    expect(csv).toContain('s1login=');
  });

  it('appends dev sections for full bundle', () => {
    const csv = adminReportBundleToCsv({
      generatedAt: new Date().toISOString(),
      scope: 'full',
      platform: adminStatsOverviewFixture(),
      partialErrors: [],
      activity: {
        period: 'month',
        snapshot: {
          totalUsers: 1,
          dau24h: 1,
          dau24hTracked: 1,
          dau30d: 1,
          dau30dTracked: 1,
          newUsersToday: 0,
          activeSalons: 0,
          activeLives: 0,
          totalMessages: 0,
          totalReels: 0,
          totalMatches: 0,
          totalFeedPosts: 0,
        },
        series: {
          labels: [],
          logins: [],
          messagesSent: [],
          salonsCreated: [],
          livesStarted: [],
          reelsViewed: [],
          matchesCreated: [],
          favoritesAdded: [],
        },
      },
    });
    expect(csv).toContain('dev.activity.snapshot,totalUsers');
  });
});
