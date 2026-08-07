import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAnalyticsKpiCard } from '../components/AdminAnalyticsKpiCard';
import { AdminAnalyticsLineChart } from '../components/AdminAnalyticsLineChart';
import { AdminAnalyticsStackedBarChart } from '../components/AdminAnalyticsStackedBarChart';
import { AdminAnalyticsDonutChart } from '../components/AdminAnalyticsDonutChart';
import {
  MOCK_AGE_BREAKDOWN,
  MOCK_EVENT_CATEGORY_BREAKDOWN,
  MOCK_GEO_BREAKDOWN,
  MOCK_TOP_VIRAL_CONTENT,
  avg,
  bucketizeDailyPoints,
  getMockAnalyticsPeriodSlices,
  pctDelta,
  sum,
  type AnalyticsPeriodKey,
} from '../data/mockAnalyticsDashboard';
import {
  buildAcquisitionInsights,
  buildContentInsights,
  buildEngagementInsights,
  buildGrowthInsights,
  buildMonetizationInsights,
  buildTechnicalInsights,
} from '../lib/adminAnalyticsInsights';
import { ANALYTICS_ACCENTS, getAnalyticsSeriesColor } from '../lib/adminAnalyticsPalette';
import { downloadAdminAnalyticsInsightsPdf } from '../lib/adminAnalyticsReportPdf';

const PERIODS: AnalyticsPeriodKey[] = ['7d', '30d', '3m', '12m'];

function periodLabel(p: AnalyticsPeriodKey): string {
  return { '7d': '7 jours', '30d': '30 jours', '3m': '3 mois', '12m': '12 mois' }[p];
}

function fmtEuro(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function InsightBlock({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1.5 mt-3">
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2 text-xs text-gray-400 leading-relaxed">
          <span className="shrink-0 text-purple-300 font-bold">{String(i + 1).padStart(2, '0')}</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4">
      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Onglet Admin ▸ Analytics ▸ « Aperçu avancé » (Dev uniquement).
 *
 * Dashboard analytique complet (croissance, engagement, contenu, monétisation,
 * technique, acquisition) sur données MOCKÉES 12 mois — voir
 * `src/data/mockAnalyticsDashboard.ts` pour le détail et le plan de bascule
 * vers une vraie API. Les données réelles Soundy restent dans les sous-onglets
 * « Plateforme » et « Activité ».
 */
export function AdminAnalyticsInsightsTab() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<AnalyticsPeriodKey>('30d');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { current, previous } = useMemo(() => getMockAnalyticsPeriodSlices(period), [period]);
  const labels = current.map((p) => p.date.slice(5));
  const bucketLabels = bucketizeDailyPoints(current.map((p) => p.mau), labels, 14).labels;

  const mauNow = current[current.length - 1]?.mau ?? 0;
  const mauPrev = previous[previous.length - 1]?.mau ?? mauNow;
  const signupsNow = sum(current.map((p) => p.newSignups));
  const signupsPrev = sum(previous.map((p) => p.newSignups));
  const engagementNow = avg(current.map((p) => p.avgSessionMinutes));
  const engagementPrev = avg(previous.map((p) => p.avgSessionMinutes));
  const revenueNow = sum(current.map((p) => p.adRevenueEur + p.creatorRevenueEur));
  const revenuePrev = sum(previous.map((p) => p.adRevenueEur + p.creatorRevenueEur));

  const dauSeries = bucketizeDailyPoints(current.map((p) => p.dau), labels, 24, 'avg');
  const mauSeries = bucketizeDailyPoints(current.map((p) => p.mau), labels, 24, 'avg');

  const contentBuckets = 12;
  const photoB = bucketizeDailyPoints(current.map((p) => p.postsPhoto), labels, contentBuckets);
  const videoB = bucketizeDailyPoints(current.map((p) => p.postsVideo), labels, contentBuckets);
  const reelsB = bucketizeDailyPoints(current.map((p) => p.postsReels), labels, contentBuckets);
  const storiesB = bucketizeDailyPoints(current.map((p) => p.postsStories), labels, contentBuckets);

  const geoSlices = MOCK_GEO_BREAKDOWN.map((g, i) => ({
    label: g.label,
    pct: g.pct,
    color: getAnalyticsSeriesColor(i),
  }));

  const eventCategoryLabelKey: Record<(typeof MOCK_EVENT_CATEGORY_BREAKDOWN)[number]['key'], string> = {
    music: t('admin.analytics.insights.eventCategoryMusic'),
    dance: t('admin.analytics.insights.eventCategoryDance'),
    humor: t('admin.analytics.insights.eventCategoryHumor'),
    other: t('admin.analytics.insights.eventCategoryOther'),
  };
  const eventCategorySlices = MOCK_EVENT_CATEGORY_BREAKDOWN.map((c, i) => ({
    label: eventCategoryLabelKey[c.key],
    pct: c.pct,
    color: getAnalyticsSeriesColor(i),
  }));

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAdminAnalyticsInsightsPdf({ period, current, previous });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('admin.analytics.insights.pdfError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-[11px] text-amber-300/90">
        {t('admin.analytics.insights.mockBanner')}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-1 overflow-x-auto"
          role="group"
          aria-label={t('admin.analytics.periodLabel')}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition touch-manipulation min-h-11 sm:min-h-0 ${
                period === p ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'
              }`}
            >
              {periodLabel(p)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          disabled={exporting}
          className="px-4 py-2 min-h-11 text-xs font-semibold border border-purple-500/50 text-purple-100 bg-purple-950/40 hover:bg-purple-900/50 rounded-full disabled:opacity-50 touch-manipulation"
        >
          {exporting ? t('admin.analytics.insights.pdfExporting') : t('admin.analytics.insights.pdfExport')}
        </button>
      </div>

      {exportError && <p className="text-xs text-red-400">{exportError}</p>}

      {/* KPI — vue d'ensemble */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminAnalyticsKpiCard
          label={t('admin.analytics.insights.kpiMau')}
          value={mauNow.toLocaleString('fr-FR')}
          deltaPct={pctDelta(mauNow, mauPrev)}
        />
        <AdminAnalyticsKpiCard
          label={t('admin.analytics.insights.kpiGrowth')}
          value={`${signupsNow.toLocaleString('fr-FR')}`}
          sub={t('admin.analytics.insights.kpiGrowthSub')}
          deltaPct={pctDelta(signupsNow, signupsPrev)}
        />
        <AdminAnalyticsKpiCard
          label={t('admin.analytics.insights.kpiEngagement')}
          value={`${engagementNow.toFixed(1)} min`}
          sub={t('admin.analytics.insights.kpiEngagementSub')}
          deltaPct={pctDelta(engagementNow, engagementPrev)}
        />
        <AdminAnalyticsKpiCard
          label={t('admin.analytics.insights.kpiRevenue')}
          value={fmtEuro(revenueNow)}
          deltaPct={pctDelta(revenueNow, revenuePrev)}
        />
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t('admin.analytics.insights.chartActiveUsers')}>
          <AdminAnalyticsLineChart
            labels={bucketLabels}
            values={mauSeries.values}
            color={ANALYTICS_ACCENTS[0]}
            formatValue={(v) => Math.round(v).toLocaleString('fr-FR')}
          />
          <p className="text-[10px] text-gray-600 mt-2">{t('admin.analytics.insights.chartActiveUsersHint')}</p>
        </SectionCard>
        <SectionCard title={t('admin.analytics.insights.chartGeo')}>
          <AdminAnalyticsDonutChart slices={geoSlices} />
        </SectionCard>
      </div>

      <SectionCard title={t('admin.analytics.insights.chartContentTypes')}>
        <AdminAnalyticsStackedBarChart
          labels={photoB.labels}
          series={[
            { label: t('admin.analytics.insights.contentPhoto'), color: ANALYTICS_ACCENTS[0], values: photoB.values },
            { label: t('admin.analytics.insights.contentVideo'), color: ANALYTICS_ACCENTS[1], values: videoB.values },
            { label: t('admin.analytics.insights.contentReels'), color: ANALYTICS_ACCENTS[2], values: reelsB.values },
            { label: t('admin.analytics.insights.contentStories'), color: '#6b7280', values: storiesB.values },
          ]}
        />
      </SectionCard>

      {/* Sections détaillées */}
      <SectionCard title={t('admin.analytics.insights.sectionGrowth')}>
        <AdminAnalyticsLineChart
          labels={dauSeries.labels}
          values={dauSeries.values}
          color={ANALYTICS_ACCENTS[0]}
          formatValue={(v) => Math.round(v).toLocaleString('fr-FR')}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
          {(['retentionD1Pct', 'retentionD7Pct', 'retentionD30Pct', 'churnPct'] as const).map((key, i) => (
            <div key={key} className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{avg(current.map((p) => p[key])).toFixed(1)}%</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">
                {[t('admin.analytics.insights.retentionD1'), t('admin.analytics.insights.retentionD7'), t('admin.analytics.insights.retentionD30'), t('admin.analytics.insights.churn')][i]}
              </p>
            </div>
          ))}
        </div>
        <InsightBlock lines={buildGrowthInsights(current, previous, period)} />
      </SectionCard>

      <SectionCard title={t('admin.analytics.insights.sectionEngagement')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
          {[
            { label: t('admin.analytics.insights.likes'), value: sum(current.map((p) => p.likes)) },
            { label: t('admin.analytics.insights.comments'), value: sum(current.map((p) => p.comments)) },
            { label: t('admin.analytics.insights.shares'), value: sum(current.map((p) => p.shares)) },
            { label: t('admin.analytics.insights.messages'), value: sum(current.map((p) => p.messagesSent)) },
          ].map((item) => (
            <div key={item.label} className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{item.value.toLocaleString('fr-FR')}</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        <InsightBlock lines={buildEngagementInsights(current, previous)} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t('admin.analytics.insights.sectionContent')}>
          <InsightBlock lines={buildContentInsights(current)} />
          <div className="mt-3 divide-y divide-[#1e1e2f] border border-[#1e1e2f] rounded-xl overflow-hidden">
            {MOCK_TOP_VIRAL_CONTENT.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-center text-[10px] font-bold text-gray-600">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-xs text-white">{item.title}</span>
                <span className="text-[11px] font-semibold text-purple-300 shrink-0">
                  {item.views.toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t('admin.analytics.insights.sectionAcquisition')}>
          <AdminAnalyticsDonutChart
            slices={[
              { label: t('admin.analytics.insights.acquisitionOrganic'), pct: avg(current.map((p) => p.acquisitionOrganicPct)), color: ANALYTICS_ACCENTS[0] },
              { label: t('admin.analytics.insights.acquisitionPaid'), pct: avg(current.map((p) => p.acquisitionPaidPct)), color: ANALYTICS_ACCENTS[1] },
              { label: t('admin.analytics.insights.acquisitionReferral'), pct: avg(current.map((p) => p.acquisitionReferralPct)), color: ANALYTICS_ACCENTS[2] },
            ]}
          />
          <InsightBlock lines={buildAcquisitionInsights(current)} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t('admin.analytics.insights.sectionMonetization')}>
          <div className="grid grid-cols-2 gap-2 text-center mb-3">
            <div className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{avg(current.map((p) => p.cpmEur)).toFixed(2)} €</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">CPM</p>
            </div>
            <div className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{avg(current.map((p) => p.cpcEur)).toFixed(2)} €</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">CPC</p>
            </div>
          </div>
          <InsightBlock lines={buildMonetizationInsights(current, previous)} />
        </SectionCard>

        <SectionCard title={t('admin.analytics.insights.sectionTechnical')}>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{Math.round(avg(current.map((p) => p.avgLoadTimeMs)))} ms</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">{t('admin.analytics.insights.loadTime')}</p>
            </div>
            <div className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{avg(current.map((p) => p.crashRatePct)).toFixed(2)}%</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">{t('admin.analytics.insights.crashRate')}</p>
            </div>
            <div className="bg-[#141420] rounded-xl py-2">
              <p className="text-sm font-bold text-white">{avg(current.map((p) => p.storeRating)).toFixed(2)}/5</p>
              <p className="text-[9px] text-gray-500 uppercase mt-0.5">{t('admin.analytics.insights.storeRating')}</p>
            </div>
          </div>
          <InsightBlock lines={buildTechnicalInsights(current)} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t('admin.analytics.insights.sectionAge')}>
          <div className="grid grid-cols-5 gap-2 text-center">
            {MOCK_AGE_BREAKDOWN.map((a) => (
              <div key={a.bracket} className="bg-[#141420] rounded-xl py-2">
                <p className="text-sm font-bold text-white">{a.pct}%</p>
                <p className="text-[9px] text-gray-500 mt-0.5">{a.bracket}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t('admin.analytics.insights.sectionEventCategories')}>
          <AdminAnalyticsDonutChart slices={eventCategorySlices} />
        </SectionCard>
      </div>

      <p className="text-center text-[10px] text-gray-700 pb-4">{t('admin.analytics.insights.mockFooter')}</p>
    </div>
  );
}
