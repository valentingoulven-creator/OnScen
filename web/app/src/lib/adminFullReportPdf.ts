import type { AdminReportBundle } from './adminReportFetch';
import { ADMIN_FIXED_COSTS_ROWS } from './adminFixedCosts';
import { buildExecutiveReportAnalysis } from './adminReportAnalysis';
import { appendPlatformStatsPresentation } from './adminStatsPresentationPdf';
import {
  createPdfDoc,
  drawReportCover,
  fmtEuro,
  fmtNum,
  fmtUsd,
  pdfAddFooters,
  pdfAutoTablePreset,
  pdfBeginContentPage,
  pdfEnsureSpace,
  pdfInsightBlock,
  pdfNumericColumnStyles,
  pdfSectionTitle,
  pdfTableMargins,
  PDF_LAYOUT,
  type PdfDocWithTable,
} from './adminPdfCommon';

export type AdminFullReportPdfLabels = {
  coverTitle: string;
  coverSubtitle: string;
  coverScopeOperational: string;
  coverScopeFull: string;
  generatedAt: string;
  confidential: string;
  sectionExecutive: string;
  sectionPlatform: string;
  sectionActivity: string;
  sectionFixedCosts: string;
  sectionCloudflare: string;
  sectionDonations: string;
  sectionVps: string;
  sectionSaas: string;
  sectionErrors: string;
  colMetric: string;
  colValue: string;
  colService: string;
  colAmount: string;
  colNote: string;
  colPeriod: string;
  colTotal: string;
  colPlatformFee: string;
  colCount: string;
  rank: string;
  views: string;
  usersTotal: string;
  usersOnlineNow: string;
  usersActiveToday: string;
  usersActiveWeek: string;
  usersActiveMonth: string;
  totalReels: string;
  activeSalonsNow: string;
  totalSalonsCreated: string;
  activeLivesNow: string;
  totalLivesStarted: string;
  totalEvents: string;
  totalUpvotes: string;
  totalAlbums: string;
  totalCompositions: string;
  sectionMusic: string;
  sectionEngagement: string;
  sectionCommunity: string;
  sectionSponsors: string;
  sectionMonetization: string;
  sectionAnalytics30d: string;
  usersNew7d: string;
  usersNew30d: string;
  usersInactive30d: string;
  usersWithGeo: string;
  usersPending: string;
  usersBlocked: string;
  usersActiveTodayTracked: string;
  usersActiveTodayLastSeen: string;
  mrrEstimated: string;
  mrrPlatform: string;
  mrrStripeReconciled: string;
  subscriptionInvoicesMonth: string;
  tipsMonth: string;
  platformFeesMonth: string;
  platformRevenueMonth: string;
  activeSubscriptions: string;
  compositionUpvotes: string;
  eventUpvotes: string;
  compositionPlaysTotal: string;
  compositionPlays7d: string;
  followRelations: string;
  usersFollowing: string;
  feedPostLikes: string;
  feedPostComments: string;
  feedPostFavorites: string;
  totalMatches: string;
  reelLikes: string;
  reelComments: string;
  directMessages: string;
  activeCreatorSubscriptions: string;
  activePlatformSubscriptions: string;
  totalStories: string;
  supportThreadsTotal: string;
  supportOpen: string;
  reportsTotal: string;
  reportsPending: string;
  sponsorsTotal: string;
  sponsorsActiveNow: string;
  sponsorImpressions30d: string;
  sponsorClicks30d: string;
  sponsorCtr30d: string;
  sponsorImpressions7d: string;
  sectionRetention: string;
  retentionCohortWeek: string;
  retentionRegistered: string;
  retentionS1: string;
  retentionS4: string;
  analyticsLogins30d: string;
  analyticsMessages30d: string;
  analyticsSalons30d: string;
  analyticsLives30d: string;
  analyticsReelViews30d: string;
  analyticsMatches30d: string;
  analyticsFavorites30d: string;
  analyticsReelsCreated30d: string;
  topReelsTitle: string;
  topSalonsTitle?: string;
  topLivesTitle?: string;
  listeners?: string;
  viewers?: string;
  cfMinutes: string;
  cfStorage: string;
  cfEstimatedEur: string;
  donationsAllTime: string;
  donationsMonth: string;
  vpsMemory: string;
  vpsDisk: string;
  vpsCpu: string;
  vpsLatency: string;
  footer: string;
};

export async function downloadAdminFullReportPdf(
  bundle: AdminReportBundle,
  labels: AdminFullReportPdfLabels,
  locale: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = createPdfDoc(jsPDF, { unit: 'mm', format: 'a4' });
  const margin = PDF_LAYOUT.margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - PDF_LAYOUT.contentLeft - PDF_LAYOUT.marginRight;
  const tableOpts = (fontSize: number, numericCols: number[] = [1]) => ({
    margin: pdfTableMargins(),
    ...pdfAutoTablePreset(fontSize),
    columnStyles: pdfNumericColumnStyles(numericCols),
  });

  drawReportCover(doc, {
    title: labels.coverTitle,
    subtitle: labels.coverSubtitle,
    generatedAtLabel: labels.generatedAt,
    generatedAt: new Date(bundle.generatedAt).toLocaleString(locale),
    scopeLine: bundle.scope === 'full' ? labels.coverScopeFull : labels.coverScopeOperational,
    confidential: labels.confidential,
  });

  let y = pdfBeginContentPage(doc, labels.sectionExecutive);
  y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionExecutive);
  y = pdfInsightBlock(doc, y, margin, maxW, buildExecutiveReportAnalysis(bundle, locale), labels.sectionExecutive);

  appendPlatformStatsPresentation(doc, y, margin, maxW, bundle.platform, labels, locale, autoTable);

  if (bundle.scope === 'full') {
    y = pdfBeginContentPage(doc, labels.sectionFixedCosts);
    y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionFixedCosts);
    autoTable(doc, {
      startY: y,
      head: [[labels.colService, labels.colAmount, labels.colNote]],
      body: ADMIN_FIXED_COSTS_ROWS.map((r) => [r.label, r.amount, r.note]),
      ...tableOpts(9, [1]),
    });
    y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;

    if (bundle.activity) {
      y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionActivity);
      const snap = bundle.activity.snapshot;
      autoTable(doc, {
        startY: y,
        head: [[labels.colMetric, labels.colValue]],
        body: [
          [labels.usersTotal, fmtNum(snap.totalUsers, locale)],
          ['DAU 24h', fmtNum(snap.dau24h, locale)],
          ['DAU 30d', fmtNum(snap.dau30d, locale)],
          [labels.totalReels, fmtNum(snap.totalReels, locale)],
          ['Messages', fmtNum(snap.totalMessages, locale)],
          ['Matchs', fmtNum(snap.totalMatches, locale)],
        ],
        ...tableOpts(9),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 4;
      const series = bundle.activity.series;
      autoTable(doc, {
        startY: y,
        head: [[labels.colPeriod, 'Logins', 'Messages']],
        body: series.labels.map((lb, i) => [
          lb,
          fmtNum(series.logins[i] ?? 0, locale),
          fmtNum(series.messagesSent[i] ?? 0, locale),
        ]),
        ...tableOpts(8, [1, 2]),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
    }

    if (bundle.cloudflare) {
      y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionCloudflare);
      const cf = bundle.cloudflare;
      autoTable(doc, {
        startY: y,
        body: [
          [labels.cfMinutes, fmtNum(cf.minutesDelivered, locale)],
          [labels.cfStorage, fmtNum(cf.storageMinutes, locale)],
          [labels.cfEstimatedEur, fmtEuro(cf.estimatedCostEur.total, locale)],
          ['USD (est.)', fmtUsd(cf.estimatedCostUsd.total, locale)],
        ],
        ...tableOpts(9),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
    }

    if (bundle.donations) {
      y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionDonations);
      const d = bundle.donations;
      const periodRow = (title: string, period: typeof d.allTime) => [
        title,
        fmtEuro(period.totalDonationsCents / 100, locale),
        fmtNum(period.count, locale),
        fmtEuro(period.platformFeesCents / 100, locale),
      ];
      autoTable(doc, {
        startY: y,
        head: [[labels.colPeriod, labels.colTotal, labels.colCount, labels.colPlatformFee]],
        body: [periodRow(labels.donationsAllTime, d.allTime), periodRow(labels.donationsMonth, d.thisMonth)],
        ...tableOpts(9, [1, 2, 3]),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
    }

    if (bundle.vps) {
      y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionVps);
      const v = bundle.vps;
      autoTable(doc, {
        startY: y,
        body: [
          [labels.vpsMemory, `${v.memory.usedPercent.toFixed(1)} %`],
          [labels.vpsDisk, v.disk.usedPercent != null ? `${v.disk.usedPercent.toFixed(1)} %` : '—'],
          [labels.vpsCpu, `${v.cpu.cores} cores`],
          [labels.vpsLatency, `${fmtNum(v.latencyMs, locale)} ms`],
          ['Hostname', v.hostname],
        ],
        ...tableOpts(9),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
    }

    if (bundle.prodSaas?.services?.length) {
      y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionSaas);
      autoTable(doc, {
        startY: y,
        head: [[labels.colService, labels.colAmount]],
        body: bundle.prodSaas.services.map((s) => [s.id, s.indicativeCost]),
        ...tableOpts(8, [1]),
      });
      y = (doc as PdfDocWithTable).lastAutoTable.finalY + 10;
    }
  }

  if (bundle.partialErrors.length > 0) {
    y = pdfEnsureSpace(doc, y, 30, labels.sectionErrors);
    y = pdfSectionTitle(doc, y, margin, maxW, labels.sectionErrors);
    pdfInsightBlock(doc, y, margin, maxW, bundle.partialErrors, labels.sectionErrors);
  }

  pdfAddFooters(
    doc,
    margin,
    labels.footer,
    `${labels.generatedAt} ${new Date(bundle.generatedAt).toLocaleDateString(locale)}`
  );

  const stamp = new Date(bundle.generatedAt).toISOString().slice(0, 10);
  doc.save(`soundy-rapport-statistiques-couts-${stamp}.pdf`);
}
