import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AdminStripeConfigCard } from '../components/AdminStripeConfigCard';
import { AdminExternalSecretProviderCard } from '../components/AdminExternalSecretProviderCard';
import type { ExternalSecretProviderStatus } from '../types';

/**
 * Onglet Admin → Intégrations : centralise la gestion sécurisée de toutes
 * les clés/secrets d'API tierces (write-only, masqué, whitelist stricte
 * côté backend — voir `externalSecretsRegistry.ts`). Stripe garde sa carte
 * dédiée existante (`AdminStripeConfigCard`, déjà en prod/testée) affichée
 * en premier ; les autres providers sont pilotés génériquement par le
 * registre backend via `AdminExternalSecretProviderCard`.
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

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AdminStripeConfigCard />
        {providers.map((provider) => (
          <AdminExternalSecretProviderCard key={provider.id} provider={provider} onUpdated={handleUpdated} />
        ))}
      </div>

      <p className="text-[10px] text-gray-600 pt-1">{t('admin.integrations.writeOnlyNote')}</p>
    </div>
  );
}
