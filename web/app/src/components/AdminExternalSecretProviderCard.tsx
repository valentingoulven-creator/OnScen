import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ApiRequestError } from '../lib/api/core';
import type { ExternalSecretFieldFormat, ExternalSecretProviderStatus } from '../types';

/**
 * Carte générique de configuration d'un provider d'API tierce (LiveKit,
 * Sightengine, S3/Scaleway, etc.) — même principe visuel/UX que
 * `AdminStripeConfigCard.tsx` (formulaire toujours vide à l'ouverture,
 * masquage après saisie, badge configuré/non configuré) mais pilotée par le
 * registre backend (`externalSecretsRegistry.ts`) plutôt que du code dédié
 * par provider.
 */

const FORMAT_VALIDATORS: Record<ExternalSecretFieldFormat, RegExp> = {
  token: /^\S{8,}$/,
  id: /^\S{2,}$/,
  httpUrl: /^https?:\/\/\S+$/,
  wsUrl: /^wss?:\/\/\S+$/,
  mailtoOrUrl: /^(mailto:\S+@\S+|https?:\/\/\S+)$/,
  freeText: /\S/,
};

export function AdminExternalSecretProviderCard({
  provider,
  onUpdated,
}: {
  provider: ExternalSecretProviderStatus;
  onUpdated: (status: ExternalSecretProviderStatus) => void;
}) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const providerLabel = t(`admin.integrations.providers.${provider.id}.title`, { defaultValue: provider.id });
  const providerHint = t(`admin.integrations.providers.${provider.id}.hint`, { defaultValue: '' });

  const hasIssues = provider.issues.length > 0;
  const hasCriticalIssue = provider.issues.some((i) => i.severity === 'critical');
  const badgeKey = hasIssues
    ? 'admin.integrations.card.badgeActionRequired'
    : provider.configured
      ? 'admin.integrations.card.badgeOk'
      : 'admin.integrations.card.badgeUnconfigured';
  const badgeClassName = hasIssues
    ? hasCriticalIssue
      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
      : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
    : provider.configured
      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
      : 'bg-gray-500/15 text-gray-400 border border-gray-500/25';

  const setFieldValue = useCallback((key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const canSubmit = provider.fields
    .filter((f) => f.required)
    .every((f) => Boolean(values[f.key]?.trim()) && FORMAT_VALIDATORS[f.format].test(values[f.key]!.trim()));

  const submit = useCallback(async () => {
    if (!token || saving) return;
    setSubmitError(null);
    setSuccessAt(null);

    const payload: Record<string, string> = {};
    for (const field of provider.fields) {
      const raw = values[field.key]?.trim();
      if (!raw) continue;
      if (!FORMAT_VALIDATORS[field.format].test(raw)) {
        setSubmitError(t('admin.integrations.card.invalidField', { field: field.key }));
        return;
      }
      payload[field.key] = raw;
    }
    const missingRequired = provider.fields.some((f) => f.required && !payload[f.key]);
    if (missingRequired) {
      setSubmitError(t('admin.integrations.card.requiredMissing'));
      return;
    }

    setSaving(true);
    try {
      const status = await api.updateExternalSecretProvider(token, provider.id, payload);
      onUpdated(status);
      setValues({});
      setShown({});
      setExpanded(false);
      setSuccessAt(Date.now());
    } catch (e) {
      setSubmitError(
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : t('admin.integrations.card.genericError')
      );
    } finally {
      setSaving(false);
    }
  }, [token, saving, values, provider, onUpdated, t]);

  return (
    <div className="rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{providerLabel}</p>
          {providerHint && <p className="text-[11px] text-gray-500 mt-0.5">{providerHint}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badgeClassName}`}>
            {t(badgeKey)}
          </span>
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1a1a26] hover:bg-[#20202e] text-purple-300 text-xs font-bold transition border border-purple-500/20 whitespace-nowrap"
            >
              {t('admin.integrations.card.configure')}
            </button>
          )}
        </div>
      </div>

      {hasIssues && (
        <ul className="space-y-1.5">
          {provider.issues.map((issue, i) => (
            <li
              key={`${issue.type}-${issue.field}-${i}`}
              className={`text-[11px] rounded-lg px-3 py-2 border ${
                issue.severity === 'critical'
                  ? 'bg-red-950/30 border-red-900/40 text-red-300'
                  : issue.severity === 'warning'
                    ? 'bg-amber-950/25 border-amber-900/40 text-amber-200'
                    : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-400'
              }`}
            >
              {t(issue.messageKey, {
                provider: providerLabel,
                field: t(`admin.integrations.fields.${issue.field}`, { defaultValue: issue.field }),
              })}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] rounded-xl border border-[#2a2a3a] bg-[#0f0f17] px-3 py-3">
        {provider.fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <dt className="text-gray-500 truncate">
              {t(`admin.integrations.fields.${field.key}`, { defaultValue: field.key })}
            </dt>
            <dd className="text-purple-300 font-mono text-[11px] truncate">
              {field.kind === 'public' && field.configured
                ? field.value
                : field.kind === 'secret' && field.configured
                  ? field.masked
                  : t('admin.integrations.card.notSet')}
            </dd>
          </div>
        ))}
      </dl>

      {provider.helpUrl && (
        <a
          href={provider.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[11px] text-purple-300 underline"
        >
          {t('admin.integrations.card.openConsole')}
        </a>
      )}

      {expanded && (
        <form
          className="space-y-3 pt-1 border-t border-[#2a2a3a]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {provider.fields.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`ext-secret-${provider.id}-${field.key}`}
                className="text-[11px] text-gray-400 font-semibold"
              >
                {t(`admin.integrations.fields.${field.key}`, { defaultValue: field.key })}
                {!field.required && (
                  <span className="text-gray-600 font-normal"> · {t('admin.integrations.card.optional')}</span>
                )}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`ext-secret-${provider.id}-${field.key}`}
                  type={field.kind === 'secret' && !shown[field.key] ? 'password' : 'text'}
                  autoComplete="off"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setFieldValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] bg-[#0f0f17] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                {field.kind === 'secret' && (
                  <button
                    type="button"
                    onClick={() => setShown((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-semibold text-gray-400 hover:text-white border border-[#2d2d3d]"
                  >
                    {shown[field.key] ? t('admin.integrations.card.hide') : t('admin.integrations.card.show')}
                  </button>
                )}
              </div>
            </div>
          ))}

          {submitError && (
            <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-40"
            >
              {saving ? t('admin.integrations.card.applying') : t('admin.integrations.card.apply')}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setValues({});
                setShown({});
                setSubmitError(null);
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-gray-400 hover:text-white text-xs font-semibold"
            >
              {t('admin.integrations.card.cancel')}
            </button>
          </div>
        </form>
      )}

      {successAt != null && (
        <p className="text-[11px] text-green-300 bg-green-950/25 border border-green-900/40 rounded-lg px-3 py-2">
          {t('admin.integrations.card.successMessage')}
        </p>
      )}
    </div>
  );
}
