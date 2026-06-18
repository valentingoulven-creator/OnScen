import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { DONATION_MIN_AGE } from '../lib/donations';
import type { User } from '../types';

interface CreatorStripeConnectCardProps {
  token: string;
  user: User;
  onUserUpdated?: () => void;
}

export function CreatorStripeConnectCard({
  token,
  user,
  onUserUpdated,
}: CreatorStripeConnectCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState(true);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [chargesEnabled, setChargesEnabled] = useState<boolean | null>(null);
  const [detailsSubmitted, setDetailsSubmitted] = useState<boolean | null>(null);

  const meetsAge =
    typeof user.age === 'number' && user.age >= DONATION_MIN_AGE;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [config, status] = await Promise.all([
        api.getDonationsConfig(token),
        api.getStripeConnectStatus(token),
      ]);
      setSimulation(config.simulation);
      setStripeConfigured(status.stripeConfigured);
      setReady(status.ready);
      setChargesEnabled(status.chargesEnabled ?? null);
      setDetailsSubmitted(status.detailsSubmitted ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.stripeConnect.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!meetsAge) return null;
  if (loading) {
    return (
      <p className="text-[10px] text-gray-500 text-center py-1">
        {t('profile.stripeConnect.loading')}
      </p>
    );
  }
  if (simulation || !stripeConfigured) return null;

  const handleOnboard = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.startStripeConnectOnboard(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.stripeConnect.onboardError'));
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{t('profile.stripeConnect.title')}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{t('profile.stripeConnect.hint')}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            ready
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
          }`}
        >
          {ready ? t('profile.stripeConnect.statusReady') : t('profile.stripeConnect.statusPending')}
        </span>
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {!ready && (
        <button
          type="button"
          onClick={() => void handleOnboard()}
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 transition"
        >
          {busy ? t('profile.stripeConnect.onboarding') : t('profile.stripeConnect.cta')}
        </button>
      )}

      {ready && (
        <p className="text-[10px] text-green-400/90">{t('profile.stripeConnect.readyHint')}</p>
      )}

      {!ready && detailsSubmitted === true && chargesEnabled === false && (
        <p className="text-[10px] text-amber-400/80 mt-1">
          {t('profile.stripeConnect.pendingVerification', 'Vérification Stripe en cours — vous serez notifié(e) quand le compte sera activé.')}
        </p>
      )}

      {!ready && (
        <button
          type="button"
          onClick={() => {
            void refresh().then(() => onUserUpdated?.());
          }}
          className="w-full text-[10px] text-gray-500 hover:text-gray-300 underline"
        >
          {t('profile.stripeConnect.refresh')}
        </button>
      )}
    </div>
  );
}
