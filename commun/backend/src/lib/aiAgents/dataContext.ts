import { db } from '../../models/schema';
import { getAnalyticsSummary } from '../analytics';
import { readAllContentReports } from '../contentReports';
import { getDonationsSummaryReport } from '../donationsSummary';

/** Contexte JSON compact injecté dans le system prompt des agents admin. */
export function buildAiDataContext(): string {
  const analytics = getAnalyticsSummary('week', 'fr-FR');
  const donations = getDonationsSummaryReport();

  const openReports = readAllContentReports().filter(
    (r) => (r as ContentReportWithStatus).status !== 'reviewed' && (r as ContentReportWithStatus).status !== 'dismissed'
  ).length;
  const openSupport = db.supportContactMessages.filter((m) => m.status === 'open').length;
  const blockedUsers = [...db.users.values()].filter((u) => u.accountStatus === 'blocked').length;
  const adminCount = [...db.users.values()].filter((u) => u.isAdmin).length;

  const priorities = [
    'CRIT-01 JWT → cookies httpOnly (XSS)',
    'C1 IAP Apple/Google (rejet stores si Stripe in-app)',
    'C3 Sign in with Apple obligatoire avec Google OAuth',
    'C6 Mentions légales LCEN (SIREN, DPO)',
    'ELEV-01 Révocation JWT',
  ];

  const payload = {
    product: 'OnScen — réseau social musique live (onscen.com)',
    analytics: analytics.snapshot,
    analyticsPeriod: analytics.period,
    donations: {
      simulationMode: donations.simulationMode,
      allTimeCents: donations.allTime.totalDonationsCents,
      platformFeesCents: donations.allTime.platformFeesCents,
      count: donations.allTime.count,
      thisMonthCents: donations.thisMonth.totalDonationsCents,
    },
    moderation: {
      pendingReports: openReports,
      openSupportTickets: openSupport,
      blockedUsers,
    },
    platform: {
      adminAccounts: adminCount,
      totalUsers: db.users.size,
      activeLives: [...db.lives.values()].filter((l) => l.isActive).length,
      totalSalons: db.salons.size,
    },
    todoManualPriorities: priorities,
  };

  return JSON.stringify(payload, null, 2);
}

interface ContentReportWithStatus {
  status?: string;
}
