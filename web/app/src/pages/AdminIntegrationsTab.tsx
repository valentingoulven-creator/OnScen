import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AdminStripeConfigCard } from '../components/AdminStripeConfigCard';
import { AdminExternalSecretProviderCard } from '../components/AdminExternalSecretProviderCard';
import type { ExternalSecretCategory, ExternalSecretProviderStatus } from '../types';

const CATEGORY_ORDER: ExternalSecretCategory[] = [
  'connexion',
  'payments',
  'lives',
  'security',
  'storage',
  'comms',
  'admin',
];

const CATEGORY_FALLBACK: Record<string, ExternalSecretCategory> = {
  google_oauth: 'connexion',
  apple_signin: 'connexion',
  youtube_data_api: 'connexion',
  facebook_instagram: 'connexion',
  cloudflare_stream: 'lives',
  livekit: 'lives',
  turn: 'lives',
  turnstile: 'security',
  sightengine: 'security',
  photodna: 'security',
  acrcloud: 'security',
  sentry: 'security',
  s3_scaleway: 'storage',
  redis: 'storage',
  resend_email: 'comms',
  web_push: 'comms',
  ai_agents: 'admin',
};

function providerCategory(provider: ExternalSecretProviderStatus): ExternalSecretCategory {
  return provider.category ?? CATEGORY_FALLBACK[provider.id] ?? 'admin';
}

/**
 * Onglet Admin → Intégrations : centralise la gestion sécurisée de toutes
 * les clés/secrets d'API tierces, groupées par catégorie (connexion, lives,
 * sécurité…). Stripe garde sa carte dédiée dans « Paiements ».
 */
export function AdminIntegrationsTab() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ExternalSecretProviderStatus[]>([]);
  const [envFileFound, setEnvFileFound] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getExternalSecretsStatus(token)
      .then((res) => {
        setProviders(res.providers);
        setEnvFileFound(res.envFileFound);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.integrations.loadError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdated = useCallback((status: ExternalSecretProviderStatus) => {
    setProviders((prev) => prev.map((p) => (p.id === status.id ? status : p)));
  }, []);

  const providersWithIssues = providers.filter((p) => p.issues.length > 0);

  const grouped = useMemo(() => {
    const map = new Map<ExternalSecretCategory, ExternalSecretProviderStatus[]>();
    for (const id of CATEGORY_ORDER) map.set(id, []);
    for (const provider of providers) {
      const cat = providerCategory(provider);
      const list = map.get(cat) ?? [];
      list.push(provider);
      map.set(cat, list);
    }
    return CATEGORY_ORDER.filter((id) => id === 'payments' || (map.get(id)?.length ?? 0) > 0).map((id) => ({
      id,
      providers: map.get(id) ?? [],
    }));
  }, [providers]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white">{t('admin.integrations.title')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('admin.integrations.hint')}</p>
      </div>

      {providersWithIssues.length > 0 && (
        <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-4 space-y-2">
          <p className="text-sm font-bold text-red-300">
            {t('admin.integrations.alertBannerTitle', { count: providersWithIssues.length })}
          </p>
          <ul className="space-y-1">
            {providersWithIssues.map((provider) => (
              <li key={provider.id} className="text-[11px] text-red-200/90">
                •{' '}
                {t('admin.integrations.alertBannerItem', {
                  provider: t(`admin.integrations.providers.${provider.id}.title`, { defaultValue: provider.id }),
                  count: provider.issues.length,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!envFileFound && (
        <p className="text-[11px] text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {t('admin.integrations.envFileMissing')}
        </p>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {loading && providers.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">{t('admin.integrations.loading')}</p>
      )}

      {grouped.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-[#2a2a3a] pb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300/90">
              {t(`admin.integrations.categories.${section.id}`)}
            </h3>
            <span className="text-[10px] text-gray-600">
              {t('admin.integrations.categoryCount', {
                count: section.id === 'payments' ? section.providers.length + 1 : section.providers.length,
              })}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {section.id === 'payments' && <AdminStripeConfigCard />}
            {section.providers.map((provider) => (
              <AdminExternalSecretProviderCard key={provider.id} provider={provider} onUpdated={handleUpdated} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-[10px] text-gray-600 pt-1">{t('admin.integrations.writeOnlyNote')}</p>
    </div>
  );
}
