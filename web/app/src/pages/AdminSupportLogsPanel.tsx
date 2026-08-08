import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  clearLocalDiagnosticLogs,
  flushDiagnosticLogsToServer,
  getLocalDiagnosticLogs,
  type DiagnosticLogEntry,
} from '../lib/diagnosticLogs';
import type { AppDiagnosticLog, AppDiagnosticLogsResponse } from '../types';

type LevelFilter = 'all' | 'error' | 'warn' | 'info';
type LineCount = 50 | 100 | 200;
type LogSource = 'server' | 'local' | 'both';

/** Fenêtre « santé app » : aucune erreur = check vert. */
const LOG_HEALTH_WINDOW_MS = 10 * 60 * 1000;

function levelTextColor(level: AppDiagnosticLog['level']): string {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-yellow-400';
  return 'text-gray-400';
}

function levelBadgeClass(level: AppDiagnosticLog['level']): string {
  if (level === 'error') return 'text-red-500 bg-red-500/10';
  if (level === 'warn') return 'text-yellow-500 bg-yellow-500/10';
  return 'text-gray-600 bg-gray-500/10';
}

function levelBadgeLabel(level: AppDiagnosticLog['level']): string {
  if (level === 'error') return 'ERR';
  if (level === 'warn') return 'WRN';
  return 'INF';
}

function formatTs(isoOrMs: string | number, locale: string): string {
  try {
    const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(isoOrMs);
  }
}

function localToDisplay(entry: DiagnosticLogEntry): AppDiagnosticLog {
  return {
    id: entry.id,
    createdAt: new Date(entry.ts).toISOString(),
    level: entry.level,
    source: entry.source,
    message: entry.message,
    stack: entry.stack,
    context: entry.context,
    userId: entry.userId,
    username: entry.username,
    url: entry.url,
    clientId: entry.clientId,
    origin: 'local',
  };
}

function mergeLogs(server: AppDiagnosticLog[], local: AppDiagnosticLog[]): AppDiagnosticLog[] {
  const map = new Map<string, AppDiagnosticLog>();
  for (const entry of [...server, ...local]) {
    map.set(entry.id, entry);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function AdminSupportLogsPanel() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AppDiagnosticLogsResponse | null>(null);
  const [localLogs, setLocalLogs] = useState<AppDiagnosticLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<LineCount>(100);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [logSource, setLogSource] = useState<LogSource>('both');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshLocal = useCallback(() => {
    setLocalLogs(getLocalDiagnosticLogs().map(localToDisplay));
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      await flushDiagnosticLogsToServer(token);
      refreshLocal();
      const res = await api.getAppDiagnosticLogs(token, { limit: lineCount, level: levelFilter, q: search || undefined });
      setData(res);
      setError(null);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }, 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.logsLoadError'));
      refreshLocal();
    } finally {
      setLoading(false);
    }
  }, [token, lineCount, levelFilter, search, t, refreshLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void load(), 15_000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  const serverLines = data?.logs ?? [];
  const merged =
    logSource === 'server'
      ? serverLines
      : logSource === 'local'
        ? localLogs
        : mergeLogs(serverLines, localLogs);

  const filteredLines = merged.filter((l) => levelFilter === 'all' || l.level === levelFilter);

  const recentErrors = useMemo(
    () =>
      merged.filter((l) => {
        if (l.level !== 'error') return false;
        const age = Date.now() - new Date(l.createdAt).getTime();
        return age >= 0 && age < LOG_HEALTH_WINDOW_MS;
      }),
    [merged]
  );

  const logsHealthOk = !loading && recentErrors.length === 0;

  function handleCopy() {
    const text = filteredLines
      .map(
        (l) =>
          `[${l.createdAt}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}${l.stack ? `\n${l.stack}` : ''}`
      )
      .join('\n\n');
    void navigator.clipboard.writeText(text);
  }

  function handleDownload() {
    const text = filteredLines
      .map(
        (l) =>
          `[${l.createdAt}] [${l.level.toUpperCase()}] [${l.source}] ${l.username ?? l.userId ?? '-'} ${l.message}${l.stack ? `\n${l.stack}` : ''}${l.url ? `\nURL: ${l.url}` : ''}`
      )
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onscen-app-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClearLocal() {
    if (!window.confirm(t('admin.support.logsClearLocalConfirm'))) return;
    clearLocalDiagnosticLogs();
    refreshLocal();
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
          logsHealthOk
            ? 'border-emerald-500/35 bg-emerald-500/10'
            : 'border-red-500/35 bg-red-500/10'
        }`}
        role="status"
      >
        <span
          className={`shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
            logsHealthOk ? 'bg-emerald-500/25 text-emerald-300' : 'bg-red-500/25 text-red-300'
          }`}
          aria-hidden
        >
          {logsHealthOk ? '✓' : '!'}
        </span>
        <div className="min-w-0 text-left">
          <p className={`text-xs font-semibold ${logsHealthOk ? 'text-emerald-200' : 'text-red-200'}`}>
            {logsHealthOk
              ? t('admin.support.logsHealthOk')
              : t('admin.support.logsHealthError', { count: recentErrors.length })}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{t('admin.support.logsHealthWindow')}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500">{t('admin.support.logsHint')}</p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SegmentedControl
            options={[
              { value: 'both', label: t('admin.support.logsSourceBoth') },
              { value: 'server', label: t('admin.support.logsSourceServer') },
              { value: 'local', label: t('admin.support.logsSourceLocal') },
            ]}
            value={logSource}
            onChange={(v) => setLogSource(v as LogSource)}
          />
          <SegmentedControl
            options={[
              { value: '50', label: '50' },
              { value: '100', label: '100' },
              { value: '200', label: '200' },
            ]}
            value={String(lineCount)}
            onChange={(v) => setLineCount(Number(v) as LineCount)}
          />
          <SegmentedControl
            options={[
              { value: 'all', label: t('admin.support.logsLevelAll') },
              { value: 'error', label: t('admin.support.logsLevelError'), accent: 'red' },
              { value: 'warn', label: t('admin.support.logsLevelWarn'), accent: 'yellow' },
              { value: 'info', label: t('admin.support.logsLevelInfo') },
            ]}
            value={levelFilter}
            onChange={(v) => setLevelFilter(v as LevelFilter)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.support.logsSearchPlaceholder')}
          className="flex-1 min-w-[10rem] bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500/60"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-2 min-h-[44px] text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-xl disabled:opacity-50"
        >
          {loading ? '…' : t('admin.support.logsRefresh')}
        </button>
        <button
          type="button"
          onClick={() => setAutoRefresh((p) => !p)}
          className={`px-3 py-2 min-h-[44px] text-xs border rounded-xl transition-colors ${
            autoRefresh
              ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
              : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
          }`}
        >
          {t('admin.support.logsAutoRefresh')}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          onClick={handleCopy}
          disabled={filteredLines.length === 0}
          className="px-2.5 py-1.5 min-h-[44px] text-[10px] border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
        >
          {t('admin.support.logsCopy')}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={filteredLines.length === 0}
          className="px-2.5 py-1.5 min-h-[44px] text-[10px] border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
        >
          ↓ {t('admin.support.logsDownload')}
        </button>
        <button
          type="button"
          onClick={handleClearLocal}
          className="px-2.5 py-1.5 min-h-[44px] text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full"
        >
          {t('admin.support.logsClearLocal')}
        </button>
      </div>

      {data && !data.persisted && (
        <p className="text-xs text-amber-400/90">{t('admin.support.logsServerUnavailable')}</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div
        ref={scrollRef}
        className="h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain bg-[#07070f] rounded-xl border border-[#191926] p-2.5 font-mono text-[10px] leading-relaxed space-y-1"
      >
        {filteredLines.length === 0 && !loading ? (
          <p className="text-gray-600 text-center py-10">{t('admin.support.logsEmpty')}</p>
        ) : (
          filteredLines.map((line) => (
            <details key={line.id} className="group rounded hover:bg-white/[0.025] px-1 py-0.5">
              <summary className={`cursor-pointer list-none flex gap-2 items-start ${levelTextColor(line.level)}`}>
                <span className="text-gray-600 shrink-0 tabular-nums select-none">
                  {formatTs(line.createdAt, i18n.language)}
                </span>
                <span
                  className={`shrink-0 font-bold px-1 rounded text-[9px] ${levelBadgeClass(line.level)}`}
                >
                  {levelBadgeLabel(line.level)}
                </span>
                <span className="text-purple-400/70 shrink-0 max-w-[5rem] truncate">{line.source}</span>
                <span className="break-all min-w-0 flex-1">{line.message}</span>
              </summary>
              <div className="pl-2 pb-2 pt-1 space-y-1 text-gray-500">
                {line.username && (
                  <p>
                    {t('admin.support.logsUser')}: {line.username}
                  </p>
                )}
                {line.url && <p className="break-all">URL: {line.url}</p>}
                {line.clientId && <p>Client: {line.clientId}</p>}
                {line.stack && <pre className="whitespace-pre-wrap break-all text-red-300/80">{line.stack}</pre>}
                {line.context && Object.keys(line.context).length > 0 && (
                  <pre className="whitespace-pre-wrap break-all text-gray-400/90">
                    {JSON.stringify(line.context, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          ))
        )}
      </div>

      {data && (
        <p className="text-[10px] text-gray-600">
          {t('admin.support.logsFetched', {
            count: filteredLines.length,
            total: data.total,
            months: data.retentionMonths,
          })}
        </p>
      )}
    </div>
  );
}

interface SegOption {
  value: string;
  label: string;
  accent?: 'red' | 'yellow';
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[#2a2a3d] text-[10px] max-w-full overflow-x-auto">
      {options.map((opt) => {
        const active = value === opt.value;
        let activeClass = 'bg-[#2d2d3d] text-white';
        if (active && opt.accent === 'red') activeClass = 'bg-red-900/30 text-red-400';
        if (active && opt.accent === 'yellow') activeClass = 'bg-yellow-900/20 text-yellow-400';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1.5 min-h-[44px] sm:min-h-0 whitespace-nowrap transition-colors ${
              active ? activeClass : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
