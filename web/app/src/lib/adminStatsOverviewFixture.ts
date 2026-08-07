import type { StatsOverviewResponse } from '../types';

/**
 * Overrides acceptés par `adminStatsOverviewFixture` : chaque section est
 * fusionnée avec ses valeurs par défaut (Partial par section), pas remplacée
 * intégralement — d'où un type distinct de `Partial<StatsOverviewResponse>`
 * (qui exigerait des objets de section complets).
 */
export type StatsOverviewFixtureOverrides = {
  generatedAt?: string;
  users?: Partial<StatsOverviewResponse['users']>;
  content?: Partial<StatsOverviewResponse['content']>;
  music?: Partial<StatsOverviewResponse['music']>;
  engagement?: Partial<StatsOverviewResponse['engagement']>;
  community?: Partial<StatsOverviewResponse['community']>;
  moderation?: Partial<StatsOverviewResponse['moderation']>;
  sponsors?: Partial<StatsOverviewResponse['sponsors']>;
  retention?: Partial<StatsOverviewResponse['retention']>;
  monetization?: Partial<StatsOverviewResponse['monetization']>;
  analytics30d?: Partial<StatsOverviewResponse['analytics30d']>;
  topReels?: StatsOverviewResponse['topReels'];
  topSalons?: StatsOverviewResponse['topSalons'];
  topLives?: StatsOverviewResponse['topLives'];
};

/** Jeu minimal pour tests PDF / analyse (champs étendus stats-overview). */
export function adminStatsOverviewFixture(
  overrides?: StatsOverviewFixtureOverrides
): StatsOverviewResponse {
  return {
    generatedAt: overrides?.generatedAt ?? new Date().toISOString(),
    users: {
      total: 1000,
      onlineNow: 50,
      activeToday: 120,
      activeWeek: 400,
      activeMonth: 600,
      newLast7Days: 12,
      newLast30Days: 45,
      inactive30Days: 300,
      withGeoOrCity: 800,
      pendingAccounts: 2,
      blockedAccounts: 1,
      activeTodayLastSeen: 120,
      activeWeekLastSeen: 400,
      activeMonthLastSeen: 600,
      activeTodayTracked: 100,
      activeWeekTracked: 350,
      activeMonthTracked: 520,
      ...(overrides?.users ?? {}),
    },
    content: {
      totalReels: 80,
      activeSalonsNow: 2,
      totalSalonsCreated: 500,
      activeLivesNow: 1,
      totalLivesStarted: 200,
      totalEvents: 30,
      totalUpvotes: 120,
      totalAlbums: 5,
      totalCompositions: 40,
      ...(overrides?.content ?? {}),
    },
    music: {
      compositionUpvotes: 80,
      eventUpvotes: 40,
      compositionPlaysTotal: 5000,
      compositionPlays7d: 400,
      ...(overrides?.music ?? {}),
    },
    engagement: {
      followRelations: 2000,
      usersFollowingSomeone: 400,
      feedPostLikes: 300,
      feedPostComments: 50,
      feedPostFavorites: 100,
      totalMatches: 150,
      reelLikes: 600,
      reelComments: 80,
      directMessages: 9000,
      activeCreatorSubscriptions: 3,
      activePlatformSubscriptions: 1,
      ...(overrides?.engagement ?? {}),
    },
    community: {
      totalStories: 20,
      supportThreadsTotal: 10,
      supportOpen: 2,
      ...(overrides?.community ?? {}),
    },
    moderation: {
      reportsTotal: 5,
      reportsPending: 1,
      ...(overrides?.moderation ?? {}),
    },
    sponsors: {
      total: 8,
      activeNow: 3,
      activeByPlacement: { map_banner: 1, reels_sponsored: 2 },
      impressionsTotal: 10000,
      clicksTotal: 120,
      ctrTotal: 1.2,
      impressions7d: 800,
      clicks7d: 10,
      ctr7d: 1.25,
      impressions30d: 5000,
      clicks30d: 75,
      ctr30d: 1.5,
      byPlacementMetrics: [
        { placement: 'map_banner', impressions30d: 3000, clicks30d: 40, ctr30d: 1.33 },
      ],
      topByImpressions30d: [
        {
          sponsorId: 'sp1',
          sponsorName: 'Demo',
          impressions30d: 2000,
          clicks30d: 30,
          ctr30d: 1.5,
        },
      ],
      ...(overrides?.sponsors ?? {}),
    },
    retention: {
      cohorts: [
        {
          cohortWeek: '2026-W05',
          registered: 10,
          week1Retained: 6,
          week4Retained: 3,
          week1Rate: 60,
          week4Rate: 30,
          week1Mature: true,
          week4Mature: true,
          week1RetainedLogin: 5,
          week4RetainedLogin: 2,
          week1RateLogin: 50,
          week4RateLogin: 20,
        },
      ],
      ...(overrides?.retention ?? {}),
    },
    monetization: {
      estimatedMrrCents: 1500,
      estimatedMrrCreatorCents: 1000,
      estimatedMrrPlatformCents: 500,
      activeSubscriptions: 4,
      activeCreatorSubscriptions: 3,
      activePlatformSubscriptions: 1,
      subscriptionsStripe: 1,
      subscriptionsSimulation: 3,
      tipsMonthCents: 2500,
      tipsAllTimeCents: 12000,
      platformFeesMonthCents: 250,
      platformFeesAllTimeCents: 1200,
      platformRevenueMonthEstimateCents: 750,
      platformRevenueMonthStripeCents: 200,
      platformFeePercent: 10,
      donationsSimulationMode: true,
      stripeMrrCents: 500,
      simulationMrrCents: 1000,
      tipsMonthStripeCents: 0,
      tipsMonthSimulationCents: 2500,
      platformFeesMonthStripeCents: 0,
      stripeReconciledMrrCents: 480,
      stripeReconciledPlatformMrrCents: 480,
      stripeMrrReconcileDeltaCents: -20,
      subscriptionInvoicesPaidMonthCents: 999,
      subscriptionPlatformFeesMonthCents: 50,
      ...(overrides?.monetization ?? {}),
    },
    analytics30d: {
      logins: 3000,
      messagesSent: 800,
      salonsCreated: 20,
      livesStarted: 15,
      reelsViewed: 12000,
      matchesCreated: 10,
      favoritesAdded: 30,
      reelsCreated: 5,
      ...(overrides?.analytics30d ?? {}),
    },
    topReels: overrides?.topReels ?? [
      { id: '1', title: 'Hit', authorId: 'u1', authorName: 'dj', viewCount: 900 },
    ],
    topSalons: overrides?.topSalons ?? [
      { id: 's1', title: 'Salon', hostName: 'Host', listenersCount: 12 },
    ],
    topLives: overrides?.topLives ?? [
      { id: 'l1', title: 'Live', hostName: 'Host', viewersCount: 40 },
    ],
  };
}
