import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api } from '../lib/api';
import {
  computeDonationFeeBreakdown,
  DONATION_PAYMENT_TERMS_DOC_KEY,
  DONATION_STRIPE_TERMS_URL,
  userCanDonateByAge,
  type DonationsConfig,
} from '../lib/donations';
import { donAmountValidationMessage, donTierEmoji, parseDonAmount } from '../lib/liveReactions';
import { LegalDocumentView } from './LegalDocumentView';
import type { LegalKey } from '../content/legal';

interface LiveDonationSheetProps {
  open: boolean;
  onClose: () => void;
  liveId: string;
  hostName: string;
  token: string;
  userAge?: number;
  initialAmount?: number;
  onSuccess: (message: string) => void;
}

function formatEur(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
        confirmParams: {
          return_url: window.location.href,
        },
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

export function LiveDonationSheet({
  open,
  onClose,
  liveId,
  hostName,
  token,
  userAge,
  initialAmount,
  onSuccess,
}: LiveDonationSheetProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<DonationsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(initialAmount ?? null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [legalPreview, setLegalPreview] = useState<LegalKey | null>(null);

  const needsAgeCheckbox = userAge == null || userAge < 18;
  const canProceedAge = userCanDonateByAge(userAge, ageConfirmed);

  const tiers = config?.tiers?.length ? config.tiers : [1, 2, 5];
  const minAmount = config?.minAmount ?? 1;
  const maxAmount = config?.maxAmount ?? 100;
  const platformFeePercent = config?.platformFeePercent ?? 30;

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
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

    void api
      .getDonationsConfig(token)
      .then((c) => setConfig(c))
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, [open, token, initialAmount]);

  if (!open) return null;

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

  if (legalPreview) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0f]">
        <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="bg-[#12121a] rounded-t-2xl border-t border-[#2d2d3d] shadow-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-white">{t('live.donationSheetTitle')}</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">
            ✕
          </button>
        </div>

        {config?.simulation && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100 font-medium">
            {t('live.donationSimulationBanner')}
          </div>
        )}

        {!loading && config && !config.enabled && (
          <p className="text-sm text-gray-400 text-center py-6">{t('live.donationDisabled')}</p>
        )}

        {loading && <p className="text-sm text-gray-500 text-center py-6">{t('live.donationLoading')}</p>}

        {!loading && config?.enabled && !clientSecret && (
          <>
            <p className="text-xs text-gray-400 mb-4">{t('live.donationSupportHint', { hostName })}</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {tiers.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setSelectedAmount(tier);
                    setCustomAmount('');
                  }}
                  className={`flex flex-col items-center py-4 rounded-xl border active:scale-95 transition disabled:opacity-50 ${
                    selectedAmount === tier
                      ? 'bg-pink-900/50 border-pink-400'
                      : 'bg-pink-950/40 border-pink-500/40 hover:border-pink-400'
                  }`}
                >
                  <span className="text-2xl">{donTierEmoji(tier)}</span>
                  <span className="text-sm font-bold text-pink-200 mt-1">{tier} €</span>
                </button>
              ))}
            </div>

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
                  }}
                  placeholder={`${minAmount}–${maxAmount}`}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2.5 text-sm text-white"
                />
                <span className="self-center text-gray-400 text-sm">€</span>
              </div>
            </div>

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

            <button
              type="button"
              disabled={submitting}
              onClick={() => void startPayment()}
              className="w-full py-3 rounded-xl bg-pink-600 text-white font-bold text-sm hover:bg-pink-500 disabled:opacity-50"
            >
              {config.simulation ? t('live.donationContinueSimulate') : t('live.donationContinuePay')}
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
