import type { jsPDF } from 'jspdf';
import type { StatsOverviewResponse } from '../types';
import type { AdminFullReportPdfLabels } from './adminFullReportPdf';
import { buildAdminStatsAnalysis } from './adminStatsPdfExport';
import {
  createPdfDoc,
  drawReportCover,
  fmtEuro,
  fmtNum,
  pdfAddFooters,
  pdfAutoTablePreset,
  pdfBeginContentPage,
  pdfInsightBlock,
  pdfKpiGrid,
  pdfNumericColumnStyles,
  pdfSectionTitle,
  pdfTableMargins,
  PDF_LAYOUT,
  type PdfDocWithTable,
} from './adminPdfCommon';

export type StatsPresentationCover = {
  title: string;
  subtitle: string;
  generatedAtLabel: string;
  scopeLine: string;
  confidential: string;
};

/** Corps du rapport stats (tableaux + classements) — réutilisé par le PDF complet. */
export function appendPlatformStatsPresentation(
  doc: jsPDF,
  startY: number,
  margin: number,
  maxW: number,
  data: StatsOverviewResponse,
  labels: AdminFullReportPdfLabels,
  locale: string,
  autoTable: (doc: jsPDF, options: Record<string, unknown>) => void
): number {
  let y = startY;
  const mon = data.monetization;
  const tableOpts = (fontSize: number, numericCols: number[] = [1]) => ({
    margin: pdfTableMargins(),
    ...pdfAutoTablePreset(fontSize),
    columnStyles: pdfNumericColumnStyles(numericCols),
  });

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionPlatform);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.usersTotal, fmtNum(data.users.total, locale)],
      [labels.usersOnlineNow, fmtNum(data.users.onlineNow, locale)],
      [labels.usersActiveToday, fmtNum(data.users.activeToday, locale)],
      [labels.usersActiveWeek, fmtNum(data.users.activeWeek, locale)],
      [labels.usersActiveMonth, fmtNum(data.users.activeMonth, locale)],
      [labels.usersActiveTodayLastSeen, fmtNum(data.users.activeTodayLastSeen, locale)],
      [labels.usersActiveTodayTracked, fmtNum(data.users.activeTodayTracked, locale)],
      [labels.usersNew7d, fmtNum(data.users.newLast7Days, locale)],
      [labels.usersNew30d, fmtNum(data.users.newLast30Days, locale)],
      [labels.usersInactive30d, fmtNum(data.users.inactive30Days, locale)],
      [labels.usersWithGeo, fmtNum(data.users.withGeoOrCity, locale)],
      [labels.usersPending, fmtNum(data.users.pendingAccounts, locale)],
      [labels.usersBlocked, fmtNum(data.users.blockedAccounts, locale)],
      [labels.totalReels, fmtNum(data.content.totalReels, locale)],
      [labels.activeSalonsNow, fmtNum(data.content.activeSalonsNow, locale)],
      [labels.totalSalonsCreated, fmtNum(data.content.totalSalonsCreated, locale)],
      [labels.activeLivesNow, fmtNum(data.content.activeLivesNow, locale)],
      [labels.totalLivesStarted, fmtNum(data.content.totalLivesStarted, locale)],
      [labels.totalEvents, fmtNum(data.content.totalEvents, locale)],
      [labels.totalUpvotes, fmtNum(data.content.totalUpvotes, locale)],
      [labels.totalAlbums, fmtNum(data.content.totalAlbums, locale)],
      [labels.totalCompositions, fmtNum(data.content.totalCompositions, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionMusic);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.compositionUpvotes, fmtNum(data.music.compositionUpvotes, locale)],
      [labels.eventUpvotes, fmtNum(data.music.eventUpvotes, locale)],
      [labels.compositionPlaysTotal, fmtNum(data.music.compositionPlaysTotal, locale)],
      [labels.compositionPlays7d, fmtNum(data.music.compositionPlays7d, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionEngagement);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.followRelations, fmtNum(data.engagement.followRelations, locale)],
      [labels.usersFollowing, fmtNum(data.engagement.usersFollowingSomeone, locale)],
      [labels.feedPostLikes, fmtNum(data.engagement.feedPostLikes, locale)],
      [labels.feedPostComments, fmtNum(data.engagement.feedPostComments, locale)],
      [labels.feedPostFavorites, fmtNum(data.engagement.feedPostFavorites, locale)],
      [labels.totalMatches, fmtNum(data.engagement.totalMatches, locale)],
      [labels.reelLikes, fmtNum(data.engagement.reelLikes, locale)],
      [labels.reelComments, fmtNum(data.engagement.reelComments, locale)],
      [labels.directMessages, fmtNum(data.engagement.directMessages, locale)],
      [labels.activeCreatorSubscriptions, fmtNum(data.engagement.activeCreatorSubscriptions, locale)],
      [labels.activePlatformSubscriptions, fmtNum(data.engagement.activePlatformSubscriptions, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionCommunity);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.totalStories, fmtNum(data.community.totalStories, locale)],
      [labels.supportThreadsTotal, fmtNum(data.community.supportThreadsTotal, locale)],
      [labels.supportOpen, fmtNum(data.community.supportOpen, locale)],
      [labels.reportsTotal, fmtNum(data.moderation.reportsTotal, locale)],
      [labels.reportsPending, fmtNum(data.moderation.reportsPending, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionMonetization);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.mrrEstimated, fmtEuro(mon.estimatedMrrCents / 100, locale)],
      [labels.mrrPlatform, fmtEuro(mon.estimatedMrrPlatformCents / 100, locale)],
      [labels.mrrStripeReconciled, fmtEuro(mon.stripeReconciledMrrCents / 100, locale)],
      [labels.subscriptionInvoicesMonth, fmtEuro(mon.subscriptionInvoicesPaidMonthCents / 100, locale)],
      [labels.tipsMonth, fmtEuro(mon.tipsMonthCents / 100, locale)],
      [labels.platformFeesMonth, fmtEuro(mon.platformFeesMonthCents / 100, locale)],
      [labels.platformRevenueMonth, fmtEuro(mon.platformRevenueMonthEstimateCents / 100, locale)],
      [labels.activeSubscriptions, fmtNum(mon.activeSubscriptions, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionSponsors);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.sponsorsTotal, fmtNum(data.sponsors.total, locale)],
      [labels.sponsorsActiveNow, fmtNum(data.sponsors.activeNow, locale)],
      [labels.sponsorImpressions30d, fmtNum(data.sponsors.impressions30d, locale)],
      [labels.sponsorClicks30d, fmtNum(data.sponsors.clicks30d, locale)],
      [labels.sponsorCtr30d, `${fmtNum(data.sponsors.ctr30d, locale)} %`],
      [labels.sponsorImpressions7d, fmtNum(data.sponsors.impressions7d, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionRetention);
  autoTable(doc, {
    startY: y,
    head: [
      [
        labels.retentionCohortWeek,
        labels.retentionRegistered,
        labels.retentionS1,
        labels.retentionS4,
      ],
    ],
    body: data.retention.cohorts.slice(0, 12).map((row) => [
      row.cohortWeek,
      fmtNum(row.registered, locale),
      row.week1Mature && row.registered > 0 ? `${fmtNum(row.week1Rate, locale)} %` : '—',
      row.week4Mature && row.registered > 0 ? `${fmtNum(row.week4Rate, locale)} %` : '—',
    ]),
    ...tableOpts(8, [1, 2, 3]),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionAnalytics30d);
  autoTable(doc, {
    startY: y,
    head: [[labels.colMetric, labels.colValue]],
    body: [
      [labels.analyticsLogins30d, fmtNum(data.analytics30d.logins, locale)],
      [labels.analyticsMessages30d, fmtNum(data.analytics30d.messagesSent, locale)],
      [labels.analyticsSalons30d, fmtNum(data.analytics30d.salonsCreated, locale)],
      [labels.analyticsLives30d, fmtNum(data.analytics30d.livesStarted, locale)],
      [labels.analyticsReelViews30d, fmtNum(data.analytics30d.reelsViewed, locale)],
      [labels.analyticsMatches30d, fmtNum(data.analytics30d.matchesCreated, locale)],
      [labels.analyticsFavorites30d, fmtNum(data.analytics30d.favoritesAdded, locale)],
      [labels.analyticsReelsCreated30d, fmtNum(data.analytics30d.reelsCreated, locale)],
    ],
    ...tableOpts(9),
  });
  y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

  if (data.topReels.length > 0) {
    y = pdfSectionTitle(doc, y, margin, maxW, labels.topReelsTitle);
    autoTable(doc, {
      startY: y,
      head: [[labels.rank, labels.colMetric, labels.views]],
      body: data.topReels.slice(0, 10).map((r, i) => [
        String(i + 1),
        `${r.title} (@${r.authorName})`,
        fmtNum(r.viewCount, locale),
      ]),
      ...tableOpts(8, [2]),
    });
    y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
  }

  if (data.topSalons.length > 0 && labels.topSalonsTitle) {
    y = pdfSectionTitle(doc, y, margin, maxW, labels.topSalonsTitle);
    autoTable(doc, {
      startY: y,
      head: [[labels.rank, labels.colMetric, labels.listeners ?? '']],
      body: data.topSalons.slice(0, 10).map((s, i) => [
        String(i + 1),
        `${s.title} — ${s.hostName}`,
        fmtNum(s.listenersCount, locale),
      ]),
      ...tableOpts(8, [2]),
    });
    y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
  }

  if (data.topLives.length > 0 && labels.topLivesTitle) {
    y = pdfSectionTitle(doc, y, margin, maxW, labels.topLivesTitle);
    autoTable(doc, {
      startY: y,
      head: [[labels.rank, labels.colMetric, labels.viewers ?? '']],
      body: data.topLives.slice(0, 10).map((l, i) => [
        String(i + 1),
        `${l.title} — ${l.hostName}`,
        fmtNum(l.viewersCount, locale),
      ]),
      ...tableOpts(8, [2]),
    });
    y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
  }

  return y;
}

/** Présentation PDF stats plateforme (couverture Soundy + synthèse + tableaux). */
export async function downloadAdminStatsPresentationPdf(
  data: StatsOverviewResponse,
  labels: AdminFullReportPdfLabels,
  cover: StatsPresentationCover,
  locale: string,
  options?: { executiveTitle?: string; maxAnalysisLines?: number }
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = createPdfDoc(jsPDF, { unit: 'mm', format: 'a4' });
  const margin = PDF_LAYOUT.margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - PDF_LAYOUT.contentLeft - PDF_LAYOUT.marginRight;

  const genStr = new Date(data.generatedAt).toLocaleString(locale);
  drawReportCover(doc, {
    title: cover.title,
    subtitle: cover.subtitle,
    generatedAtLabel: cover.generatedAtLabel,
    generatedAt: genStr,
    scopeLine: cover.scopeLine,
    confidential: cover.confidential,
  });

  const execTitle = options?.executiveTitle ?? labels.sectionExecutive;
  let y = pdfBeginContentPage(doc, execTitle);

  y = pdfKpiGrid(doc, y, margin, maxW, [
    { label: labels.usersTotal, value: fmtNum(data.users.total, locale) },
    { label: labels.usersOnlineNow, value: fmtNum(data.users.onlineNow, locale) },
    { label: labels.usersActiveToday, value: fmtNum(data.users.activeToday, locale) },
    { label: labels.usersActiveMonth, value: fmtNum(data.users.activeMonth, locale) },
  ]);

  y = pdfSectionTitle(doc, y, margin, maxW, execTitle);
  const analysis = buildAdminStatsAnalysis(data, locale).slice(0, options?.maxAnalysisLines ?? 8);
  y = pdfInsightBlock(doc, y, margin, maxW, analysis, execTitle);

  appendPlatformStatsPresentation(doc, y, margin, maxW, data, labels, locale, autoTable);

  pdfAddFooters(doc, margin, labels.footer, `${cover.generatedAtLabel} ${new Date(data.generatedAt).toLocaleDateString(locale)}`);

  const stamp = new Date(data.generatedAt).toISOString().slice(0, 10);
  doc.save(`soundy-statistiques-${stamp}.pdf`);
}
