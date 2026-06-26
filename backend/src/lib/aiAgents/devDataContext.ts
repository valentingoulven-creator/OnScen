import fs from 'fs';
import path from 'path';
import { db } from '../../models/schema';
import { getAnalyticsSummary } from '../analytics';
import { readAllContentReports } from '../contentReports';
import { getDonationsSummaryReport } from '../donationsSummary';
import { isPublisherConfigComplete } from '../legalPublisher';
import { getDevTechnicalKnowledge } from './devTechnicalKnowledge';

function repoRoot(): string {
  return path.resolve(__dirname, '../../../..');
}

function readRepoFile(relPath: string, maxChars = 12000): string | null {
  const file = path.join(repoRoot(), relPath);
  if (!fs.existsSync(file)) return null;
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length > maxChars ? text.slice(0, maxChars) + '\n…(tronqué)' : text;
  } catch {
    return null;
  }
}

function readRecentModifications(maxLines = 80): string[] {
  const candidates = [
    path.join(repoRoot(), 'modification.txt'),
    path.resolve(__dirname, '../../../modification.txt'),
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

function infraFlags() {
  return {
    redis: Boolean(process.env.REDIS_URL?.trim()),
    s3Uploads: Boolean(process.env.S3_BUCKET?.trim()),
    sightengine: Boolean(
      process.env.SIGHTENGINE_API_USER?.trim() && process.env.SIGHTENGINE_API_SECRET?.trim()
    ),
    acrCloud: Boolean(
      process.env.ACRCLOUD_ACCESS_KEY?.trim() && process.env.ACRCLOUD_ACCESS_SECRET?.trim()
    ),
    livekit: Boolean(process.env.LIVEKIT_URL?.trim() && process.env.LIVEKIT_API_KEY?.trim()),
    cloudflareStream: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()),
    stripeDonations: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    anthropicAgents: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    openaiAgents: Boolean(process.env.OPENAI_API_KEY?.trim()),
    legalPublisherComplete: isPublisherConfigComplete(),
    appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
  };
}

function computeTechDebtSignals(flags: ReturnType<typeof infraFlags>) {
  const signals: Array<{ id: string; severity: string; message: string }> = [];

  if (!flags.redis) {
    signals.push({
      id: 'no_redis',
      severity: 'medium',
      message: 'REDIS_URL absent — Socket.io mono-process, rate limits locaux',
    });
  }
  if (!flags.s3Uploads) {
    signals.push({
      id: 'no_s3',
      severity: 'medium',
      message: 'S3_BUCKET absent — uploads sur disque VPS (scale limité)',
    });
  }
  if (!flags.legalPublisherComplete) {
    signals.push({
      id: 'lcen_incomplete',
      severity: 'high',
      message: 'legal-publisher / LEGAL_PUBLISHER_ADDRESS incomplet — LCEN',
    });
  }
  if (!flags.acrCloud) {
    signals.push({
      id: 'no_acrcloud',
      severity: 'medium',
      message: 'ACRCloud non configuré — uploads audio sans scan catalogue',
    });
  }
  if (!flags.sightengine) {
    signals.push({
      id: 'no_sightengine',
      severity: 'high',
      message: 'Sightengine absent — modération UGC fail-closed en prod',
    });
  }

  signals.push({
    id: 'crit01_jwt',
    severity: 'critical',
    message: 'CRIT-01 : JWT en localStorage — migration httpOnly cookies requise',
  });
  signals.push({
    id: 'c1_iap',
    severity: 'critical',
    message: 'C1 : IAP Apple/Google requis pour stores — Stripe in-app = rejet',
  });
  signals.push({
    id: 'c3_apple_signin',
    severity: 'critical',
    message: 'C3 : Sign in with Apple obligatoire si Google OAuth sur iOS',
  });

  return signals;
}

/** Contexte Dev Agent complet — données live + docs repo + catalogue innovation. */
export async function buildDevDataContext(): Promise<string> {
  const analyticsWeek = getAnalyticsSummary('week', 'fr-FR');
  const analyticsMonth = getAnalyticsSummary('month', 'fr-FR');
  const donations = getDonationsSummaryReport();
  const flags = infraFlags();

  const openReports = readAllContentReports().filter(
    (r) => (r as { status?: string }).status !== 'reviewed' && (r as { status?: string }).status !== 'dismissed'
  ).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    role: 'Dev Agent Soundy — staff engineer + innovateur produit',
    mission:
      'Proposer, challenger, planifier : sécurité, scale, mobile, UX, features différenciantes — avec plans exécutables.',
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
        allTimeCents: donations.allTime.totalDonationsCents,
        thisMonthCents: donations.thisMonth.totalDonationsCents,
        count: donations.allTime.count,
      },
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
      totalCompositions: db.compositions.length,
      totalFeedPosts: db.feedPosts.length,
    },
    infrastructure: flags,
    techDebtSignals: computeTechDebtSignals(flags),
    technicalKnowledge: getDevTechnicalKnowledge(),
    todoManualExcerpt: readRepoFile('TODO-MANUAL.md', 10000),
    stackCibleExcerpt: readRepoFile('docs/STACK-CIBLE.md', 6000),
    recentProductChanges: readRecentModifications(80),
    docsPointers: [
      'docs/STACK-CIBLE.md',
      'docs/INFRA-SOUNDY.md',
      'docs/ENVIRONNEMENTS.md',
      'msdev/SCALABILITY.md',
      'TODO-MANUAL.md',
      'AGENTS.md',
    ],
  };

  return JSON.stringify(payload, null, 2);
}
