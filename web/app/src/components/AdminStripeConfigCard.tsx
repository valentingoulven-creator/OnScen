import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ApiRequestError } from '../lib/api/core';
import type { StripeConfigFieldError, StripeConfigFieldErrorField, StripeConfigStatus } from '../types';

const SECRET_KEY_RE = /^sk_(live|test)_[A-Za-z0-9]{16,}$/;
const PUBLISHABLE_KEY_RE = /^pk_(live|test)_[A-Za-z0-9]{16,}$/;
const WEBHOOK_SECRET_RE = /^whsec_[A-Za-z0-9]{16,}$/;

function validateClientSide(
  secretKey: string,
  publishableKey: string,
  webhookSecret: string
): StripeConfigFieldError[] {
  const errors: StripeConfigFieldError[] = [];
  const secretValid = SECRET_KEY_RE.test(secretKey);
  const publishableValid = PUBLISHABLE_KEY_RE.test(publishableKey);

  if (!secretValid) errors.push({ field: 'secretKey', message: 'validation.secretKey' });
  if (!publishableValid) errors.push({ field: 'publishableKey', message: 'validation.publishableKey' });
  if (webhookSecret && !WEBHOOK_SECRET_RE.test(webhookSecret)) {
    errors.push({ field: 'webhookSecret', message: 'validation.webhookSecret' });
  }
  if (secretValid && publishableValid) {
    const secretMode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
    const pubMode = publishableKey.startsWith('pk_live_') ? 'live' : 'test';
    if (secretMode !== pubMode) errors.push({ field: 'mode', message: 'validation.mode' });
  }
  return errors;
}

function fieldError(
  errors: StripeConfigFieldError[],
  field: StripeConfigFieldErrorField
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function AdminStripeConfigCard() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState<StripeConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<StripeConfigFieldError[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getStripeConfig(token)
      .then((res) => {
        setStatus(res);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t('admin.stripeConfig.loadError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const messageFor = (key: string) => t(`admin.stripeConfig.${key}`);

  const submit = useCallback(async () => {
    if (!token || saving) return;
    setSubmitError(null);
    setSuccessAt(null);

    const trimmedSecret = secretKey.trim();
    const trimmedPublishable = publishableKey.trim();
    const trimmedWebhook = webhookSecret.trim();

    const errors = validateClientSide(trimmedSecret, trimmedPublishable, trimmedWebhook);
    setFieldErrors(errors);
    if (errors.length > 0) return;

    setSaving(true);
    try {
      const res = await api.updateStripeConfig(token, {
        secretKey: trimmedSecret,
        publishableKey: trimmedPublishable,
        webhookSecret: trimmedWebhook || undefined,
      });
      setStatus(res);
      setSecretKey('');
      setPublishableKey('');
      setWebhookSecret('');
      setShowSecret(false);
      setShowWebhook(false);
      setSuccessAt(Date.now());
    } catch (e) {
      setSubmitError(
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : t('admin.stripeConfig.genericError')
      );
    } finally {
      setSaving(false);
    }
  }, [token, saving, secretKey, publishableKey, webhookSecret, t]);

  const modeLabel =
    status?.mode === 'live'
      ? t('admin.stripeConfig.modeLive')
      : status?.mode === 'test'
        ? t('admin.stripeConfig.modeTest')
        : t('admin.stripeConfig.modeUnknown');

  const showTestOnProdWarning = status?.mode === 'test' && status.configured;

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-600/10 to-[#12121a] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{t('admin.stripeConfig.title')}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{t('admin.stripeConfig.hint')}</p>
        </div>
        {status && (
          <span
            className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
              status.mode === 'live'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : status.mode === 'test'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                  : 'bg-red-500/15 text-red-300 border border-red-500/25'
            }`}
          >
            {modeLabel}
          </span>
        )}
      </div>

      {loading && !status && (
        <p className="text-xs text-gray-500">{t('admin.stripeConfig.loading')}</p>
      )}

      {loadError && (
        <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {loadError}
        </p>
      )}

      {showTestOnProdWarning && (
        <p className="text-[11px] text-amber-300 bg-amber-950/25 border border-amber-900/40 rounded-lg px-3 py-2">
          {t('admin.stripeConfig.testOnProdWarning')}
        </p>
      )}

      {status && !status.envFileFound && (
        <p className="text-[11px] text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {t('admin.stripeConfig.envFileMissing')}
        </p>
      )}

      {status && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] rounded-xl border border-[#2a2a3a] bg-[#0f0f17] px-3 py-3">
          <div className="sm:col-span-2">
            <dt className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">
              {t('admin.stripeConfig.currentTitle')}
            </dt>
          </div>
          <div>
            <dt className="text-gray-500">{t('admin.stripeConfig.secretKeyLabel')}</dt>
            <dd className="text-purple-300 font-mono text-[11px]">
              {status.secretKeyMasked ?? t('admin.stripeConfig.notSet')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t('admin.stripeConfig.publishableKeyLabel')}</dt>
            <dd className="text-purple-300 font-mono text-[11px]">
              {status.publishableKeyMasked ?? t('admin.stripeConfig.notSet')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t('admin.stripeConfig.webhookSecretLabel')}</dt>
            <dd className="text-purple-300 font-mono text-[11px]">
              {status.webhookSecretMasked ?? t('admin.stripeConfig.webhookNotConfigured')}
            </dd>
          </div>
        </dl>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="stripe-secret-key" className="text-[11px] text-gray-400 font-semibold">
            {t('admin.stripeConfig.secretKeyLabel')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="stripe-secret-key"
              type={showSecret ? 'text' : 'password'}
              autoComplete="off"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={t('admin.stripeConfig.secretKeyPlaceholder')}
              className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0f0f17] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-[#2d2d3d]"
            >
              {showSecret ? t('admin.stripeConfig.hide') : t('admin.stripeConfig.show')}
            </button>
          </div>
          {fieldError(fieldErrors, 'secretKey') && (
            <p className="text-[10px] text-red-400 mt-1">{messageFor(fieldError(fieldErrors, 'secretKey')!)}</p>
          )}
        </div>

        <div>
          <label htmlFor="stripe-publishable-key" className="text-[11px] text-gray-400 font-semibold">
            {t('admin.stripeConfig.publishableKeyLabel')}
          </label>
          <input
            id="stripe-publishable-key"
            type="text"
            autoComplete="off"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder={t('admin.stripeConfig.publishableKeyPlaceholder')}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0f0f17] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
          />
          {fieldError(fieldErrors, 'publishableKey') && (
            <p className="text-[10px] text-red-400 mt-1">
              {messageFor(fieldError(fieldErrors, 'publishableKey')!)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="stripe-webhook-secret" className="text-[11px] text-gray-400 font-semibold">
            {t('admin.stripeConfig.webhookSecretLabel')}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="stripe-webhook-secret"
              type={showWebhook ? 'text' : 'password'}
              autoComplete="off"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={t('admin.stripeConfig.webhookSecretPlaceholder')}
              className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0f0f17] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowWebhook((v) => !v)}
              className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-[#2d2d3d]"
            >
              {showWebhook ? t('admin.stripeConfig.hide') : t('admin.stripeConfig.show')}
            </button>
          </div>
          {fieldError(fieldErrors, 'webhookSecret') && (
            <p className="text-[10px] text-red-400 mt-1">
              {messageFor(fieldError(fieldErrors, 'webhookSecret')!)}
            </p>
          )}
        </div>

        {fieldError(fieldErrors, 'mode') && (
          <p className="text-[11px] text-amber-300 bg-amber-950/25 border border-amber-900/40 rounded-lg px-3 py-2">
            {messageFor(fieldError(fieldErrors, 'mode')!)}
          </p>
        )}

        {submitError && (
          <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        {successAt != null && (
          <p className="text-[11px] text-green-300 bg-green-950/25 border border-green-900/40 rounded-lg px-3 py-2">
            {t('admin.stripeConfig.successMessage')}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !secretKey.trim() || !publishableKey.trim()}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-40"
        >
          {saving ? t('admin.stripeConfig.applying') : t('admin.stripeConfig.apply')}
        </button>
      </form>

      <div className="space-y-1 pt-1 border-t border-[#2a2a3a]">
        <p className="text-[10px] text-gray-500">{t('admin.stripeConfig.hotReloadNote')}</p>
        <p className="text-[10px] text-gray-600">{t('admin.stripeConfig.writeOnlyNote')}</p>
      </div>
    </div>
  );
}
