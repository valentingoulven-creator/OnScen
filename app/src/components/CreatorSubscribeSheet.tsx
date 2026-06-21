import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { isNativeIos } from '../lib/nativePlatform';
import {
  formatTierPrice,
  SUBSCRIPTION_LEGAL_NOTICE,
  SUBSCRIPTION_STRIPE_TERMS_URL,
  userCanSubscribeByAge,
  type SubscriptionsConfig,
  type SubscriptionTargetType,
} from '../lib/subscriptions';

interface CreatorSubscribeSheetProps {
  open: boolean;
  onClose: () => void;
  token: string;
  userAge?: number;
  /** Créateur ciblé ; absent pour Soundly+ */
  creatorId?: string;
  creatorName?: string;
  targetType?: SubscriptionTargetType;
  onSuccess: (message: string) => void;
}

export function CreatorSubscribeSheet({
  open,
  onClose,
  token,
  userAge,
  creatorId,
  creatorName,
  targetType = 'creator',
  onSuccess,
}: CreatorSubscribeSheetProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SubscriptionsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const needsAgeCheckbox = userAge == null || userAge < 18;
  const canProceedAge = userCanSubscribeByAge(userAge, ageConfirmed);

  // App Store Guideline 3.1.1 — Stripe subscriptions must not be offered on native iOS.
  const nativeIos = isNativeIos();

  const title =
    targetType === 'platform'
      ? 'Soundy+'
      : `Soutenir ${creatorName ?? 'ce créateur'}`;

  const tiers =
    config?.tiers.filter((tier) => tier.targetType === targetType) ?? [];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setConsentChecked(false);
    setAgeConfirmed(false);
    setSelectedTierId(null);

    void api
      .getSubscriptionsConfig(token)
      .then((c) => {
        setConfig(c);
        const first = c.tiers.find((tier) => tier.targetType === targetType);
        if (first) setSelectedTierId(first.id);
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [open, token, targetType]);

  if (!open) return null;

  if (nativeIos) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
        <div
          className="bg-[#12121a] rounded-t-2xl border-t border-[#2d2d3d] shadow-2xl p-6 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-white">{title}</p>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
          </div>
          <p className="text-sm text-gray-400 text-center">{t('subscription.iosIapNotice')}</p>
        </div>
      </div>
    );
  }

  const validate = (): string | null => {
    if (!config?.enabled) return 'Les abonnements sont temporairement désactivés';
    if (!canProceedAge) return 'Vous devez avoir 18 ans ou plus pour vous abonner';
    if (!consentChecked) return 'Veuillez accepter les conditions avant de continuer';
    if (!selectedTierId) return 'Choisissez un palier';
    if (config.simulation && config.dailyCapRemaining === 0) {
      return 'Plafond journalier de simulation atteint';
    }
    return null;
  };

  const subscribe = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!selectedTierId) return;

    setSubmitting(true);
    setError(null);
    try {
      if (config?.simulation) {
        const r = await api.simulateSubscription(token, {
          creatorId,
          tierId: selectedTierId,
          targetType,
          ageConfirmed: ageConfirmed || canProceedAge,
        });
        onSuccess(r.message);
        onClose();
        return;
      }

      const r = await api.createSubscriptionCheckout(token, {
        creatorId,
        tierId: selectedTierId,
        targetType,
        ageConfirmed: ageConfirmed || canProceedAge,
      });
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
      } else {
        setError('Lien de paiement indisponible');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-[#12121a] rounded-t-2xl border-t border-[#2d2d3d] shadow-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white">{title}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">
            ✕
          </button>
        </div>

        {config?.simulation && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100 font-medium">
            Simulation — aucun paiement réel, aucune carte demandée
          </div>
        )}

        {!loading && config && !config.enabled && (
          <p className="text-sm text-gray-400 text-center py-6">
            Les abonnements ne sont pas disponibles pour le moment.
          </p>
        )}

        {loading && <p className="text-sm text-gray-500 text-center py-6">Chargement…</p>}

        {!loading && config?.enabled && (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {targetType === 'platform'
                ? 'Soutenez Soundy avec un abonnement mensuel récurrent (EUR).'
                : `Abonnement mensuel récurrent pour soutenir ${creatorName ?? 'ce créateur'} (EUR).`}
              {config.platformCommissionPercent > 0 && targetType === 'creator' && (
                <span className="block mt-1 text-gray-500">
                  Commission plateforme indicative : {config.platformCommissionPercent} % (hors frais Stripe).
                </span>
              )}
            </p>

            <div className="space-y-2 mb-4">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition disabled:opacity-50 ${
                    selectedTierId === tier.id
                      ? 'bg-purple-900/50 border-purple-400'
                      : 'bg-purple-950/30 border-purple-500/30 hover:border-purple-400'
                  }`}
                >
                  <span className="font-semibold text-purple-100">{tier.label}</span>
                  <span className="text-sm font-bold text-purple-200">
                    {formatTierPrice(tier.amountEur)}
                  </span>
                </button>
              ))}
            </div>

            {needsAgeCheckbox && (
              <label className="flex items-start gap-2 mb-3 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Je certifie avoir 18 ans ou plus et être autorisé à utiliser un moyen de paiement.</span>
              </label>
            )}

            <label className="flex items-start gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                {SUBSCRIPTION_LEGAL_NOTICE}{' '}
                <a
                  href={SUBSCRIPTION_STRIPE_TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  CGV Stripe
                </a>
              </span>
            </label>

            {error && <p className="text-xs text-red-400 text-center mb-3">{error}</p>}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void subscribe()}
              className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 disabled:opacity-50"
            >
              {config.simulation ? 'Simuler l’abonnement' : 'Continuer vers Stripe Checkout'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
