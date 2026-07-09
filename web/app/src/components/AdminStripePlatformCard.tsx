import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { StripePlatformStatusReport } from '../types';

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AdminStripePlatformCard() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<StripePlatformStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const report = await api.getStripePlatformStatus(token);
      setStatus(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.stripePlatform.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] px-4 py-4">
        <p className="text-xs text-gray-500">{t('admin.stripePlatform.loading')}</p>
      </div>
    );
  }

  const ready =
    status?.connected === true &&
    status.chargesEnabled === true &&
    status.payoutsEnabled === true;

  const keyModeLabel =
    status?.keyMode === 'live'
      ? t('admin.stripePlatform.modeLive')
      : status?.keyMode === 'test'
        ? t('admin.stripePlatform.modeTest')
        : null;

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-600/10 to-[#12121a] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{t('admin.stripePlatform.title')}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {t('admin.stripePlatform.hint', { percent: status?.platformFeePercent ?? 30 })}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
            ready
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : status?.stripeConfigured
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                : 'bg-red-500/15 text-red-300 border border-red-500/25'
          }`}
        >
          {ready
            ? t('admin.stripePlatform.statusReady')
            : status?.stripeConfigured
              ? t('admin.stripePlatform.statusPending')
              : t('admin.stripePlatform.statusMissing')}
        </span>
      </div>

      {status?.simulationMode && (
        <p className="text-[10px] text-yellow-400/90">{t('admin.stripePlatform.simulationBadge')}</p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {status?.error && (
        <p className="text-[11px] text-amber-400/90">{status.error}</p>
      )}

      {status?.stripeConfigured && status.connected && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          {status.businessName && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.businessName')}</dt>
              <dd className="text-white font-medium truncate">{status.businessName}</dd>
            </div>
          )}
          {status.accountId && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.accountId')}</dt>
              <dd className="text-purple-300 font-mono text-[10px] truncate">{status.accountId}</dd>
            </div>
          )}
          {keyModeLabel && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.keyMode')}</dt>
              <dd className="text-white">{keyModeLabel}</dd>
            </div>
          )}
          {status.country && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.country')}</dt>
              <dd className="text-white uppercase">{status.country}</dd>
            </div>
          )}
          {status.availableBalanceEur != null && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.availableBalance')}</dt>
              <dd className="text-green-300 font-semibold">{formatEur(status.availableBalanceEur, locale)}</dd>
            </div>
          )}
          {status.pendingBalanceEur != null && status.pendingBalanceEur > 0 && (
            <div>
              <dt className="text-gray-500">{t('admin.stripePlatform.pendingBalance')}</dt>
              <dd className="text-amber-300">{formatEur(status.pendingBalanceEur, locale)}</dd>
            </div>
          )}
        </dl>
      )}

      {!status?.stripeConfigured && (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#0f0f17] px-3 py-3 space-y-1.5">
          <p className="text-[11px] text-gray-300 font-semibold">{t('admin.stripePlatform.setupTitle')}</p>
          <p className="text-[10px] text-gray-500">{t('admin.stripePlatform.setupStep1')}</p>
          <p className="text-[10px] text-gray-500 font-mono">STRIPE_SECRET_KEY=sk_…</p>
          <p className="text-[10px] text-gray-500 font-mono">STRIPE_PUBLISHABLE_KEY=pk_…</p>
          <p className="text-[10px] text-gray-500">{t('admin.stripePlatform.setupStep2')}</p>
        </div>
      )}

      {status?.setupHint === 'payouts_pending' && (
        <p className="text-[10px] text-amber-400/90">{t('admin.stripePlatform.payoutsPending')}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {status?.dashboardUrl && (
          <a
            href={status.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[44px] flex items-center justify-center px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition text-center"
          >
            {t('admin.stripePlatform.openDashboard')}
          </a>
        )}
        {status?.applicationFeesUrl && status.stripeConfigured && (
          <a
            href={status.applicationFeesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[44px] flex items-center justify-center px-3 py-2.5 rounded-xl bg-[#1a1a26] hover:bg-[#222230] text-purple-300 border border-purple-500/20 text-xs font-semibold transition text-center"
          >
            {t('admin.stripePlatform.openFees')}
          </a>
        )}
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          {loading ? t('admin.stripePlatform.refreshing') : t('admin.stripePlatform.refresh')}
        </button>
      </div>
    </div>
  );
}
