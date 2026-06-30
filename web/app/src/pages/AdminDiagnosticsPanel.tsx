import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isSentryClientActive } from '../lib/sentry';
import type { AdminDiagnosticsReport, VpsMetricsReport } from '../types';
import { AdminServerLogsPanel } from './AdminServerLogsPanel';
import { AdminSupportLogsPanel } from './AdminSupportLogsPanel';

type DiagLogTab = 'app' | 'pm2' | 'system';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function geomPct(withGeom: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((withGeom / total) * 100)} %`;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
        ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      {label}
    </span>
  );
}

function DiagCard({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-3 space-y-2 ${
        ok ? 'border-[#1e1e2f] bg-[#12121a]/60' : 'border-red-500/30 bg-red-950/10'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-white">{title}</h3>
        <StatusPill ok={ok} label={ok ? 'OK' : 'Alerte'} />
      </div>
      {children}
    </section>
  );
}

function DiagLogTabBar({
  active,
  onChange,
  t,
}: {
  active: DiagLogTab;
  onChange: (tab: DiagLogTab) => void;
  t: (key: string) => string;
}) {
  const items: { id: DiagLogTab; label: string }[] = [
    { id: 'app', label: t('admin.support.diag.logTabApp') },
    { id: 'pm2', label: t('admin.support.diag.logTabPm2') },
    { id: 'system', label: t('admin.support.diag.logTabSystem') },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto pb-0.5 border-b border-[#1e1e2f]" aria-label={t('admin.support.diag.logTabsAria')}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-3 py-2 min-h-[44px] text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
            active === item.id
              ? 'border-purple-500 text-white'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function AdminDiagnosticsPanel() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [report, setReport] = useState<AdminDiagnosticsReport | null>(null);
  const [vps, setVps] = useState<VpsMetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTab, setLogTab] = useState<DiagLogTab>('app');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [diag, metrics] = await Promise.all([
        api.getAdminDiagnostics(token),
        api.getVpsMetrics(token).catch(() => null),
      ]);
      setReport(diag);
      setVps(metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.diag.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientSentryActive = isSentryClientActive();
  const clientSentryConfigured = Boolean(import.meta.env.VITE_SENTRY_DSN?.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{t('admin.support.diag.title')}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{t('admin.support.diag.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-2 min-h-[44px] text-xs font-semibold border border-[#2d2d3d] rounded-xl text-gray-300 hover:text-white disabled:opacity-50"
        >
          {loading ? '…' : t('admin.support.diag.refreshAll')}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {report && (
        <>
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
              report.health.status === 'OK'
                ? 'border-emerald-500/35 bg-emerald-500/10'
                : 'border-amber-500/35 bg-amber-500/10'
            }`}
          >
            <span className="text-lg" aria-hidden>
              {report.health.status === 'OK' ? '✓' : '⚠'}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">
                {report.health.status === 'OK'
                  ? t('admin.support.diag.healthOk')
                  : t('admin.support.diag.healthDegraded')}
              </p>
              <p className="text-[10px] text-gray-500">
                {t('admin.support.diag.envLabel', { env: report.environment })} ·{' '}
                {new Date(report.fetchedAt).toLocaleString(i18n.language)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DiagCard title="Sentry" ok={report.sentry.active && (clientSentryActive || clientSentryConfigured)}>
              <dl className="space-y-1 text-[11px] text-gray-400">
                <div className="flex justify-between gap-2">
                  <dt>{t('admin.support.diag.sentryBackend')}</dt>
                  <dd className="text-gray-200">
                    {report.sentry.configured
                      ? report.sentry.active
                        ? t('admin.support.diag.active')
                        : t('admin.support.diag.inactive')
                      : t('admin.support.diag.notConfigured')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{t('admin.support.diag.sentryFrontend')}</dt>
                  <dd className="text-gray-200">
                    {clientSentryConfigured
                      ? clientSentryActive
                        ? t('admin.support.diag.active')
                        : t('admin.support.diag.inactive')
                      : t('admin.support.diag.notConfigured')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Release API</dt>
                  <dd className="text-gray-200 font-mono text-[10px] truncate max-w-[55%] text-right">
                    {report.sentry.release}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Traces</dt>
                  <dd className="text-gray-200">{Math.round(report.sentry.tracesSampleRate * 100)} %</dd>
                </div>
              </dl>
              <a
                href={report.sentry.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] text-purple-300 hover:text-purple-200"
              >
                {t('admin.support.diag.openSentry')} →
              </a>
            </DiagCard>

            <DiagCard
              title="PostGIS"
              ok={report.postgis.enabled && Boolean(report.postgis.entities)}
            >
              {report.postgis.enabled && report.postgis.entities ? (
                <dl className="space-y-1 text-[11px] text-gray-400">
                  <div className="text-[10px] text-gray-500 font-mono truncate">{report.postgis.version}</div>
                  {(['users', 'salons', 'lives'] as const).map((key) => {
                    const e = report.postgis.entities![key];
                    return (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="capitalize">{key}</dt>
                        <dd className="text-gray-200 tabular-nums">
                          {e.withGeom}/{e.total} ({geomPct(e.withGeom, e.total)})
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="text-[11px] text-gray-500">{t('admin.support.diag.postgisOff')}</p>
              )}
            </DiagCard>

            <DiagCard title="PostgreSQL" ok={report.database.ok && report.health.db === 'ok'}>
              <dl className="space-y-1 text-[11px] text-gray-400">
                <div className="flex justify-between gap-2">
                  <dt>{t('admin.support.diag.dbConnection')}</dt>
                  <dd className="text-gray-200">
                    {report.database.connected ? t('admin.support.diag.connected') : t('admin.support.diag.disconnected')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>users</dt>
                  <dd className="text-gray-200 tabular-nums">{report.database.tables.users}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>feed_posts</dt>
                  <dd className="text-gray-200 tabular-nums">{report.database.tables.feed_posts}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>stories / reels</dt>
                  <dd className="text-gray-200 tabular-nums">
                    {report.database.tables.stories} / {report.database.tables.user_reels}
                  </dd>
                </div>
              </dl>
              {report.database.warnings.length > 0 && (
                <ul className="text-[10px] text-amber-300/90 space-y-0.5 list-disc pl-4">
                  {report.database.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <a
                href={report.links.healthDbPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] text-purple-300 hover:text-purple-200"
              >
                /health/db →
              </a>
            </DiagCard>

            <DiagCard
              title={t('admin.support.diag.backupsTitle')}
              ok={
                report.backups.warnings.filter(
                  (w) => w.includes('Aucune sauvegarde') || w.includes('> ')
                ).length === 0
              }
            >
              {report.backups.dbBackups[0] ? (
                <div className="text-[11px] text-gray-400 space-y-1">
                  <p>
                    <span className="text-gray-500">{t('admin.support.diag.latestDbBackup')}:</span>{' '}
                    <span className="text-gray-200">{report.backups.dbBackups[0].name}</span>
                  </p>
                  <p className="tabular-nums">
                    {formatBytes(report.backups.dbBackups[0].sizeBytes)} ·{' '}
                    {t('admin.support.diag.ageHours', { hours: report.backups.dbBackups[0].ageHours })}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500">{t('admin.support.diag.noDbBackup')}</p>
              )}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <StatusPill
                  ok={report.backups.offsiteConfigured}
                  label={
                    report.backups.offsiteConfigured
                      ? t('admin.support.diag.offsiteOn')
                      : t('admin.support.diag.offsiteOff')
                  }
                />
                {report.backups.uploadBackups[0] && (
                  <span className="text-gray-500">
                    uploads: {report.backups.uploadBackups[0].ageHours}h
                  </span>
                )}
              </div>
              {!report.backups.scanAvailable && (
                <p className="text-[10px] text-gray-500">{t('admin.support.diag.backupScanLocalOnly')}</p>
              )}
              {report.backups.warnings.map((w) => (
                <p key={w} className="text-[10px] text-amber-300/90">
                  {w}
                </p>
              ))}
            </DiagCard>
          </div>

          <section className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/40 p-3 space-y-2">
            <h3 className="text-xs font-bold text-white">{t('admin.support.diag.logsAppStats')}</h3>
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
              <span>
                {t('admin.support.diag.logsTotal')}:{' '}
                <strong className="text-gray-200">{report.diagnosticLogs.total}</strong>
              </span>
              <span>
                ERR 24h:{' '}
                <strong className="text-red-300">{report.diagnosticLogs.recentErrors24h}</strong>
              </span>
              {Object.entries(report.diagnosticLogs.byLevel).map(([level, count]) => (
                <span key={level}>
                  {level}: <strong className="text-gray-200">{count}</strong>
                </span>
              ))}
            </div>
          </section>

          {report.backups.dbBackups.length > 0 && (
            <section className="rounded-xl border border-[#1e1e2f] overflow-hidden">
              <h3 className="text-xs font-bold text-white px-3 py-2 border-b border-[#1e1e2f] bg-[#12121a]/60">
                {t('admin.support.diag.backupListTitle')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#1e1e2f]">
                      <th className="text-left px-3 py-2 font-semibold">{t('admin.support.diag.colFile')}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t('admin.support.diag.colSize')}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t('admin.support.diag.colAge')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.backups.dbBackups.map((b) => (
                      <tr key={b.name} className="border-b border-[#1e1e2f]/60 text-gray-300">
                        <td className="px-3 py-2 font-mono truncate max-w-[14rem]">{b.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatBytes(b.sizeBytes)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{b.ageHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vps && (
            <section className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/40 p-3">
              <h3 className="text-xs font-bold text-white mb-2">{t('admin.support.diag.vpsTitle')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-400">
                <div>
                  <p className="text-gray-500">RAM</p>
                  <p className="text-gray-200 tabular-nums">{vps.memory.usedPercent}%</p>
                </div>
                <div>
                  <p className="text-gray-500">CPU load</p>
                  <p className="text-gray-200 tabular-nums">
                    {vps.cpu.loadPercent != null ? `${vps.cpu.loadPercent}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Disque</p>
                  <p className="text-gray-200 tabular-nums">
                    {vps.disk.usedPercent != null ? `${vps.disk.usedPercent}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Latence PG</p>
                  <p className="text-gray-200 tabular-nums">{vps.latencyMs} ms</p>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-white">{t('admin.support.diag.logsSectionTitle')}</h3>
        <DiagLogTabBar active={logTab} onChange={setLogTab} t={t} />
        {logTab === 'app' && <AdminSupportLogsPanel />}
        {logTab === 'pm2' && <AdminServerLogsPanel defaultType="pm2" />}
        {logTab === 'system' && <AdminServerLogsPanel defaultType="system" />}
      </div>
    </div>
  );
}
