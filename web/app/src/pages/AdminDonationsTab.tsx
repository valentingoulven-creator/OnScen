import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useAdminDonationUpdates } from '../hooks/useAdminDonationsRealtime';
import { AdminStripePlatformCard } from '../components/AdminStripePlatformCard';
import { AdminStripeConfigCard } from '../components/AdminStripeConfigCard';
import type { AdminDonationEntry } from '../types';

function formatDateTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AdminDonationsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<AdminDonationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [platformFeePercent, setPlatformFeePercent] = useState(30);
  const [simulationMode, setSimulationMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getDonationsHistory(token, { limit: 200 })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setPlatformFeePercent(res.platformFeePercent);
        setSimulationMode(res.simulationMode);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t('admin.donations.loadError'));
      })
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onRealtimeDonation = useCallback((entry: AdminDonationEntry) => {
    setItems((prev) => {
      if (prev.some((item) => item.id === entry.id)) return prev;
      setTotal((count) => count + 1);
      return [entry, ...prev].sort((a, b) => b.timestamp - a.timestamp);
    });
  }, []);

  useAdminDonationUpdates(onRealtimeDonation, Boolean(token));

  return (
    <div className="space-y-4">
      <AdminStripeConfigCard />
      <AdminStripePlatformCard />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">{t('admin.donations.title')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('admin.donations.subtitle', { percent: platformFeePercent })}</p>
          {simulationMode && (
            <p className="text-[10px] text-yellow-400/90 mt-1">{t('admin.donations.simulationBadge')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1a26] text-purple-300 border border-purple-500/20"
        >
          {t('admin.donations.refresh')}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden />
          {t('admin.donations.live')}
        </span>
        <span>·</span>
        <span>{t('admin.donations.count', { count: total })}</span>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">{t('admin.donations.loading')}</p>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-gray-500 py-8 text-center">{t('admin.donations.empty')}</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] px-3 py-3 sm:px-4"
            >
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-semibold truncate">
                    {item.senderName}
                    <span className="text-gray-500 font-normal"> → </span>
                    {item.recipientName}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {item.liveTitle}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">{formatDateTime(item.timestamp, locale)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-green-300">{formatEur(item.amountEur, locale)}</p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.paymentMode === 'stripe'
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'bg-yellow-500/15 text-yellow-300'
                    }`}
                  >
                    {item.paymentMode === 'stripe'
                      ? t('admin.donations.modeStripe')
                      : t('admin.donations.modeSimulation')}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#1e1e2f] flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                <span>
                  {t('admin.donations.platformShare')}:{' '}
                  <span className="text-purple-300">{formatEur(item.platformFeeCents / 100, locale)}</span>
                </span>
                <span>
                  {t('admin.donations.creatorShare')}:{' '}
                  <span className="text-green-300/90">{formatEur(item.creatorNetCents / 100, locale)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
