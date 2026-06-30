import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  buildCreatorStatsYears,
  formatCreatorEuros,
  type CreatorDashboardStats,
} from '../lib/creatorDashboardStats';

export type { CreatorDashboardStats };

type PeriodMode = 'all' | 'month';

function StatMetric({
  label,
  value,
  hint,
  valueClassName = 'text-white',
}: {
  label: string;
  value: string | number;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-black/25 border border-[#2d2d3d] p-3 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`text-lg font-bold mt-1 tabular-nums leading-tight ${valueClassName}`}>{value}</p>
      {hint ? <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{hint}</p> : null}
    </div>
  );
}

export function CreatorDashboardCard() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const now = new Date();
  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const years = useMemo(() => buildCreatorStatsYears(), []);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const label = new Intl.DateTimeFormat(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US', {
          month: 'long',
        }).format(new Date(selectedYear, i, 1));
        return { month, label };
      }),
    [i18n.language, selectedYear]
  );

  useEffect(() => {
    if (!token) {
      setStats(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const period =
      periodMode === 'month' ? { year: selectedYear, month: selectedMonth } : undefined;
    api
      .getCreatorStats(token, period)
      .then((r) => {
        if (!cancelled) setStats(r.stats);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, periodMode, selectedYear, selectedMonth]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-4 animate-pulse min-h-[220px]" />
    );
  }

  if (!stats) return null;

  const tipsLabel = formatCreatorEuros(stats.tipsTotalCents, i18n.language);
  const avgTipLabel =
    stats.tipsCount > 0
      ? formatCreatorEuros(Math.round(stats.tipsTotalCents / stats.tipsCount), i18n.language)
      : formatCreatorEuros(0, i18n.language);

  const periodLabel =
    periodMode === 'all'
      ? t('profile.creatorDashboard.periodAll')
      : t('profile.creatorDashboard.periodMonthYear', {
          month: monthOptions.find((m) => m.month === selectedMonth)?.label ?? '',
          year: selectedYear,
        });

  return (
    <section
      className="rounded-xl border border-[#2d2d3d] bg-gradient-to-br from-[#12121a] to-[#1a1028] p-4 space-y-3"
      aria-label={t('profile.creatorDashboard.title')}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{t('profile.creatorDashboard.title')}</h3>
        <span className="text-[10px] text-gray-500 shrink-0 pt-0.5 capitalize">{periodLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'month'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setPeriodMode(mode);
              if (mode === 'month') {
                const d = new Date();
                setSelectedYear(d.getFullYear());
                setSelectedMonth(d.getMonth() + 1);
              }
            }}
            className={`min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition touch-manipulation ${
              periodMode === mode
                ? 'border-purple-500/50 bg-purple-900/40 text-purple-200'
                : 'border-[#2d2d3d] text-gray-400 hover:text-white'
            }`}
          >
            {mode === 'all'
              ? t('profile.creatorDashboard.periodAllShort')
              : t('profile.creatorDashboard.periodMonthShort')}
          </button>
        ))}
      </div>

      {periodMode === 'month' ? (
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="creator-dash-month" className="text-[10px] font-medium text-gray-500 px-0.5">
              {t('profile.creatorDashboard.periodMonthLabel')}
            </label>
            <select
              id="creator-dash-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#0b0b0f] border border-[#2d2d3d] text-gray-300 text-[11px] capitalize touch-manipulation"
            >
              {monthOptions.map(({ month, label }) => (
                <option key={month} value={month}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24 shrink-0 space-y-1">
            <label htmlFor="creator-dash-year" className="text-[10px] font-medium text-gray-500 px-0.5">
              {t('profile.creatorDashboard.periodYearLabel')}
            </label>
            <select
              id="creator-dash-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#0b0b0f] border border-[#2d2d3d] text-gray-300 text-[11px] touch-manipulation"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${loading ? 'opacity-60' : ''}`}>
        <StatMetric
          label={t('profile.creatorDashboard.tips')}
          value={tipsLabel}
          hint={t('profile.creatorDashboard.tipsCount', { count: stats.tipsCount })}
          valueClassName="text-emerald-400"
        />
        <StatMetric
          label={t('profile.creatorDashboard.avgTip')}
          value={avgTipLabel}
          hint={t('profile.creatorDashboard.avgTipHint')}
          valueClassName="text-emerald-300"
        />
        <StatMetric
          label={t('profile.creatorDashboard.newSubscribers')}
          value={stats.newSubscribers}
          hint={t('profile.creatorDashboard.newSubscribersHint')}
          valueClassName="text-sky-300"
        />
        <StatMetric
          label={t('profile.creatorDashboard.liveViews')}
          value={stats.totalLivePeakViews}
          hint={t('profile.creatorDashboard.liveViewsHint')}
          valueClassName="text-purple-300"
        />
        <StatMetric
          label={t('profile.creatorDashboard.liveCount')}
          value={stats.liveCount}
          hint={t('profile.creatorDashboard.liveCountHint', {
            active: stats.activeLiveCount,
            archived: stats.archivedLiveCount,
          })}
          valueClassName="text-white"
        />
        <StatMetric
          label={t('profile.creatorDashboard.donationCount')}
          value={stats.tipsCount}
          hint={t('profile.creatorDashboard.donationCountHint')}
          valueClassName="text-amber-300"
        />
      </div>

      {stats.topDonors.length > 0 ? (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {t('profile.creatorDashboard.topDonors')}
          </p>
          <div className="flex flex-col gap-1">
            {stats.topDonors.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-[#2d2d3d]"
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    i === 0
                      ? 'bg-amber-500 text-black'
                      : i === 1
                        ? 'bg-gray-400 text-black'
                        : 'bg-[#2d2d3d] text-gray-300'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-xs text-white truncate">{d.name}</span>
                <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">
                  {formatCreatorEuros(d.amountCents, i18n.language)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
