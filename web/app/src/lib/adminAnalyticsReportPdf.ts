/**
 * Génération du PDF « Rapport Analytics — Aperçu avancé » (dataset mocké,
 * cf. src/data/mockAnalyticsDashboard.ts). Réutilise les primitives de
 * adminPdfCommon.ts (couverture, KPI, tableaux, thème sombre Soundy) et
 * ajoute des graphiques vectoriels (ligne, barres empilées, donut, classement)
 * — pas de screenshot du dashboard : chaque page est composée programmatiquement,
 * avec en-tête/pied de page cohérents et protection anti-coupure des nombres
 * (cf. pdfSafeText / createPdfDoc dans adminPdfCommon.ts).
 */
import type {
  AnalyticsDailyPoint,
  AnalyticsPeriodKey,
} from '../data/mockAnalyticsDashboard';
import {
  MOCK_TOP_VIRAL_CONTENT,
  avg,
  bucketizeDailyPoints,
  pctDelta,
  sum,
} from '../data/mockAnalyticsDashboard';
import {
  buildAcquisitionInsights,
  buildContentInsights,
  buildEngagementInsights,
  buildExecutiveInsights,
  buildGrowthInsights,
  buildMonetizationInsights,
  buildTechnicalInsights,
} from './adminAnalyticsInsights';
import { ANALYTICS_ACCENTS } from './adminAnalyticsPalette';
import {
  createPdfDoc,
  drawReportCover,
  fmtNum,
  pdfAddFooters,
  pdfAutoTablePreset,
  pdfBeginContentPage,
  pdfChartLegend,
  pdfDonutChart,
  pdfEnsureSpace,
  pdfInsightBlock,
  pdfKpiGrid,
  pdfLineChart,
  pdfNumericColumnStyles,
  pdfRankingBarChart,
  pdfSectionTitle,
  pdfStackedBarChart,
  pdfTableMargins,
  PDF_LAYOUT,
  PDF_THEME,
} from './adminPdfCommon';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const ACCENT_RGB = ANALYTICS_ACCENTS.map(hexToRgb) as [number, number, number][];

function periodLabelFr(period: AnalyticsPeriodKey): string {
  return { '7d': '7 derniers jours', '30d': '30 derniers jours', '3m': '3 derniers mois', '12m': '12 derniers mois' }[
    period
  ];
}

export type AnalyticsInsightsPdfInput = {
  period: AnalyticsPeriodKey;
  current: AnalyticsDailyPoint[];
  previous: AnalyticsDailyPoint[];
};

export async function downloadAdminAnalyticsInsightsPdf(input: AnalyticsInsightsPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const { period, current, previous } = input;

  const doc = createPdfDoc(jsPDF, { unit: 'mm', format: 'a4' });
  const margin = PDF_LAYOUT.margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - PDF_LAYOUT.contentLeft - PDF_LAYOUT.marginRight;
  const tableOpts = (fontSize = 9, numericCols: number[] = []) => ({
    margin: pdfTableMargins(),
    ...pdfAutoTablePreset(fontSize),
    columnStyles: pdfNumericColumnStyles(numericCols),
  });
  const chartW = maxW - (PDF_LAYOUT.contentLeft - PDF_LAYOUT.margin);
  const now = new Date();

  const labels = current.map((p) => p.date.slice(5));
  const mauNow = current[current.length - 1]?.mau ?? 0;
  const mauPrev = previous[previous.length - 1]?.mau ?? mauNow;
  const signupsNow = sum(current.map((p) => p.newSignups));
  const signupsPrev = sum(previous.map((p) => p.newSignups));
  const sessionNow = avg(current.map((p) => p.avgSessionMinutes));
  const sessionPrev = avg(previous.map((p) => p.avgSessionMinutes));
  const revenueNow = sum(current.map((p) => p.adRevenueEur + p.creatorRevenueEur));
  const revenuePrev = sum(previous.map((p) => p.adRevenueEur + p.creatorRevenueEur));

  // ── Page de garde ──────────────────────────────────────────────
  drawReportCover(doc, {
    title: 'Rapport Analytics — Aperçu avancé',
    subtitle: `Période analysée : ${periodLabelFr(period)} — croissance, engagement, contenu, monétisation, technique, acquisition.`,
    generatedAtLabel: 'Généré le',
    generatedAt: now.toLocaleString('fr-FR'),
    scopeLine: 'Admin Dev — dataset de démonstration (à connecter à une vraie API).',
    confidential: 'Document interne Soundy — usage démonstration, non contractuel.',
  });

  // ── Résumé exécutif ────────────────────────────────────────────
  let y = pdfBeginContentPage(doc, 'Synthèse exécutive');
  y = pdfKpiGrid(doc, y, margin, maxW, [
    { label: 'MAU actuel', value: fmtNum(mauNow, 'fr-FR'), deltaPct: pctDelta(mauNow, mauPrev) },
    { label: 'Nouveaux inscrits', value: fmtNum(signupsNow, 'fr-FR'), deltaPct: pctDelta(signupsNow, signupsPrev) },
    {
      label: 'Session moyenne',
      value: `${avg(current.map((p) => p.avgSessionMinutes)).toFixed(1).replace('.', ',')} min`,
      deltaPct: pctDelta(sessionNow, sessionPrev),
    },
    {
      label: 'Revenus période',
      value: `${fmtNum(Math.round(revenueNow), 'fr-FR')} €`,
      deltaPct: pctDelta(revenueNow, revenuePrev),
    },
  ]);
  y = pdfSectionTitle(doc, y, margin, maxW, 'Synthèse exécutive');
  pdfInsightBlock(doc, y, margin, maxW, buildExecutiveInsights(current, previous, period), 'Synthèse exécutive');

  // ── Croissance ─────────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Croissance utilisateurs');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Croissance utilisateurs');
  const mauBuckets = bucketizeDailyPoints(current.map((p) => p.mau), labels, 20, 'avg');
  pdfLineChart(doc, PDF_LAYOUT.contentLeft, y, chartW, 46, mauBuckets.values, {
    color: ACCENT_RGB[0],
    xLabels: mauBuckets.labels,
    formatValue: (v) => fmtNum(Math.round(v), 'fr-FR'),
  });
  y += 58;
  y = pdfInsightBlock(doc, y, margin, maxW, buildGrowthInsights(current, previous, period), 'Croissance utilisateurs');
  y = pdfEnsureSpace(doc, y, 40, 'Croissance utilisateurs');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur moyenne période']],
    body: [
      ['Rétention J1', `${avg(current.map((p) => p.retentionD1Pct)).toFixed(1).replace('.', ',')} %`],
      ['Rétention J7', `${avg(current.map((p) => p.retentionD7Pct)).toFixed(1).replace('.', ',')} %`],
      ['Rétention J30', `${avg(current.map((p) => p.retentionD30Pct)).toFixed(1).replace('.', ',')} %`],
      ['Taux de churn', `${avg(current.map((p) => p.churnPct)).toFixed(1).replace('.', ',')} %`],
    ],
    ...tableOpts(9, [1]),
  });

  // ── Engagement ─────────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Engagement');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Engagement');
  const contentBuckets = 10;
  const photoB = bucketizeDailyPoints(current.map((p) => p.postsPhoto), labels, contentBuckets);
  const videoB = bucketizeDailyPoints(current.map((p) => p.postsVideo), labels, contentBuckets);
  const reelsB = bucketizeDailyPoints(current.map((p) => p.postsReels), labels, contentBuckets);
  const storiesB = bucketizeDailyPoints(current.map((p) => p.postsStories), labels, contentBuckets);
  pdfStackedBarChart(
    doc,
    PDF_LAYOUT.contentLeft,
    y,
    chartW,
    44,
    [
      { color: ACCENT_RGB[0], values: photoB.values },
      { color: ACCENT_RGB[1], values: videoB.values },
      { color: ACCENT_RGB[2], values: reelsB.values },
      { color: PDF_THEME.inkMuted, values: storiesB.values },
    ],
    { xLabels: photoB.labels }
  );
  y += 58;
  pdfChartLegend(doc, PDF_LAYOUT.contentLeft, y, [
    { label: 'Photo', color: ACCENT_RGB[0] },
    { label: 'Vidéo', color: ACCENT_RGB[1] },
    { label: 'Reels', color: ACCENT_RGB[2] },
    { label: 'Stories', color: PDF_THEME.inkMuted },
  ]);
  y += 8;
  y = pdfInsightBlock(doc, y, margin, maxW, buildEngagementInsights(current, previous), 'Engagement');
  y = pdfEnsureSpace(doc, y, 40, 'Engagement');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Total période']],
    body: [
      ['Likes', fmtNum(sum(current.map((p) => p.likes)), 'fr-FR')],
      ['Commentaires', fmtNum(sum(current.map((p) => p.comments)), 'fr-FR')],
      ['Partages', fmtNum(sum(current.map((p) => p.shares)), 'fr-FR')],
      ['Messages envoyés', fmtNum(sum(current.map((p) => p.messagesSent)), 'fr-FR')],
    ],
    ...tableOpts(9, [1]),
  });

  // ── Contenu ────────────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Contenu');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Contenu');
  pdfRankingBarChart(
    doc,
    PDF_LAYOUT.contentLeft,
    y + 6,
    chartW,
    36,
    MOCK_TOP_VIRAL_CONTENT.map((c, i) => ({ label: c.title, value: c.views, color: ACCENT_RGB[i % ACCENT_RGB.length] })),
    (v) => fmtNum(v, 'fr-FR')
  );
  y += 52;
  y = pdfInsightBlock(doc, y, margin, maxW, buildContentInsights(current), 'Contenu');
  y = pdfEnsureSpace(doc, y, 45, 'Contenu');
  autoTable(doc, {
    startY: y,
    head: [['Rang', 'Contenu', 'Type', 'Vues', 'Engagement']],
    body: MOCK_TOP_VIRAL_CONTENT.map((c, i) => [
      String(i + 1),
      c.title,
      c.type,
      fmtNum(c.views, 'fr-FR'),
      `${String(c.engagementPct).replace('.', ',')} %`,
    ]),
    ...tableOpts(8, [3, 4]),
  });

  // ── Monétisation ───────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Monétisation');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Monétisation');
  const adRevBuckets = bucketizeDailyPoints(current.map((p) => p.adRevenueEur), labels, 20, 'sum');
  pdfLineChart(doc, PDF_LAYOUT.contentLeft, y, chartW, 40, adRevBuckets.values, {
    color: ACCENT_RGB[1],
    xLabels: adRevBuckets.labels,
    formatValue: (v) => `${Math.round(v)} €`,
  });
  y += 52;
  y = pdfInsightBlock(doc, y, margin, maxW, buildMonetizationInsights(current, previous), 'Monétisation');
  y = pdfEnsureSpace(doc, y, 40, 'Monétisation');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur moyenne']],
    body: [
      ['CPM', `${avg(current.map((p) => p.cpmEur)).toFixed(2).replace('.', ',')} €`],
      ['CPC', `${avg(current.map((p) => p.cpcEur)).toFixed(2).replace('.', ',')} €`],
      ['CTR', `${avg(current.map((p) => p.ctrPct)).toFixed(2).replace('.', ',')} %`],
      ['Revenus créateurs (total)', `${fmtNum(Math.round(sum(current.map((p) => p.creatorRevenueEur))), 'fr-FR')} €`],
    ],
    ...tableOpts(9, [1]),
  });

  // ── Technique ──────────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Technique');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Technique');
  const loadBuckets = bucketizeDailyPoints(current.map((p) => p.avgLoadTimeMs), labels, 20, 'avg');
  pdfLineChart(doc, PDF_LAYOUT.contentLeft, y, chartW, 38, loadBuckets.values, {
    color: ACCENT_RGB[2],
    xLabels: loadBuckets.labels,
    formatValue: (v) => `${Math.round(v)} ms`,
  });
  y += 50;
  y = pdfInsightBlock(doc, y, margin, maxW, buildTechnicalInsights(current), 'Technique');
  y = pdfEnsureSpace(doc, y, 40, 'Technique');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur moyenne']],
    body: [
      ['Temps de chargement', `${Math.round(avg(current.map((p) => p.avgLoadTimeMs)))} ms`],
      ['Taux de crash', `${avg(current.map((p) => p.crashRatePct)).toFixed(2).replace('.', ',')} %`],
      ['Note stores', `${avg(current.map((p) => p.storeRating)).toFixed(2).replace('.', ',')} / 5`],
    ],
    ...tableOpts(9, [1]),
  });

  // ── Acquisition ────────────────────────────────────────────────
  y = pdfBeginContentPage(doc, 'Acquisition');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Acquisition');
  const organicPct = avg(current.map((p) => p.acquisitionOrganicPct));
  const paidPctAvg = avg(current.map((p) => p.acquisitionPaidPct));
  const referralPct = avg(current.map((p) => p.acquisitionReferralPct));
  const acqCx = PDF_LAYOUT.contentLeft + 22;
  pdfDonutChart(doc, acqCx, y + 20, 20, [
    { pct: organicPct, color: ACCENT_RGB[0] },
    { pct: paidPctAvg, color: ACCENT_RGB[1] },
    { pct: referralPct, color: ACCENT_RGB[2] },
  ]);
  pdfChartLegend(doc, PDF_LAYOUT.contentLeft + 48, y + 10, [
    { label: 'Organique', color: ACCENT_RGB[0], value: `${organicPct.toFixed(0)} %` },
    { label: 'Payant', color: ACCENT_RGB[1], value: `${paidPctAvg.toFixed(0)} %` },
    { label: 'Parrainage', color: ACCENT_RGB[2], value: `${referralPct.toFixed(0)} %` },
  ]);
  y += 48;
  y = pdfInsightBlock(doc, y, margin, maxW, buildAcquisitionInsights(current), 'Acquisition');
  y = pdfEnsureSpace(doc, y, 30, 'Acquisition');
  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur moyenne']],
    body: [
      ['CAC', `${avg(current.map((p) => p.cacEur)).toFixed(2).replace('.', ',')} €`],
      ['Taux de conversion', `${avg(current.map((p) => p.conversionRatePct)).toFixed(1).replace('.', ',')} %`],
    ],
    ...tableOpts(9, [1]),
  });

  // ── Conclusion / recommandations ──────────────────────────────
  y = pdfBeginContentPage(doc, 'Conclusion & recommandations');
  y = pdfSectionTitle(doc, y, margin, maxW, 'Conclusion & recommandations');
  const churnNow = avg(current.map((p) => p.churnPct));
  const crashNow = avg(current.map((p) => p.crashRatePct));
  const paidPct = avg(current.map((p) => p.acquisitionPaidPct));
  pdfInsightBlock(
    doc,
    y,
    margin,
    maxW,
    [
      `Poursuivre l'effort sur la rétention J7/J30 — c'est le principal levier de croissance nette du MAU.`,
      churnNow > 6
        ? `Le taux de churn (${churnNow.toFixed(1).replace('.', ',')}%) mérite une attention prioritaire : creuser les cohortes à risque.`
        : `Le taux de churn (${churnNow.toFixed(1).replace('.', ',')}%) reste maîtrisé — capitaliser sur les leviers actuels de fidélisation.`,
      `Le format reel génère la majorité de l'engagement viral — renforcer sa mise en avant éditoriale et sa découvrabilité.`,
      crashNow > 0.5
        ? `Le taux de crash (${crashNow.toFixed(2).replace('.', ',')}%) dépasse le seuil de vigilance recommandé (0,5%) — prioriser la stabilité technique.`
        : `La stabilité technique (crash ${crashNow.toFixed(2).replace('.', ',')}%) est saine — maintenir le monitoring actuel.`,
      `L'acquisition payante représente ${paidPct.toFixed(0)}% des nouveaux utilisateurs — évaluer le ROI par canal avant d'augmenter le budget.`,
      `Ce rapport s'appuie sur un jeu de données de démonstration — brancher une API réelle (voir src/data/mockAnalyticsDashboard.ts) avant diffusion externe.`,
    ],
    'Conclusion & recommandations'
  );

  pdfAddFooters(
    doc,
    margin,
    'Soundy · Rapport analytics — dataset de démonstration',
    `Généré le ${now.toLocaleDateString('fr-FR')}`
  );

  const dateStr = now.toISOString().slice(0, 10);
  doc.save(`analytics-report-${period}-${dateStr}.pdf`);
}
