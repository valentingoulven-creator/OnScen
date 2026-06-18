import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { VpsMetricsReport } from '../types';
import { AnalyticsSyslogSection } from './AnalyticsSyslogSection';

function formatBytes(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function formatUptime(seconds: number, locale: string): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}j ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins.toLocaleString(locale)} min`;
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function UsageBar({ percent, color = '#9b7bd4' }: { percent: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const barColor =
    clamped >= 90 ? '#ef4444' : clamped >= 75 ? '#f59e0b' : color;
  return (
    <div className="h-2 bg-[#1a1a26] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, backgroundColor: barColor }}
      />
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <div className="text-right min-w-0">
        <span className="text-gray-200 font-medium">{value}</span>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function sourceLabel(source: VpsMetricsReport['source'], t: (key: string) => string): string {
  if (source === 'mock') return t('admin.analytics.vpsSourceMock');
  if (source === 'partial') return t('admin.analytics.vpsSourcePartial');
  return t('admin.analytics.vpsSourceSystem');
}

export function AnalyticsVpsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [metrics, setMetrics] = useState<VpsMetricsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getVpsMetrics(token)
      .then((r) => {
        setMetrics(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.analytics.vpsError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 text-sm">{t('admin.analytics.vpsLoading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{t('admin.analytics.vpsSubtitle')}</p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 shrink-0"
        >
          {loading ? '...' : t('admin.analytics.refresh')}
        </button>
      </div>

      {metrics?.fetchedAt && (
        <p className="text-[10px] text-gray-600">
          {t('admin.analytics.vpsLastUpdated', {
            date: formatDateTime(metrics.fetchedAt, locale),
          })}
        </p>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {metrics && (
        <>
          <SectionCard title={t('admin.analytics.vpsHostTitle')}>
            <div className="space-y-2">
              <MetricRow label={t('admin.analytics.vpsHostname')} value={metrics.hostname} />
              <MetricRow label={t('admin.analytics.vpsPlatform')} value={metrics.platform} />
              <MetricRow label={t('admin.analytics.vpsEnv')} value={metrics.env} />
              <MetricRow
                label={t('admin.analytics.vpsUptime')}
                value={formatUptime(metrics.uptimeSeconds, locale)}
              />
              <MetricRow
                label={t('admin.analytics.vpsSource')}
                value={sourceLabel(metrics.source, t)}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('admin.analytics.vpsMemoryTitle')}>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">
                    {formatBytes(metrics.memory.usedBytes, locale)} /{' '}
                    {formatBytes(metrics.memory.totalBytes, locale)}
                  </span>
                  <span className="text-purple-300 font-semibold">{metrics.memory.usedPercent}%</span>
                </div>
                <UsageBar percent={metrics.memory.usedPercent} />
              </div>
              <MetricRow
                label={t('admin.analytics.vpsMemoryProcess')}
                value={formatBytes(metrics.memory.processRssBytes, locale)}
              />
              <MetricRow
                label={t('admin.analytics.vpsMemoryHeap')}
                value={formatBytes(metrics.memory.processHeapUsedBytes, locale)}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('admin.analytics.vpsDiskTitle')}>
            {metrics.disk.source === 'unavailable' || metrics.disk.usedBytes == null ? (
              <p className="text-sm text-gray-500">{t('admin.analytics.vpsDiskUnavailable')}</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">
                      {formatBytes(metrics.disk.usedBytes, locale)} /{' '}
                      {formatBytes(metrics.disk.totalBytes!, locale)}
                    </span>
                    <span className="text-purple-300 font-semibold">
                      {metrics.disk.usedPercent}%
                    </span>
                  </div>
                  <UsageBar percent={metrics.disk.usedPercent ?? 0} color="#6366f1" />
                </div>
                <MetricRow
                  label={t('admin.analytics.vpsDiskFree')}
                  value={formatBytes(metrics.disk.freeBytes!, locale)}
                />
                {metrics.disk.mountPoint && (
                  <MetricRow
                    label={t('admin.analytics.vpsDiskMount')}
                    value={metrics.disk.mountPoint}
                  />
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('admin.analytics.vpsCpuTitle')}>
            <div className="space-y-2">
              <MetricRow
                label={t('admin.analytics.vpsCpuCores')}
                value={String(metrics.cpu.cores)}
              />
              <MetricRow label={t('admin.analytics.vpsCpuModel')} value={metrics.cpu.model} />
              {metrics.cpu.loadAverage1m != null ? (
                <>
                  {metrics.cpu.loadPercent != null && (
                    <div className="pt-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">{t('admin.analytics.vpsCpuLoadPercent')}</span>
                        <span className="text-purple-300 font-semibold">
                          {metrics.cpu.loadPercent}%
                        </span>
                      </div>
                      <UsageBar percent={Math.min(metrics.cpu.loadPercent, 100)} color="#22c55e" />
                    </div>
                  )}
                  <MetricRow
                    label={t('admin.analytics.vpsCpuLoad1m')}
                    value={String(metrics.cpu.loadAverage1m)}
                  />
                  <MetricRow
                    label={t('admin.analytics.vpsCpuLoad5m')}
                    value={String(metrics.cpu.loadAverage5m)}
                  />
                  <MetricRow
                    label={t('admin.analytics.vpsCpuLoad15m')}
                    value={String(metrics.cpu.loadAverage15m)}
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500">{t('admin.analytics.vpsCpuUnavailable')}</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('admin.analytics.vpsLatencyTitle')}>
            <MetricRow
              label={t('admin.analytics.vpsLatencyTitle')}
              value={t('admin.analytics.vpsLatencyValue', { ms: metrics.latencyMs })}
              sub={
                metrics.latencySource === 'postgres'
                  ? t('admin.analytics.vpsLatencyPostgres')
                  : t('admin.analytics.vpsLatencyInternal')
              }
            />
          </SectionCard>

          <SectionCard title={t('admin.analytics.vpsNodeTitle')}>
            <div className="space-y-2">
              <MetricRow label={t('admin.analytics.vpsNodeVersion')} value={metrics.node.version} />
              <MetricRow label={t('admin.analytics.vpsNodePid')} value={String(metrics.node.pid)} />
            </div>
          </SectionCard>

          {metrics.warnings.length > 0 && (
            <ul className="text-[10px] text-gray-500 space-y-1 px-1">
              {metrics.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <AnalyticsSyslogSection />
    </div>
  );
}
