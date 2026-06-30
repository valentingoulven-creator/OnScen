import fs from 'fs';
import path from 'path';
import { db } from '../../models/schema';
import { getMsdevDir, getRepoRoot } from '../../paths';
import { getAnalyticsSummary } from '../analytics';
import { readAllContentReports } from '../contentReports';
import { getDonationsSummaryReport } from '../donationsSummary';
import { getCloudflareUsageReport } from '../cloudflareUsage';
import { isPublisherConfigComplete } from '../legalPublisher';
import { isDonationSimulationMode } from '../donations';
import {
  computeCeoDataGaps,
  loadCeoFounderContext,
  type CeoDataGap,
} from './ceoFounderContext';
import { getCeoStrategicKnowledge } from './ceoStrategicKnowledge';
import { AI_AGENTS } from './agents';
import { computeAiTeamRecommendations } from './ceoAiTeamRecommendations';

function readRecentModifications(maxLines = 60): string[] {
  const candidates = [
    path.join(getRepoRoot(), 'modification.txt'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      return lines.slice(-maxLines).filter((l) => l.trim().length > 0);
    } catch {
      continue;
    }
  }
  return [];
}

function sponsorSummary() {
  const now = Date.now();
  const sponsors = db.sponsors ?? [];
  const active = sponsors.filter((s) => {
    if (s.active === false) return false;
    if (s.startsAt && s.startsAt > now) return false;
    if (s.endsAt && s.endsAt < now) return false;
    return true;
  });
  const byPlacement: Record<string, number> = {};
  for (const s of active) {
    const p = s.placement ?? 'unknown';
    byPlacement[p] = (byPlacement[p] ?? 0) + 1;
  }
  return {
    total: sponsors.length,
    activeCampaigns: active.length,
    paidKind: active.filter((s) => s.kind === 'sponsored').length,
    promoKind: active.filter((s) => s.kind === 'promo').length,
    byPlacement,
  };
}

function subscriptionSummary() {
  const subs = db.creatorSubscriptions ?? [];
  const active = subs.filter((s) => s.status === 'active');
  return { total: subs.length, active: active.length };
}

export interface CeoContextMeta {
  dataGaps: CeoDataGap[];
  founderContextLoaded: boolean;
  founderContextPath: string | null;
  founderContextExample: string;
  aiTeam?: import('./ceoAiTeamRecommendations').AiTeamRecruitmentAnalysis;
}

export function buildCeoContextMeta(): CeoContextMeta {
  const { context, loadedFrom } = loadCeoFounderContext();
  const msdevDir = getMsdevDir();
  const dataGaps = computeCeoDataGaps(context, {
    legalPublisherComplete: isPublisherConfigComplete(),
    totalUsers: db.users.size,
    simulationDonations: isDonationSimulationMode(),
  });
  const sponsors = sponsorSummary();
  const aiTeam = computeAiTeamRecommendations(context, {
    totalUsers: db.users.size,
    activeSponsorCampaigns: sponsors.activeCampaigns,
    totalSponsors: sponsors.total,
    legalPublisherComplete: isPublisherConfigComplete(),
    simulationDonations: isDonationSimulationMode(),
    creatorSubscriptionsActive: subscriptionSummary().active,
    pendingReports: readAllContentReports().filter(
      (r) => (r as { status?: string }).status !== 'reviewed' && (r as { status?: string }).status !== 'dismissed'
    ).length,
    openSupportTickets: db.supportContactMessages.filter((m) => m.status === 'open').length,
    activeLives: [...db.lives.values()].filter((l) => l.isActive).length,
    totalSalons: db.salons.size,
    cloudflareCostEur: null,
    redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    dataGaps,
  });
  return {
    dataGaps,
    founderContextLoaded: Boolean(context),
    founderContextPath: loadedFrom,
    founderContextExample: path.join(msdevDir, 'ceo-founder-context.example.json'),
    aiTeam,
  };
}

/** Contexte CEO IA complet (Tang Yu) — async pour Cloudflare usage. */
export async function buildCeoDataContext(): Promise<string> {
  const analyticsWeek = getAnalyticsSummary('week', 'fr-FR');
  const analyticsMonth = getAnalyticsSummary('month', 'fr-FR');
  const donations = getDonationsSummaryReport();
  const { context: founderContext, loadedFrom } = loadCeoFounderContext();
  const meta = buildCeoContextMeta();

  let cloudflare: Awaited<ReturnType<typeof getCloudflareUsageReport>> | null = null;
  try {
    cloudflare = await getCloudflareUsageReport();
  } catch {
    cloudflare = null;
  }

  const openReports = readAllContentReports().filter(
    (r) => (r as { status?: string }).status !== 'reviewed' && (r as { status?: string }).status !== 'dismissed'
  ).length;

  const sponsors = sponsorSummary();
  const subs = subscriptionSummary();
  const aiTeamRecruitment = computeAiTeamRecommendations(founderContext, {
    totalUsers: db.users.size,
    activeSponsorCampaigns: sponsors.activeCampaigns,
    totalSponsors: sponsors.total,
    legalPublisherComplete: isPublisherConfigComplete(),
    simulationDonations: isDonationSimulationMode(),
    creatorSubscriptionsActive: subs.active,
    pendingReports: openReports,
    openSupportTickets: db.supportContactMessages.filter((m) => m.status === 'open').length,
    activeLives: [...db.lives.values()].filter((l) => l.isActive).length,
    totalSalons: db.salons.size,
    cloudflareCostEur: cloudflare?.estimatedCostEur?.total ?? null,
    redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    dataGaps: meta.dataGaps,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    role: 'CEO IA Soundy — exécutif virtuel type Tang Yu (NetDragon)',
    mission:
      'Faire évoluer Soundy : stratégie, finances, GTM, priorités produit, path to scale — avec données + questions au fondateur.',
    liveMetrics: {
      analyticsSnapshot: analyticsWeek.snapshot,
      analyticsWeekSeries: analyticsWeek.series,
      analyticsMonthSnapshot: analyticsMonth.snapshot,
      periodWeek: analyticsWeek.period,
    },
    revenue: {
      donations: {
        simulationMode: donations.simulationMode,
        platformFeePercent: donations.platformFeePercent,
        allTime: donations.allTime,
        thisMonth: donations.thisMonth,
      },
      creatorSubscriptions: subscriptionSummary(),
      sponsors: sponsorSummary(),
    },
    costs: {
      infraFixedEurEstimate: '41–45/mois',
      cloudflare: cloudflare
        ? {
            configured: cloudflare.configured,
            estimatedCostEur: cloudflare.estimatedCostEur?.total ?? null,
            estimatedCostUsd: cloudflare.estimatedCostUsd?.total ?? null,
            minutesDelivered: cloudflare.minutesDelivered,
            liveInputsActive: cloudflare.liveInputsActive,
          }
        : { configured: false, note: 'API Cloudflare indisponible ou non configurée' },
    },
    moderation: {
      pendingReports: openReports,
      openSupportTickets: db.supportContactMessages.filter((m) => m.status === 'open').length,
      blockedUsers: [...db.users.values()].filter((u) => u.accountStatus === 'blocked').length,
    },
    platform: {
      totalUsers: db.users.size,
      adminAccounts: [...db.users.values()].filter((u) => u.isAdmin).length,
      totalSalons: db.salons.size,
      activeLives: [...db.lives.values()].filter((l) => l.isActive).length,
      totalReels: db.userReels.length,
      totalFeedPosts: db.feedPosts.length,
      env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
      scaleStack: {
        redis: Boolean(process.env.REDIS_URL?.trim()),
        s3Uploads: Boolean(process.env.S3_BUCKET?.trim()),
        pm2Cluster: true,
      },
    },
    strategicKnowledge: getCeoStrategicKnowledge(),
    aiTeamRoster: AI_AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      emoji: a.emoji,
    })),
    aiTeamRecommendations: aiTeamRecruitment,
    founderContext: founderContext ?? {
      _note:
        'FICHIER MANQUANT — demander au fondateur de remplir commun/msdev/ceo-founder-context.json (voir .example)',
    },
    founderContextLoadedFrom: loadedFrom,
    dataGaps: meta.dataGaps,
    dataGapsCount: {
      critical: meta.dataGaps.filter((g) => g.severity === 'critical').length,
      high: meta.dataGaps.filter((g) => g.severity === 'high').length,
    },
    recentProductChanges: readRecentModifications(50),
    todoManualTopPriorities: [
      'CRIT-01 JWT httpOnly cookies',
      'C1 IAP Apple/Google (stores)',
      'C3 Sign in with Apple',
      'C6 Mentions légales LCEN',
      'C10 Onboarding 9→3 étapes',
    ],
  };

  return JSON.stringify(payload, null, 2);
}
