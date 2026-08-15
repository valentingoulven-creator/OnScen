import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api } from '../lib/api';
import { isNativeApp } from '../lib/nativePlatform';
import {
  computeDonationFeeBreakdown,
  DONATION_PAYMENT_TERMS_DOC_KEY,
  DONATION_STRIPE_TERMS_URL,
  userCanDonateByAge,
  type DonationsConfig,
} from '../lib/donations';
import { donAmountValidationMessage, donationOptionEmoji, parseDonAmount, donTierEmoji } from '../lib/liveReactions';
import type { LiveGoal } from '../lib/liveHostTypes';
import { hasThirdPartyCookieConsent } from '../lib/cookieConsent';
import { LegalDocumentView } from './LegalDocumentView';
import type { LegalKey } from '../content/legal';
import type { LiveDonationOption } from '../types';

interface LiveDonationSheetProps {
  open: boolean;
  onClose: () => void;
  liveId: string;
  hostName: string;
  /** Avatar URL de l'hôte (optionnel). */
  hostAvatarUrl?: string;
  token: string;
  userAge?: number;
  initialAmount?: number;
  /** Menu personnalisé par l'hôte (catalogue récompenses). */
  hostDonationOptions?: LiveDonationOption[];
  /** Goals actifs avec progression (spectateurs). */
  activeGoals?: LiveGoal[];
  onSuccess: (message: string) => void;
}

function formatEur(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function goalUnit(type: LiveGoal['type']): string {
  switch (type) {
    case 'amount': return '€';
    case 'dons': return 'dons';
    case 'likes': return 'likes';
    case 'viewers': return 'spec.';
    case 'duration': return 'min';
  }
}

/* ── Host identity block ── */
function HostIdentityRow({ hostName, hostAvatarUrl }: { hostName: string; hostAvatarUrl?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {hostAvatarUrl ? (
        <img
          src={hostAvatarUrl}
          alt={hostName}
          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-pink-500/40"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-600 to-purple-700 flex items-center justify-center shrink-0 text-white font-bold text-sm">
          {hostName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-pink-400/80">Soutenir</p>
        <p className="text-sm font-bold text-white truncate">{hostName}</p>
      </div>
    </div>
  );
}

/* ── Primary goal card (first active goal) ── */
function PrimaryGoalCard({ goal }: { goal: LiveGoal }) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;
  const remaining = goal.type === 'amount'
    ? `${goal.target - goal.current} € restants`
    : null;

  return (
    <div
      className={`rounded-xl border p-4 mb-1 ${
        done
          ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 to-emerald-900/20'
          : 'border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-purple-900/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0" aria-hidden>{done ? '✅' : '🎯'}</span>
          <p className="text-sm font-bold text-white truncate">{goal.label}</p>
        </div>
        <span
          className={`shrink-0 text-sm font-black tabular-nums ${
            done ? 'text-emerald-400' : 'text-purple-300'
          }`}
        >
          {pct}%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-purple-600 to-pink-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400 tabular-nums">
          {goal.current} / {goal.target} {goalUnit(goal.type)}
        </p>
        {remaining && !done && (
          <p className="text-[10px] text-purple-300 font-medium">{remaining}</p>
        )}
        {done && (
          <p className="text-[10px] text-emerald-400 font-bold">Objectif atteint !</p>
        )}
      </div>

      {!done && (
        <p className="text-[10px] text-purple-300/70 mt-2 italic">
          Votre don contribue à cet objectif
        </p>
      )}
    </div>
  );
}

/* ── Secondary goal mini-row ── */
function GoalMiniRow({ goal }: { goal: LiveGoal }) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        done ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-[#2a2a3a] bg-[#12121a]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 mb-1">
        <span className={`text-[9px] font-black uppercase tracking-wider shrink-0 ${done ? 'text-emerald-400' : 'text-gray-500'}`}>
          {done ? '✓' : 'Goal'}
        </span>
        <span className="text-xs font-semibold text-white truncate flex-1 min-w-0">{goal.label}</span>
        <span className={`text-[10px] font-bold tabular-nums shrink-0 ${done ? 'text-emerald-400' : 'text-gray-400'}`}>
          {goal.current}/{goal.target}{goalUnit(goal.type)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-emerald-500' : 'bg-purple-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Reward tier card ── */
function RewardCard({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: LiveDonationOption;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const emoji = donationOptionEmoji(option);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center min-h-[6.5rem] py-3 px-2 rounded-2xl border
        active:scale-95 transition-all duration-150 disabled:opacity-50 text-left w-full
        ${selected
          ? 'bg-pink-900/60 border-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.25)]'
          : 'bg-[#16121e] border-[#2d2040] hover:border-pink-500/50 hover:bg-pink-950/30'
        }
      `}
    >
      {selected && (
        <span className="absolute top-2 right-2 text-[9px] font-black text-pink-300 bg-pink-900/80 rounded-full px-1.5 py-0.5">
          ✓
        </span>
      )}
      <span className="text-2xl leading-none mb-1.5" aria-hidden>{emoji}</span>
      <span className={`text-[11px] font-semibold text-center line-clamp-2 leading-tight px-1 ${selected ? 'text-white' : 'text-pink-100/80'}`}>
        {option.label}
      </span>
      <span className={`text-sm font-black mt-1.5 tabular-nums ${selected ? 'text-pink-200' : 'text-pink-300'}`}>
        {option.amount} €
      </span>
    </button>
  );
}

/* ── Generic tier button ── */
function GenericTierButton({
  amount,
  selected,
  disabled,
  onClick,
}: {
  amount: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center py-4 rounded-xl border active:scale-95 transition disabled:opacity-50 ${
        selected
          ? 'bg-pink-900/50 border-pink-400'
          : 'bg-pink-950/40 border-pink-500/40 hover:border-pink-400'
      }`}
    >
      <span className="text-2xl">{donTierEmoji(amount)}</span>
      <span className="text-sm font-bold text-pink-200 mt-1">{amount} €</span>
    </button>
  );
}

/* ── Stripe confirm step ── */
function StripeConfirmForm({
  amount,
  onSuccess,
  onError,
  onCancel,
}: {
  amount: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      });
      if (error) {
        onError(error.message ?? 'Paiement refusé');
        return;
      }
      if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      } else {
        onError('Paiement en attente de confirmation');
      }
    } catch {
      onError('Erreur lors du paiement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">{t('live.donationSecurePay', { amount })}</p>
      <PaymentElement options={{ layout: 'tabs' }} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-2.5 rounded-lg border border-[#2d2d3d] text-sm text-gray-300 disabled:opacity-50"
        >
          {t('live.donationBack')}
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!stripe || !elements || busy}
          className="flex-1 py-2.5 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-500 disabled:opacity-50"
        >
          {busy ? '…' : t('live.donationPay')}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main component                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

export function LiveDonationSheet({
  open,
  onClose,
  liveId,
  hostName,
  hostAvatarUrl,
  token,
  userAge,
  initialAmount,
  hostDonationOptions,
  activeGoals = [],
  onSuccess,
}: LiveDonationSheetProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<DonationsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(initialAmount ?? null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [legalPreview, setLegalPreview] = useState<LegalKey | null>(null);

  const needsAgeCheckbox = userAge == null || userAge < 18;
  const canProceedAge = userCanDonateByAge(userAge, ageConfirmed);

  const hostOptions =
    hostDonationOptions?.filter((o) => o.label.trim() && o.amount >= 1 && o.amount <= 100) ?? [];
  const useHostMenu = hostOptions.length > 0;

  const tiers = useHostMenu ? hostOptions.map((o) => o.amount) : config?.tiers?.length ? config.tiers : [1, 2, 5];
  const minAmount = config?.minAmount ?? 1;
  const maxAmount = config?.maxAmount ?? 100;
  const platformFeePercent = config?.platformFeePercent ?? 30;

  const selectedOption = useHostMenu
    ? (hostOptions.find((o) => o.id === selectedOptionId) ?? null)
    : null;

  const primaryGoal = activeGoals.length > 0 ? activeGoals[0] : null;
  const secondaryGoals = activeGoals.length > 1 ? activeGoals.slice(1) : [];

  const stripePromise = useMemo(
    () =>
      publishableKey && hasThirdPartyCookieConsent() ? loadStripe(publishableKey) : null,
    [publishableKey]
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    setConsentChecked(false);
    setAgeConfirmed(false);
    setLegalPreview(null);
    setCustomAmount(initialAmount != null ? String(initialAmount) : '');
    setSelectedAmount(initialAmount ?? null);
    setSelectedOptionId(null);

    void api
      .getDonationsConfig(token)
      .then((c) => setConfig(c))
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [open, token, initialAmount]);

  if (!open) return null;

  if (isNativeApp()) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center ms-modal-overlay bg-black/60" onClick={onClose}>
        <div
          className="w-full max-w-md bg-[#12121a] rounded-t-2xl sm:rounded-2xl ms-modal-panel border border-[#2d2d3d] shadow-2xl p-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-white">{t('live.donationSheetTitle')}</p>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
          </div>
          <p className="text-sm text-gray-400 text-center">{t('live.nativeIapDonation')}</p>
        </div>
      </div>
    );
  }

  const resolvedAmount = (): number | null => {
    if (selectedAmount != null) return selectedAmount;
    return parseDonAmount(customAmount);
  };

  const amountForBreakdown = resolvedAmount();
  const feeBreakdown =
    amountForBreakdown != null && amountForBreakdown >= minAmount && amountForBreakdown <= maxAmount
      ? computeDonationFeeBreakdown(amountForBreakdown, platformFeePercent)
      : null;

  const paymentTermsDocKey =
    (config?.legal?.paymentTermsDocKey as LegalKey | undefined) ?? DONATION_PAYMENT_TERMS_DOC_KEY;
  const stripeTermsUrl = config?.legal?.stripeTermsUrl ?? DONATION_STRIPE_TERMS_URL;

  const validateBeforePay = (amount: number | null): string | null => {
    if (!config?.enabled) return t('donation.legal.disabled');
    if (!canProceedAge) return t('donation.legal.ageRequired');
    if (!consentChecked) return t('donation.legal.consentRequired');
    if (amount == null || amount < minAmount || amount > maxAmount) {
      return donAmountValidationMessage();
    }
    if (config.simulation && config.dailyCapRemaining != null && amount > config.dailyCapRemaining) {
      return `Plafond journalier de simulation atteint (${config.dailyCapRemaining} € restants)`;
    }
    return null;
  };

  const startPayment = async () => {
    const amount = resolvedAmount();
    const validationError = validateBeforePay(amount);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (amount == null) return;

    setSubmitting(true);
    setError(null);
    try {
      if (config?.simulation) {
        const r = await api.simulateDonation(token, liveId, amount, ageConfirmed || canProceedAge);
        onSuccess(r.message);
        onClose();
        return;
      }

      const r = await api.createDonationIntent(token, liveId, amount, ageConfirmed || canProceedAge);
      setPublishableKey(config?.publishableKey ?? null);
      setClientSecret(r.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const buildConfirmLabel = (): string => {
    if (config?.simulation) {
      if (selectedOption) return `🎁 Simuler : ${selectedOption.label}`;
      return t('live.donationContinueSimulate');
    }
    const amount = resolvedAmount();
    if (selectedOption && amount != null) {
      return `🎁 Obtenir : ${selectedOption.label} · ${amount} €`;
    }
    if (amount != null && primaryGoal && !selectedOption) {
      return `🎯 Contribuer — ${amount} €`;
    }
    return t('live.donationContinuePay');
  };

  if (legalPreview) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0f]">
        <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center ms-modal-overlay bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#12121a] rounded-t-2xl sm:rounded-2xl ms-modal-panel border border-[#2d2d3d] shadow-2xl p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('live.donationSheetTitle')}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            ✕
          </button>
        </div>

        {/* Simulation banner */}
        {config?.simulation && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100 font-medium">
            {t('live.donationSimulationBanner')}
          </div>
        )}

        {/* Disabled */}
        {!loading && config && !config.enabled && (
          <p className="text-sm text-gray-400 text-center py-6">{t('live.donationDisabled')}</p>
        )}

        {loading && <p className="text-sm text-gray-500 text-center py-6">{t('live.donationLoading')}</p>}

        {!loading && config?.enabled && !clientSecret && (
          <>
            {/* Host identity */}
            <HostIdentityRow hostName={hostName} hostAvatarUrl={hostAvatarUrl} />

            {/* ── Goals section ── */}
            {activeGoals.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300/80 mb-2">
                  {t('live.donationActiveGoals')}
                </p>
                {primaryGoal && <PrimaryGoalCard goal={primaryGoal} />}
                {secondaryGoals.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {secondaryGoals.map((g) => (
                      <GoalMiniRow key={g.id} goal={g} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Reward tiers OR generic tiers ── */}
            {useHostMenu ? (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-pink-300/80 mb-2">
                  {t('live.donationRewardsTitle')}
                </p>
                <div
                  className={`grid gap-2 ${
                    hostOptions.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  {hostOptions.map((opt) => (
                    <RewardCard
                      key={opt.id}
                      option={opt}
                      selected={selectedOptionId === opt.id}
                      disabled={submitting}
                      onClick={() => {
                        setSelectedAmount(opt.amount);
                        setSelectedOptionId(opt.id);
                        setCustomAmount('');
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-pink-300/80 mb-2">
                  Montant rapide
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {tiers.map((tier) => (
                    <GenericTierButton
                      key={tier}
                      amount={tier}
                      selected={selectedAmount === tier && selectedOptionId == null}
                      disabled={submitting}
                      onClick={() => {
                        setSelectedAmount(tier);
                        setSelectedOptionId(null);
                        setCustomAmount('');
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Free amount */}
            <div className="rounded-xl border border-pink-500/30 bg-pink-950/20 p-3 mb-4">
              <p className="text-xs font-bold text-pink-200 mb-2">{t('live.donationCustomAmount')}</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={minAmount}
                  max={maxAmount}
                  step={1}
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                    setSelectedOptionId(null);
                  }}
                  placeholder={`${minAmount}–${maxAmount}`}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2.5 text-sm text-white"
                />
                <span className="self-center text-gray-400 text-sm">€</span>
              </div>
            </div>

            {/* Fee breakdown */}
            {feeBreakdown && (
              <div className="rounded-xl border border-[#2d2d3d] bg-[#1a1a26] p-3 mb-4 text-xs text-gray-300 space-y-1.5">
                <p className="font-bold text-white text-sm mb-2">{t('donation.legal.breakdownTitle')}</p>
                <div className="flex justify-between gap-2">
                  <span>{t('donation.legal.breakdownAmount')}</span>
                  <span className="font-medium text-white">{formatEur(feeBreakdown.amountEur)} €</span>
                </div>
                <div className="flex justify-between gap-2 text-pink-200">
                  <span>{t('donation.legal.breakdownPlatformFee', { percent: feeBreakdown.platformFeePercent })}</span>
                  <span className="font-medium">− {formatEur(feeBreakdown.platformFeeEur)} €</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-[#2d2d3d] pt-1.5">
                  <span>{t('donation.legal.breakdownCreatorNet')}</span>
                  <span className="font-bold text-emerald-300">{formatEur(feeBreakdown.creatorNetEstimateEur)} €</span>
                </div>
                <p className="text-[10px] text-gray-500 pt-1">{t('donation.legal.breakdownStripeNote')}</p>
              </div>
            )}

            {/* Legal text */}
            <div className="rounded-xl border border-[#2d2d3d] bg-[#0f0f16] p-3 mb-3 max-h-36 overflow-y-auto text-[11px] text-gray-400 space-y-2">
              <p>{t('donation.legal.nature')}</p>
              <p>{t('donation.legal.platformFee', { percent: platformFeePercent })}</p>
              <p>{t('donation.legal.creatorIncome')}</p>
              <p>{t('donation.legal.refund')}</p>
              <p>{t('donation.legal.rgpd')}</p>
              <p>
                <button
                  type="button"
                  className="text-pink-300 underline"
                  onClick={() => setLegalPreview(paymentTermsDocKey)}
                >
                  {t('donation.legal.paymentTermsLink')}
                </button>
                {' · '}
                <a
                  href={stripeTermsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-300 underline"
                >
                  {t('donation.legal.stripeTermsLink')}
                </a>
              </p>
            </div>

            {/* Age checkbox */}
            {needsAgeCheckbox && (
              <label className="flex items-start gap-2 mb-3 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t('live.donationAgeCheckbox')}</span>
              </label>
            )}

            {/* Consent checkbox */}
            <label className="flex items-start gap-2 mb-3 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>{t('donation.legal.acceptCheckbox')}</span>
            </label>

            {error && <p className="text-xs text-red-400 text-center mb-3">{error}</p>}

            {/* Dynamic confirm button */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void startPayment()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-sm hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-pink-900/30"
            >
              {submitting ? '…' : buildConfirmLabel()}
            </button>
          </>
        )}

        {clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, locale: 'fr' }}>
            <StripeConfirmForm
              amount={resolvedAmount() ?? 0}
              onCancel={() => setClientSecret(null)}
              onError={(msg) => setError(msg)}
              onSuccess={() => {
                onSuccess(t('live.donationThanks'));
                onClose();
              }}
            />
          </Elements>
        )}

        {clientSecret && !stripePromise && (
          <p className="text-sm text-red-400 text-center">{t('live.donationStripeConfigError')}</p>
        )}
      </div>
    </div>
  );
}
