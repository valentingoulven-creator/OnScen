import { db } from '../models/schema';
import type { Sponsor } from '../models/schema';
import { readAllContentReports } from './contentReports';
import { getReelViews } from './reels';
import { countActiveUsersSince, getEventTotalAllTime, sumEventsLastNDays, countTrackedActiveUsersSince } from './analytics';
import { getMonetizationSummary, type MonetizationSummary } from './monetizationSummary';
import { getSponsorAnalyticsSummary } from './sponsorAnalytics';
import { getRetentionCohortRows, type RetentionCohortRow } from './retentionCohorts';
import { getIo } from './ioInstance';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatsTopReel {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  viewCount: number;
}

export interface StatsTopSalon {
  id: string;
  title: string;
  hostName: string;
  listenersCount: number;
}

export interface StatsTopLive {
  id: string;
  title: string;
  hostName: string;
  viewersCount: number;
}

export interface StatsOverviewResponse {
  generatedAt: string;
  users: {
    total: number;
    onlineNow: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    newLast7Days: number;
    newLast30Days: number;
    inactive30Days: number;
    withGeoOrCity: number;
    pendingAccounts: number;
    blockedAccounts: number;
    /** lastSeenAt > cutoff */
    activeTodayLastSeen: number;
    activeWeekLastSeen: number;
    activeMonthLastSeen: number;
    /** trackEvent / trackUserActive (dauMap) */
    activeTodayTracked: number;
    activeWeekTracked: number;
    activeMonthTracked: number;
  };
  content: {
    totalReels: number;
    activeSalonsNow: number;
    totalSalonsCreated: number;
    activeLivesNow: number;
    totalLivesStarted: number;
    totalEvents: number;
    totalUpvotes: number;
    totalAlbums: number;
    totalCompositions: number;
  };
  music: {
    compositionUpvotes: number;
    eventUpvotes: number;
    compositionPlaysTotal: number;
    compositionPlays7d: number;
  };
  engagement: {
    followRelations: number;
    usersFollowingSomeone: number;
    feedPostLikes: number;
    feedPostComments: number;
    feedPostFavorites: number;
    totalMatches: number;
    reelLikes: number;
    reelComments: number;
    directMessages: number;
    activeCreatorSubscriptions: number;
    activePlatformSubscriptions: number;
  };
  community: {
    totalStories: number;
    supportThreadsTotal: number;
    supportOpen: number;
  };
  moderation: {
    reportsTotal: number;
    reportsPending: number;
  };
  sponsors: {
    total: number;
    activeNow: number;
    activeByPlacement: Record<string, number>;
    impressionsTotal: number;
    clicksTotal: number;
    ctrTotal: number;
    impressions7d: number;
    clicks7d: number;
    ctr7d: number;
    impressions30d: number;
    clicks30d: number;
    ctr30d: number;
    byPlacementMetrics: {
      placement: string;
      impressions30d: number;
      clicks30d: number;
      ctr30d: number;
    }[];
    topByImpressions30d: {
      sponsorId: string;
      sponsorName: string;
      impressions30d: number;
      clicks30d: number;
      ctr30d: number;
    }[];
  };
  retention: {
    cohorts: RetentionCohortRow[];
  };
  monetization: MonetizationSummary;
  analytics30d: {
    logins: number;
    messagesSent: number;
    salonsCreated: number;
    livesStarted: number;
    reelsViewed: number;
    matchesCreated: number;
    favoritesAdded: number;
    reelsCreated: number;
  };
  topReels: StatsTopReel[];
  topSalons: StatsTopSalon[];
  topLives: StatsTopLive[];
}

function countOnlineUsersNow(): number {
  const io = getIo();
  if (!io) return 0;
  let count = 0;
  for (const roomName of io.sockets.adapter.rooms.keys()) {
    if (typeof roomName === 'string' && roomName.startsWith('user_')) count += 1;
  }
  return count;
}

function userRegisteredAtMs(user: { memberSince?: number; acceptedTermsAt?: number; ageConfirmedAt?: number }): number {
  return user.memberSince ?? user.acceptedTermsAt ?? user.ageConfirmedAt ?? 0;
}

function topReelsByViews(limit: number): StatsTopReel[] {
  return [...db.userReels]
    .filter((reel) => !reel.adminBlocked)
    .map((reel) => {
      const author = db.users.get(reel.authorId);
      return {
        id: reel.id,
        title: reel.title || '—',
        authorId: reel.authorId,
        authorName: author?.username ?? '—',
        viewCount: getReelViews(reel.id).size,
      };
    })
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

function topSalonsByListeners(limit: number): StatsTopSalon[] {
  return [...db.salons.values()]
    .filter((salon) => !salon.adminBlocked)
    .map((salon) => ({
      id: salon.id,
      title: salon.title || '—',
      hostName: salon.hostName,
      listenersCount: salon.listenersCount ?? 0,
    }))
    .sort((a, b) => b.listenersCount - a.listenersCount)
    .slice(0, limit);
}

function topLivesByViewers(limit: number): StatsTopLive[] {
  return [...db.lives.values()]
    .filter((live) => live.isActive)
    .map((live) => ({
      id: live.id,
      title: live.title || '—',
      hostName: live.hostName,
      viewersCount: live.viewersCount ?? 0,
    }))
    .sort((a, b) => b.viewersCount - a.viewersCount)
    .slice(0, limit);
}

function countTotalEvents(): number {
  let count = 0;
  for (const post of db.feedPosts) {
    if (post.isEvent) count += 1;
  }
  return count;
}

function countEventUpvotes(): number {
  let total = 0;
  for (const voters of db.feedPostUpvotes.values()) {
    total += voters.size;
  }
  return total;
}

function countMapSetSizes(map: Map<string, Set<string>>): number {
  let total = 0;
  for (const set of map.values()) total += set.size;
  return total;
}

function countMapArrayLengths<T>(map: Map<string, T[]>): number {
  let total = 0;
  for (const arr of map.values()) total += arr.length;
  return total;
}

function isSponsorActiveNow(sponsor: Sponsor, now: number): boolean {
  if (!sponsor.active) return false;
  if (sponsor.startsAt != null && now < sponsor.startsAt) return false;
  if (sponsor.endsAt != null && now > sponsor.endsAt) return false;
  return true;
}

function countModerationReports(): { total: number; pending: number } {
  const reports = readAllContentReports();
  let pending = 0;
  for (const raw of reports) {
    const status = (raw as { status?: string }).status;
    if (!status || (status !== 'reviewed' && status !== 'dismissed')) pending += 1;
  }
  return { total: reports.length, pending };
}

function buildAnalytics30d(): StatsOverviewResponse['analytics30d'] {
  const logins =
    sumEventsLastNDays('user_login', 30) +
    sumEventsLastNDays('user_login_oauth', 30) +
    sumEventsLastNDays('user_login_biometric', 30);
  return {
    logins,
    messagesSent: sumEventsLastNDays('message_sent', 30),
    salonsCreated: sumEventsLastNDays('salon_created', 30),
    livesStarted: sumEventsLastNDays('live_started', 30),
    reelsViewed: sumEventsLastNDays('reel_viewed', 30),
    matchesCreated: sumEventsLastNDays('match_created', 30),
    favoritesAdded: sumEventsLastNDays('favorite_added', 30),
    reelsCreated: sumEventsLastNDays('reel_created', 30),
  };
}

/**
 * Synthèse admin : audience, contenus, engagement, modération, sponsors,
 * activité 30 j (buckets analytics) et classements temps réel.
 */
export function getStatsOverview(topLimit = 10): StatsOverviewResponse {
  const now = Date.now();
  const cutoff7 = now - 7 * DAY_MS;
  const cutoff30 = now - 30 * DAY_MS;

  let newLast7Days = 0;
  let newLast30Days = 0;
  let inactive30Days = 0;
  let withGeoOrCity = 0;
  let pendingAccounts = 0;
  let blockedAccounts = 0;

  for (const user of db.users.values()) {
    const registeredAt = userRegisteredAtMs(user);
    if (registeredAt >= cutoff7) newLast7Days += 1;
    if (registeredAt >= cutoff30) newLast30Days += 1;
    if (user.lastSeenAt < cutoff30) inactive30Days += 1;
    if (user.city?.trim() || (user.latitude != null && user.longitude != null)) withGeoOrCity += 1;
    if (user.accountStatus === 'pending') pendingAccounts += 1;
    if (user.accountStatus === 'blocked') blockedAccounts += 1;
  }

  const eventUpvotes = countEventUpvotes();
  const compositionUpvotes = db.compositionUpvotes.length;
  const compositionPlays7d = db.compositionPlays.filter((p) => p.playedAt >= cutoff7).length;

  let followRelations = 0;
  let usersFollowingSomeone = 0;
  for (const follows of db.userFollows.values()) {
    if (follows.size > 0) {
      usersFollowingSomeone += 1;
      followRelations += follows.size;
    }
  }

  const activeSubs = db.creatorSubscriptions.filter((s) => s.status === 'active');
  const activeCreatorSubscriptions = activeSubs.filter((s) => s.targetType === 'creator').length;
  const activePlatformSubscriptions = activeSubs.filter((s) => s.targetType === 'platform').length;

  const supportOpen = db.supportContactMessages.filter(
    (m) => m.status === 'open' || m.status === 'replied'
  ).length;

  const activeSponsors = db.sponsors.filter((s) => isSponsorActiveNow(s, now));
  const activeByPlacement: Record<string, number> = {};
  for (const s of activeSponsors) {
    activeByPlacement[s.placement] = (activeByPlacement[s.placement] ?? 0) + 1;
  }

  const moderation = countModerationReports();
  const sponsorMetrics = getSponsorAnalyticsSummary(topLimit);

  return {
    generatedAt: new Date(now).toISOString(),
    users: {
      total: db.users.size,
      onlineNow: countOnlineUsersNow(),
      activeToday: countActiveUsersSince(now - DAY_MS),
      activeWeek: countActiveUsersSince(now - 7 * DAY_MS),
      activeMonth: countActiveUsersSince(now - 30 * DAY_MS),
      newLast7Days,
      newLast30Days,
      inactive30Days,
      withGeoOrCity,
      pendingAccounts,
      blockedAccounts,
      activeTodayLastSeen: countActiveUsersSince(now - DAY_MS),
      activeWeekLastSeen: countActiveUsersSince(now - 7 * DAY_MS),
      activeMonthLastSeen: countActiveUsersSince(now - 30 * DAY_MS),
      activeTodayTracked: countTrackedActiveUsersSince(now - DAY_MS),
      activeWeekTracked: countTrackedActiveUsersSince(now - 7 * DAY_MS),
      activeMonthTracked: countTrackedActiveUsersSince(now - 30 * DAY_MS),
    },
    content: {
      totalReels: db.userReels.length,
      activeSalonsNow: db.salons.size,
      totalSalonsCreated: getEventTotalAllTime('salon_created'),
      activeLivesNow: [...db.lives.values()].filter((live) => live.isActive).length,
      totalLivesStarted: getEventTotalAllTime('live_started'),
      totalEvents: countTotalEvents(),
      totalUpvotes: compositionUpvotes + eventUpvotes,
      totalAlbums: db.albums.length,
      totalCompositions: db.compositions.length,
    },
    music: {
      compositionUpvotes,
      eventUpvotes,
      compositionPlaysTotal: db.compositionPlays.length,
      compositionPlays7d,
    },
    engagement: {
      followRelations,
      usersFollowingSomeone,
      feedPostLikes: countMapSetSizes(db.feedPostLikes),
      feedPostComments: countMapArrayLengths(db.feedPostComments),
      feedPostFavorites: countMapSetSizes(db.feedPostFavorites),
      totalMatches: db.matches.length,
      reelLikes: countMapSetSizes(db.reelLikes),
      reelComments: countMapArrayLengths(db.reelComments),
      directMessages: db.directMessages.length,
      activeCreatorSubscriptions,
      activePlatformSubscriptions,
    },
    community: {
      totalStories: db.stories.length,
      supportThreadsTotal: db.supportContactMessages.length,
      supportOpen,
    },
    moderation: {
      reportsTotal: moderation.total,
      reportsPending: moderation.pending,
    },
    sponsors: {
      total: db.sponsors.length,
      activeNow: activeSponsors.length,
      activeByPlacement,
      impressionsTotal: sponsorMetrics.impressionsTotal,
      clicksTotal: sponsorMetrics.clicksTotal,
      ctrTotal: sponsorMetrics.ctrTotal,
      impressions7d: sponsorMetrics.impressions7d,
      clicks7d: sponsorMetrics.clicks7d,
      ctr7d: sponsorMetrics.ctr7d,
      impressions30d: sponsorMetrics.impressions30d,
      clicks30d: sponsorMetrics.clicks30d,
      ctr30d: sponsorMetrics.ctr30d,
      byPlacementMetrics: sponsorMetrics.byPlacement.map((r) => ({
        placement: r.placement,
        impressions30d: r.impressions30d,
        clicks30d: r.clicks30d,
        ctr30d: r.ctr30d,
      })),
      topByImpressions30d: sponsorMetrics.topSponsors30d,
    },
    retention: {
      cohorts: getRetentionCohortRows(12),
    },
    monetization: getMonetizationSummary(now),
    analytics30d: buildAnalytics30d(),
    topReels: topReelsByViews(topLimit),
    topSalons: topSalonsByListeners(topLimit),
    topLives: topLivesByViewers(topLimit),
  };
}
