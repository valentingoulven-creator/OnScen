import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  getAnalyticsSubTabsForRole,
  isAnalyticsSubTabAllowed,
  normalizeAnalyticsSubTab,
  type AnalyticsSubTab,
  type AnalyticsSubTabInput,
} from '../lib/adminAnalyticsSubTabs';
import type { StaffRole } from '../lib/adminStaffRoles';
import { resolveStaffRole } from '../lib/adminStaffRoles';
import { downloadAdminFullReportPdf } from '../lib/adminFullReportPdf';
import { buildAdminFullReportPdfLabels } from '../lib/adminFullReportPdfLabels';
import { downloadAdminStatsCsv, downloadAdminReportCsv } from '../lib/adminStatsCsvExport';
import { fetchAdminReportBundle } from '../lib/adminReportFetch';
import { AdminCostsTab } from './AdminCostsTab';
import { AdminDonationsTab } from './AdminDonationsTab';
import { AdminAnalyticsInsightsTab } from './AdminAnalyticsInsightsTab';
import { AdminStatsTab } from './AdminStatsTab';
import { AnalyticsVpsTab } from './AnalyticsVpsTab';

export type { AnalyticsSubTab, AnalyticsSubTabInput } from '../lib/adminAnalyticsSubTabs';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

type AnalyticsSummary = Awaited<ReturnType<typeof api.getAnalyticsSummary>>;

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week', 'month', 'year'];

function periodTotalLabel(period: AnalyticsPeriod, t: (key: string) => string): string {
  if (period === 'day') return t('admin.analytics.periodTotalDay');
  if (period === 'week') return t('admin.analytics.periodTotalWeek');
  if (period === 'month') return t('admin.analytics.periodTotalMonth');
  return t('admin.analytics.periodTotalYear');
}

function periodLabel(period: AnalyticsPeriod, t: (key: string) => string): string {
  if (period === 'day') return t('admin.analytics.periodDay');
  if (period === 'week') return t('admin.analytics.periodWeek');
  if (period === 'month') return t('admin.analytics.periodMonth');
  return t('admin.analytics.periodYear');
}

function StatCard({
  label,
  value,
  sub,
  color = 'purple',
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'purple' | 'green' | 'blue' | 'red' | 'yellow';
}) {
  const colorMap = {
    purple: 'from-purple-600/20 to-purple-900/10 border-purple-500/20 text-purple-300',
    green: 'from-green-600/20 to-green-900/10 border-green-500/20 text-green-300',
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/20 text-blue-300',
    red: 'from-red-600/20 to-red-900/10 border-red-500/20 text-red-300',
    yellow: 'from-yellow-600/20 to-yellow-900/10 border-yellow-500/20 text-yellow-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-4`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color].split(' ')[3]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({
  labels,
  values,
  color = '#9b7bd4',
  height = 80,
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => {
        const pct = (v / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span
              className="text-[9px] text-gray-500 font-mono"
              style={{ visibility: v > 0 ? 'visible' : 'hidden' }}
            >
              {v}
            </span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: v === 0 ? '0%' : `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                opacity: v === 0 ? 0 : 0.85,
              }}
            />
            <span className="text-[8px] text-gray-600 truncate w-full text-center">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({
  title,
  labels,
  values,
  color,
  periodTotal,
  emptyLabel,
}: {
  title: string;
  labels: string[];
  values: number[];
  color?: string;
  periodTotal: string;
  emptyLabel: string;
}) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-xs text-gray-500">
          {total} {periodTotal}
        </span>
      </div>
      {values.some((v) => v > 0) ? (
        <BarChart labels={labels} values={values} color={color} height={72} />
      ) : (
        <p className="text-xs text-gray-600 py-6 text-center">{emptyLabel}</p>
      )}
    </div>
  );
}

function AnalyticsSubTabBar({
  subTab,
  onChange,
  visibleTabs,
  t,
}: {
  subTab: AnalyticsSubTab;
  onChange: (tab: AnalyticsSubTab) => void;
  visibleTabs: AnalyticsSubTab[];
  t: (key: string) => string;
}) {
  const labelKey: Record<AnalyticsSubTab, string> = {
    platform: 'admin.analytics.subTabPlatform',
    insights: 'admin.analytics.subTabInsights',
    activity: 'admin.analytics.subTabActivity',
    vps: 'admin.analytics.subTabVps',
    costs: 'admin.analytics.subTabCosts',
    donations: 'admin.analytics.subTabDonations',
  };

  if (visibleTabs.length <= 1) return null;

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 border-b border-[#1e1e2f]"
      aria-label={t('admin.analytics.subTabsAria')}
    >
      {visibleTabs.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
            subTab === id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {t(labelKey[id])}
        </button>
      ))}
    </nav>
  );
}

export function AnalyticsPage({
  onBack,
  embedded = false,
  initialSubTab = 'platform',
  staffRole: staffRoleProp,
}: {
  onBack?: () => void;
  embedded?: boolean;
  initialSubTab?: AnalyticsSubTabInput;
  staffRole?: StaffRole | null;
}) {
  const { token, user } = useAuth();
  const staffRole = staffRoleProp ?? resolveStaffRole(user);
  const visibleSubTabs = useMemo(() => getAnalyticsSubTabsForRole(staffRole), [staffRole]);
  const { t, i18n } = useTranslation();
  const [subTab, setSubTab] = useState<AnalyticsSubTab>(() =>
    normalizeAnalyticsSubTab(initialSubTab)
  );
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getAnalyticsSummary(token, { period, locale: i18n.language })
      .then((r) => {
        setSummary(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.analytics.error')))
      .finally(() => setLoading(false));
  }, [token, period, i18n.language, t]);

  useEffect(() => {
    if (subTab !== 'activity') return;
    load();
  }, [load, subTab]);

  useEffect(() => {
    setSubTab(normalizeAnalyticsSubTab(initialSubTab));
  }, [initialSubTab]);

  useEffect(() => {
    if (isAnalyticsSubTabAllowed(subTab, staffRole)) return;
    const fallback = visibleSubTabs[0] ?? 'platform';
    setSubTab(fallback);
  }, [subTab, staffRole, visibleSubTabs]);

  const periodTotal = periodTotalLabel(period, t);

  const handleExportFullPdf = async () => {
    if (!token) return;
    setExportingPdf(true);
    setExportError(null);
    try {
      const bundle = await fetchAdminReportBundle(token, staffRole === 'dev', i18n.language);
      const labels = buildAdminFullReportPdfLabels(t, bundle.platform);
      await downloadAdminFullReportPdf(bundle, labels, i18n.language);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('admin.analytics.pdf.exportError'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    if (!token) return;
    setExportingCsv(true);
    setExportError(null);
    try {
      if (staffRole === 'dev') {
        const bundle = await fetchAdminReportBundle(token, true, i18n.language);
        downloadAdminReportCsv(bundle, i18n.language);
      } else {
        const platform = await api.getStatsOverview(token);
        downloadAdminStatsCsv(platform, i18n.language);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('admin.analytics.csv.exportError'));
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className={`flex flex-col ${embedded ? '' : 'h-full min-h-0'} bg-[#0b0b0f]`}>
      {!embedded && (
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f] bg-[#0e0e14]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-gray-400 hover:text-white text-xl shrink-0"
            >
              ←
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">{t('admin.analytics.title')}</h1>
            <p className="text-xs text-gray-500">{t('admin.analytics.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
          >
            {loading ? '...' : t('admin.analytics.refresh')}
          </button>
        </header>
      )}

      {embedded && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-gray-500 min-w-0">
              {staffRole === 'dev'
                ? t('admin.analytics.pdf.coverScopeFull')
                : t('admin.analytics.pdf.coverScopeOperational')}
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={exportingCsv}
                className="px-4 py-2 min-h-11 text-xs font-semibold border border-[#2d2d3d] text-gray-200 hover:text-white rounded-full disabled:opacity-50 touch-manipulation"
              >
                {exportingCsv ? t('admin.analytics.csv.exporting') : t('admin.analytics.csv.export')}
              </button>
              <button
                type="button"
                onClick={() => void handleExportFullPdf()}
                disabled={exportingPdf}
                className="px-4 py-2 min-h-11 text-xs font-semibold border border-purple-500/50 text-purple-100 bg-purple-950/40 hover:bg-purple-900/50 rounded-full disabled:opacity-50 touch-manipulation"
              >
                {exportingPdf ? t('admin.analytics.pdf.exporting') : t('admin.analytics.pdf.export')}
              </button>
            </div>
          </div>
          {exportError ? (
            <p className="text-xs text-red-400" role="alert">
              {exportError}
            </p>
          ) : null}
        </div>
      )}

      {embedded && subTab === 'activity' && (
        <div className="flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
          >
            {loading ? '...' : t('admin.analytics.refresh')}
          </button>
        </div>
      )}

      <div className={`${embedded ? '' : 'flex-1 min-h-0 overflow-y-auto'} ${embedded ? 'space-y-6' : 'p-4 space-y-6'}`}>
        <AnalyticsSubTabBar
          subTab={subTab}
          onChange={setSubTab}
          visibleTabs={visibleSubTabs}
          t={t}
        />

        {subTab === 'platform' && <AdminStatsTab embedded />}

        {subTab === 'insights' && <AdminAnalyticsInsightsTab />}

        {subTab === 'vps' && <AnalyticsVpsTab />}

        {subTab === 'costs' && <AdminCostsTab />}

        {subTab === 'donations' && <AdminDonationsTab />}

        {subTab === 'activity' && (
          <>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('admin.analytics.periodLabel')}
          </p>
          <div
            className="flex gap-1 overflow-x-auto"
            role="group"
            aria-label={t('admin.analytics.periodLabel')}
          >
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  period === option
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#1a1a26] text-gray-400 hover:text-white'
                }`}
              >
                {periodLabel(option, t)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 text-sm">{t('admin.analytics.loading')}</p>
          </div>
        )}

        {summary && (
          <>
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t('admin.analytics.snapshotTitle')}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={t('admin.analytics.totalUsers')}
                  value={summary.snapshot.totalUsers}
                  color="purple"
                />
                <StatCard
                  label={t('admin.analytics.dau24hLastSeen')}
                  value={summary.snapshot.dau24h}
                  sub={t('admin.analytics.dau30dLastSeen', { count: summary.snapshot.dau30d })}
                  color="green"
                />
                <StatCard
                  label={t('admin.analytics.dau24hTracked')}
                  value={summary.snapshot.dau24hTracked}
                  sub={t('admin.analytics.dau30dTracked', { count: summary.snapshot.dau30dTracked })}
                  color="blue"
                />
                <StatCard
                  label={t('admin.analytics.newUsersToday')}
                  value={summary.snapshot.newUsersToday}
                  color="blue"
                />
                <StatCard
                  label={t('admin.analytics.activeSalons')}
                  value={summary.snapshot.activeSalons}
                  sub={t('admin.analytics.activeLives', { count: summary.snapshot.activeLives })}
                  color="red"
                />
                <StatCard
                  label={t('admin.analytics.totalMessages')}
                  value={summary.snapshot.totalMessages}
                  color="yellow"
                />
                <StatCard
                  label={t('admin.analytics.totalMatches')}
                  value={summary.snapshot.totalMatches}
                  color="purple"
                />
                <StatCard
                  label={t('admin.analytics.totalReels')}
                  value={summary.snapshot.totalReels}
                  color="blue"
                />
                <StatCard
                  label={t('admin.analytics.totalFeedPosts')}
                  value={summary.snapshot.totalFeedPosts}
                  color="green"
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {t('admin.analytics.activityTitle', { period: periodLabel(period, t) })}
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <ChartCard
                  title={t('admin.analytics.chartLogins')}
                  labels={summary.series.labels}
                  values={summary.series.logins}
                  color="#9b7bd4"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartMessages')}
                  labels={summary.series.labels}
                  values={summary.series.messagesSent}
                  color="#f59e0b"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartMatches')}
                  labels={summary.series.labels}
                  values={summary.series.matchesCreated}
                  color="#ec4899"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartSalons')}
                  labels={summary.series.labels}
                  values={summary.series.salonsCreated}
                  color="#6366f1"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartLives')}
                  labels={summary.series.labels}
                  values={summary.series.livesStarted}
                  color="#ef4444"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartReels')}
                  labels={summary.series.labels}
                  values={summary.series.reelsViewed}
                  color="#22c55e"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
                <ChartCard
                  title={t('admin.analytics.chartFavorites')}
                  labels={summary.series.labels}
                  values={summary.series.favoritesAdded}
                  color="#f97316"
                  periodTotal={periodTotal}
                  emptyLabel={t('admin.analytics.noActivity')}
                />
              </div>
            </section>

            <p className="text-center text-[10px] text-gray-700 pb-4">
              {t('admin.analytics.dataNote')}
            </p>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
