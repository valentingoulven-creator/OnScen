import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export interface CreatorDashboardStats {
  tipsTotalCents: number;
  tipsCount: number;
  totalLivePeakViews: number;
  archivedLiveCount: number;
  activeLiveCount: number;
}

function formatEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith('fr') ? 'fr-FR' : 'en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function CreatorDashboardCard() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setStats(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getCreatorStats(token)
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
  }, [token]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-4 animate-pulse h-24" />
    );
  }

  if (!stats) return null;

  const tipsLabel = formatEuros(stats.tipsTotalCents, i18n.language);

  return (
    <section
      className="rounded-xl border border-[#2d2d3d] bg-gradient-to-br from-[#12121a] to-[#1a1028] p-4 space-y-3"
      aria-label={t('profile.creatorDashboard.title')}
    >
      <h3 className="text-sm font-bold text-white">{t('profile.creatorDashboard.title')}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-black/25 border border-[#2d2d3d] p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            {t('profile.creatorDashboard.tips')}
          </p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{tipsLabel}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {t('profile.creatorDashboard.tipsCount', { count: stats.tipsCount })}
          </p>
        </div>
        <div className="rounded-lg bg-black/25 border border-[#2d2d3d] p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">
            {t('profile.creatorDashboard.liveViews')}
          </p>
          <p className="text-lg font-bold text-purple-300 mt-1">{stats.totalLivePeakViews}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {t('profile.creatorDashboard.archivedLives', { count: stats.archivedLiveCount })}
          </p>
        </div>
      </div>
    </section>
  );
}
