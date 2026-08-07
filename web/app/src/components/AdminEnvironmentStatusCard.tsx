import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { DeployEnvironmentId, EnvironmentStatusResponse } from '../types';

/**
 * Carte statut lecture seule d'un environnement Soundy (dev / preprod / prod)
 * — ping `/health` côté backend (aucune clé SSH/secret côté frontend), voir
 * `commun/backend/src/routes/adminEnvironments.ts`. Aucune action d'écriture
 * ni de déclenchement de déploiement ici par choix de sécurité (cf. audit
 * CTO — un clic web ne doit jamais remplacer le geste manuel de déploiement
 * prod prévu par `.cursor/rules/deploy-prod.mdc`).
 */
export function AdminEnvironmentStatusCard({
  env,
  accentClassName,
}: {
  env: DeployEnvironmentId;
  /** Classe Tailwind pour l'accent visuel (bordure/point) — distingue dev/preprod/prod. */
  accentClassName: string;
}) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<EnvironmentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getEnvironmentStatus(token, env)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.environments.loadError')))
      .finally(() => setLoading(false));
  }, [token, env, t]);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadge = (() => {
    const status = data?.status ?? 'unknown';
    if (status === 'ok') return { label: t('admin.environments.statusOk'), cls: 'bg-green-500/20 text-green-400 border border-green-500/30' };
    if (status === 'degraded') return { label: t('admin.environments.statusDegraded'), cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/25' };
    if (status === 'down') return { label: t('admin.environments.statusDown'), cls: 'bg-red-500/15 text-red-300 border border-red-500/30' };
    return { label: t('admin.environments.statusUnknown'), cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' };
  })();

  return (
    <div className={`rounded-2xl border bg-[#12121a] p-4 space-y-3 ${accentClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{data?.label ?? t(`admin.environments.${env}.title`)}</p>
          {data?.siteUrl ? (
            <a
              href={data.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-300 hover:underline break-all"
            >
              {data.siteUrl}
            </a>
          ) : null}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {loading && !data ? (
        <p className="text-xs text-gray-500 py-3 text-center">{t('admin.environments.loading')}</p>
      ) : null}

      {error ? (
        <p className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      {data && !error ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-gray-500">{t('admin.environments.fieldDb')}</p>
            <p className="text-white font-semibold">{data.db ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-gray-500">{t('admin.environments.fieldLatency')}</p>
            <p className="text-white font-semibold">
              {data.latencyMs != null ? `${data.latencyMs} ms` : '—'}
            </p>
          </div>
          {data.services ? (
            <div className="col-span-2 rounded-lg bg-black/20 px-2.5 py-2">
              <p className="text-gray-500 mb-1">{t('admin.environments.fieldServices')}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.services).map(([key, value]) => (
                  <span
                    key={key}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="col-span-2 text-gray-600">
            {t('admin.environments.checkedAt', {
              time: new Date(data.checkedAt).toLocaleTimeString(),
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="w-full min-h-11 rounded-xl border border-[#2a2a3a] text-xs font-bold text-gray-300 hover:text-white hover:border-purple-500/40 transition disabled:opacity-50"
      >
        {loading ? t('admin.environments.refreshing') : t('admin.environments.refresh')}
      </button>
    </div>
  );
}
