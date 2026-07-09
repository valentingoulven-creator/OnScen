import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { BackupBucketStatus, BackupsStatusReport } from '../types';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function StatusPill({ status, label }: { status: 'ok' | 'stale' | 'missing'; label: string }) {
  const cls =
    status === 'ok'
      ? 'text-green-400 bg-green-500/10'
      : status === 'stale'
        ? 'text-yellow-400 bg-yellow-500/10'
        : 'text-red-400 bg-red-500/10';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cls}`}>{label}</span>;
}

function BucketRow({ bucket, title }: { bucket: BackupBucketStatus; title: string }) {
  const { t } = useTranslation();
  const status: 'ok' | 'stale' | 'missing' = !bucket.exists || bucket.count === 0 ? 'missing' : bucket.stale ? 'stale' : 'ok';
  const statusLabel =
    status === 'ok'
      ? t('admin.analytics.backupsStatusOk')
      : status === 'stale'
        ? t('admin.analytics.backupsStatusStale')
        : t('admin.analytics.backupsStatusMissing');

  return (
    <div className="space-y-2 py-2 border-b border-[#1e1e2f] last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-200">{title}</span>
        <StatusPill status={status} label={statusLabel} />
      </div>
      {bucket.exists ? (
        bucket.count > 0 ? (
          <div className="text-[11px] text-gray-500 space-y-0.5">
            <p>
              {t('admin.analytics.backupsLast')} :{' '}
              {bucket.ageHours != null ? t('admin.analytics.backupsAgo', { hours: bucket.ageHours }) : '—'}
              {bucket.latestFile ? ` (${bucket.latestFile})` : ''}
            </p>
            <p>{t('admin.analytics.backupsCount', { count: bucket.count })} · {formatBytes(bucket.totalBytes)}</p>
          </div>
        ) : (
          <p className="text-[11px] text-red-400/80">{t('admin.analytics.backupsNone')}</p>
        )
      ) : (
        <p className="text-[11px] text-gray-600 truncate">{bucket.dir}</p>
      )}
    </div>
  );
}

export function AnalyticsBackupsSection() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<BackupsStatusReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getBackupsStatus(token)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.analytics.backupsError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('admin.analytics.backupsTitle')}</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">{t('admin.analytics.backupsSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 shrink-0"
        >
          {loading ? '...' : t('admin.analytics.refresh')}
        </button>
      </div>

      {loading && !data && <p className="text-sm text-gray-500">{t('admin.analytics.backupsLoading')}</p>}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && data.source === 'unavailable' && (
        <p className="text-sm text-gray-500">{t('admin.analytics.backupsUnavailable')}</p>
      )}

      {data && (
        <div className="space-y-1">
          <BucketRow bucket={data.db} title={t('admin.analytics.backupsDbTitle')} />
          <BucketRow bucket={data.uploads} title={t('admin.analytics.backupsUploadsTitle')} />

          <div className="py-2 border-b border-[#1e1e2f] space-y-1">
            <span className="text-sm font-medium text-gray-200">{t('admin.analytics.backupsOffsiteTitle')}</span>
            <p className="text-[11px] text-gray-500">
              DB : {t('admin.analytics.backupsOffsiteCount', { count: data.offsiteDb.count })} · Uploads :{' '}
              {t('admin.analytics.backupsOffsiteCount', { count: data.offsiteUploads.count })}
            </p>
          </div>

          <div className="py-2 space-y-1">
            <span className="text-sm font-medium text-gray-200">{t('admin.analytics.backupsCronTitle')}</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
              <span>
                DB :{' '}
                <span className={data.cron.db ? 'text-green-400' : 'text-yellow-400'}>
                  {data.cron.source === 'unavailable'
                    ? t('admin.analytics.backupsCronUnavailable')
                    : data.cron.db
                      ? t('admin.analytics.backupsCronOk')
                      : t('admin.analytics.backupsCronMissing')}
                </span>
              </span>
              <span>
                Uploads :{' '}
                <span className={data.cron.uploads ? 'text-green-400' : 'text-yellow-400'}>
                  {data.cron.source === 'unavailable'
                    ? t('admin.analytics.backupsCronUnavailable')
                    : data.cron.uploads
                      ? t('admin.analytics.backupsCronOk')
                      : t('admin.analytics.backupsCronMissing')}
                </span>
              </span>
              <span>
                Off-site :{' '}
                <span className={data.cron.offsite ? 'text-green-400' : 'text-yellow-400'}>
                  {data.cron.source === 'unavailable'
                    ? t('admin.analytics.backupsCronUnavailable')
                    : data.cron.offsite
                      ? t('admin.analytics.backupsCronOk')
                      : t('admin.analytics.backupsCronMissing')}
                </span>
              </span>
            </div>
          </div>

          <p className="text-[10px] text-gray-600 pt-1">
            {t('admin.analytics.backupsRetention', { days: data.retentionDays.db })}
          </p>

          {data.warnings.length > 0 && (
            <ul className="text-[10px] text-gray-500 space-y-1 pt-1">
              {data.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
