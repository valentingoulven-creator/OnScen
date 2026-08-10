import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface LiveStripeConnectGateProps {
  token: string;
  isPending: boolean;
  onClose: () => void;
  onSkip?: () => void;
}

/**
 * Gate 1 — Stripe Connect requis avant de lancer un live.
 * Affiché si le créateur n'a pas de compte Stripe Connect actif (charges_enabled).
 * isPending = true → le compte existe mais n'est pas encore validé par Stripe.
 */
export function LiveStripeConnectGate({ token, isPending, onClose, onSkip }: LiveStripeConnectGateProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#0f0f1a] border border-[#2a2a3f] rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">{t('live.stripeGateTitle')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('live.stripeGateSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-500 hover:text-white text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Features list */}
        {!isPending && (
          <ul className="space-y-2">
            {[
              t('live.stripeGateItem1'),
              t('live.stripeGateItem2'),
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-gray-300">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-[9px] text-purple-400 font-bold">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}

        {/* Pending state */}
        {isPending && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
            {t('live.stripeGateNotReady')}
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* CTA */}
        <button
          type="button"
          onClick={() => void handleOnboard()}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50 transition"
        >
          {busy
            ? t('profile.stripeConnect.onboarding')
            : isPending
              ? t('live.stripeGateNotReadyCta')
              : t('live.stripeGateCta')}
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition"
          >
            {t('live.stripeGateSkip')}
          </button>
        )}

        <p className="text-[10px] text-gray-600 text-center">{t('live.stripeGateProfileHint')}</p>
      </div>
    </div>
  );
}
