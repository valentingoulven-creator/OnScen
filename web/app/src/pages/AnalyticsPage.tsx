import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AdminCostsTab } from './AdminCostsTab';
import { AdminDonationsTab } from './AdminDonationsTab';
import { AnalyticsVpsTab } from './AnalyticsVpsTab';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';
export type AnalyticsSubTab = 'overview' | 'vps' | 'costs' | 'donations';

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
  t,
}: {
  subTab: AnalyticsSubTab;
  onChange: (tab: AnalyticsSubTab) => void;
  t: (key: string) => string;
}) {
  const items: { id: AnalyticsSubTab; label: string }[] = [
    { id: 'overview', label: t('admin.analytics.subTabOverview') },
    { id: 'vps', label: t('admin.analytics.subTabVps') },
    { id: 'costs', label: t('admin.analytics.subTabCosts') },
    { id: 'donations', label: t('admin.analytics.subTabDonations') },
  ];

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 border-b border-[#1e1e2f]"
      aria-label={t('admin.analytics.subTabsAria')}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
            subTab === item.id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function AnalyticsPage({
  onBack,
  embedded = false,
  initialSubTab = 'overview',
}: {
  onBack?: () => void;
  embedded?: boolean;
  initialSubTab?: AnalyticsSubTab;
}) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [subTab, setSubTab] = useState<AnalyticsSubTab>(initialSubTab);
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
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
    load();
  }, [load]);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const periodTotal = periodTotalLabel(period, t);

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
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">{t('admin.analytics.subtitle')}</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      )}

      <div className={`${embedded ? '' : 'flex-1 min-h-0 overflow-y-auto'} p-4 space-y-6`}>
        <AnalyticsSubTabBar subTab={subTab} onChange={setSubTab} t={t} />

        {subTab === 'vps' && <AnalyticsVpsTab />}

        {subTab === 'costs' && <AdminCostsTab />}

        {subTab === 'donations' && <AdminDonationsTab />}

        {subTab === 'overview' && (
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
                  label={t('admin.analytics.dau24h')}
                  value={summary.snapshot.dau24h}
                  sub={t('admin.analytics.dau30d', { count: summary.snapshot.dau30d })}
                  color="green"
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
