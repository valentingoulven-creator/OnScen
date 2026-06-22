import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isNativeApp } from '../lib/nativePlatform';
import {
  formatTierPrice,
  SUBSCRIPTION_LEGAL_NOTICE,
  SUBSCRIPTION_STRIPE_TERMS_URL,
  userCanSubscribeByAge,
  type PlatformPlanConfig,
  type PlatformPlanStatusResponse,
  type SubscriptionsConfig,
} from '../lib/subscriptions';

interface PlatformSubscriptionPageProps {
  onBack: () => void;
}

function formatMinutesLabel(minutes: number | null): string {
  if (minutes == null) return 'Illimité';
  if (minutes % 60 === 0) return `${minutes / 60} h / jour`;
  return `${minutes} min / jour`;
}

function formatViewersLabel(max: number | null): string {
  if (max == null) return 'Illimités';
  return `Jusqu'à ${max}`;
}

function planBadgeClass(current: boolean): string {
  const base = 'rounded-xl border p-4 transition ';
  if (current) return `${base} border-purple-400 bg-purple-950/40 ring-1 ring-purple-400/50`;
  return `${base} border-[#2d2d3d] bg-[#12121a]`;
}

export function PlatformSubscriptionPage({ onBack }: PlatformSubscriptionPageProps) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [status, setStatus] = useState<PlatformPlanStatusResponse | null>(null);
  const [config, setConfig] = useState<SubscriptionsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTierId, setBusyTierId] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const needsAgeCheckbox = user?.age == null || user.age < 18;
  const canProceedAge = userCanSubscribeByAge(user?.age, ageConfirmed);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [planStatus, subConfig] = await Promise.all([
        api.getPlatformPlan(token),
        api.getSubscriptionsConfig(token),
      ]);
      setStatus(planStatus);
      setConfig(subConfig);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const subscribeToPlan = async (plan: PlatformPlanConfig) => {
    if (!token) {
      setError('Vous devez être connecté pour vous abonner.');
      return;
    }
    if (!plan.subscriptionTierId) {
      setError("Ce plan n'est pas disponible à l'abonnement.");
      return;
    }
    if (!config?.enabled) {
      setError('Les abonnements sont temporairement désactivés.');
      return;
    }
    if (!canProceedAge) {
      setError('Vous devez avoir 18 ans ou plus pour vous abonner.');
      return;
    }
    if (!consentChecked) {
      setError('Veuillez accepter les conditions avant de continuer.');
      return;
    }

    setBusyTierId(plan.id);
    setError(null);
    setMessage(null);
    try {
      if (config.simulation) {
        const r = await api.simulateSubscription(token, {
          tierId: plan.subscriptionTierId,
          targetType: 'platform',
          ageConfirmed: ageConfirmed || canProceedAge,
        });
        setMessage(r.message);
        await reload();
        return;
      }
      const r = await api.createSubscriptionCheckout(token, {
        tierId: plan.subscriptionTierId,
        targetType: 'platform',
        ageConfirmed: ageConfirmed || canProceedAge,
      });
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else setError('Lien de paiement indisponible');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyTierId(null);
    }
  };

  const currentPlanId = status?.plan.id ?? 'free';
  const plans = status?.plans ?? config?.platformPlans ?? [];
  // Le bouton est actif seulement quand l'âge et le consentement sont confirmés
  const canSubscribeNow = canProceedAge && consentChecked;

  // App Store Guideline 3.1.1 + Google Play Billing Policy:
  // Stripe subscriptions must not be offered on native iOS or Android.
  if (isNativeApp()) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f] text-white">
        <header className="sticky top-0 z-10 shrink-0 bg-[#0b0b0f]/95 backdrop-blur border-b border-[#1e1e2f] px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-purple-400 hover:text-purple-300 text-sm font-medium shrink-0">
            ← {t('common.back')}
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold truncate">{t('subscription.title')}</h1>
          <span className="w-10 shrink-0" aria-hidden />
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-400 text-center max-w-xs">{t('subscription.iosIapNotice')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f] text-white">
      <header className="sticky top-0 z-10 shrink-0 bg-[#0b0b0f]/95 backdrop-blur border-b border-[#1e1e2f] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-purple-400 hover:text-purple-300 text-sm font-medium shrink-0"
        >
          ← {t('common.back')}
        </button>
        <h1 className="flex-1 text-center text-sm font-semibold truncate">
          {t('subscription.title')}
        </h1>
        <span className="w-10 shrink-0" aria-hidden />
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-8 max-w-lg mx-auto w-full space-y-4">
        {loading && <p className="text-sm text-gray-500 text-center py-8">{t('common.loading')}</p>}

        {/* Affichage de l'erreur quand status est null (échec API) – doit être hors du bloc status && */}
        {!loading && !status && error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {!loading && status && (
          <>
            <section className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                {t('subscription.currentPlan')}
              </p>
              <p className="text-lg font-bold text-purple-200">{status.plan.label}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>
                  <span className="block text-gray-500">{t('subscription.viewers')}</span>
                  <span className="text-white font-medium">
                    {formatViewersLabel(status.plan.limits.maxViewers)}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500">{t('subscription.dailyLive')}</span>
                  <span className="text-white font-medium">
                    {formatMinutesLabel(status.plan.limits.maxLiveMinutesPerDay)}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500">OBS / Cloudflare</span>
                  <span className="text-white font-medium">
                    {status.plan.limits.allowObs ? t('subscription.yes') : t('subscription.no')}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500">{t('subscription.liveToday')}</span>
                  <span className="text-white font-medium">
                    {status.dailyLiveMinutesUsed} min
                    {status.dailyLiveMinutesLimit != null
                      ? ` / ${status.dailyLiveMinutesLimit} min`
                      : ''}
                  </span>
                </div>
              </div>
              {status.activePlatformSubscription && (
                <p className="mt-3 text-[11px] text-gray-500">
                  {t('subscription.renewsOn', {
                    date: new Date(status.activePlatformSubscription.currentPeriodEnd).toLocaleDateString(
                      'fr-FR'
                    ),
                  })}
                </p>
              )}
            </section>

            {config?.simulation && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                {t('subscription.simulationNotice')}
              </div>
            )}

            {/* Notice explicite quand les abonnements sont désactivés (Stripe non configuré côté serveur) */}
            {config && !config.enabled && !config.simulation && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-200">
                Les abonnements payants ne sont pas encore disponibles. Revenez bientôt !
              </div>
            )}

            {/* Checkboxes consentement/âge placées EN HAUT, avant les cartes plans,
                pour que l'utilisateur les valide avant de cliquer sur "Choisir ce forfait" */}
            {(currentPlanId === 'free' || config?.enabled) && (
              <div className="rounded-xl border border-[#2d2d3d] p-3 space-y-2">
                {needsAgeCheckbox && (
                  <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t('subscription.ageConfirm')}</span>
                  </label>
                )}
                <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
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
                    >
                      CGV Stripe
                    </a>
                  </span>
                </label>
              </div>
            )}

            <section className="space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {t('subscription.comparePlans')}
              </p>
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const tier = config?.tiers.find(
                  (t) => t.targetType === 'platform' && t.id === plan.subscriptionTierId
                );
                const priceLabel =
                  plan.priceCents === 0
                    ? plan.priceDisplay
                    : tier
                      ? formatTierPrice(tier.amountEur)
                      : plan.priceDisplay;
                const canUpgrade =
                  plan.subscriptionTierId != null &&
                  !isCurrent &&
                  (plan.id === 'soundy_plus' || plan.id === 'soundy_ultra');

                return (
                  <div key={plan.id} className={planBadgeClass(isCurrent)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold text-white">{plan.label}</p>
                        <p className="text-sm text-purple-200 font-semibold">{priceLabel}</p>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-600/30 text-purple-200 font-bold shrink-0">
                          {t('subscription.active')}
                        </span>
                      )}
                    </div>
                    <ul className="text-xs text-gray-400 space-y-1 mb-3">
                      {plan.featuresFr.map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                    {canUpgrade && config?.enabled && (
                      <button
                        type="button"
                        disabled={busyTierId != null || !canSubscribeNow}
                        onClick={() => void subscribeToPlan(plan)}
                        title={
                          !consentChecked
                            ? 'Acceptez les conditions ci-dessus pour continuer'
                            : !canProceedAge
                              ? 'Confirmez votre âge ci-dessus pour continuer'
                              : undefined
                        }
                        className="w-full py-2.5 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busyTierId === plan.id
                          ? t('common.loading')
                          : !canSubscribeNow
                            ? '↑ Acceptez les conditions ci-dessus'
                            : t('subscription.choosePlan', { plan: plan.label })}
                      </button>
                    )}
                    {plan.id === 'free' && isCurrent && (
                      <p className="text-[11px] text-gray-500">{t('subscription.freeDefault')}</p>
                    )}
                  </div>
                );
              })}
            </section>

            {config?.enabled && currentPlanId !== 'free' && !config.simulation && (
              <button
                type="button"
                className="w-full py-2 text-sm text-purple-300 underline"
                onClick={() => {
                  if (!token) return;
                  void api
                    .createSubscriptionPortal(token, { targetType: 'platform' })
                    .then((r) => {
                      if (r.portalUrl) window.location.href = r.portalUrl;
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : "Impossible d'ouvrir le portail")
                    );
                }}
              >
                {t('subscription.manageBilling')}
              </button>
            )}

            {message && (
              <p className="text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">{message}</p>
            )}
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
