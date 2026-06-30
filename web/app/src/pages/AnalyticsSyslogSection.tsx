import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { SyslogLine, SyslogResponse } from '../types';

type LogType = 'pm2' | 'system';
type LineCount = 50 | 100 | 200;
type LevelFilter = 'all' | 'error' | 'warn' | 'info';

function levelTextColor(level: SyslogLine['level']): string {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-yellow-400';
  return 'text-gray-400';
}

function levelBadgeClass(level: SyslogLine['level']): string {
  if (level === 'error') return 'text-red-500 bg-red-500/10';
  if (level === 'warn') return 'text-yellow-500 bg-yellow-500/10';
  return 'text-gray-600 bg-gray-500/10';
}

function levelBadgeLabel(level: SyslogLine['level']): string {
  if (level === 'error') return 'ERR';
  if (level === 'warn') return 'WRN';
  return 'INF';
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso.slice(11, 19);
  }
}

export function AnalyticsSyslogSection() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<SyslogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logType, setLogType] = useState<LogType>('pm2');
  const [lineCount, setLineCount] = useState<LineCount>(100);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getVpsSyslog(token, { lines: lineCount, type: logType })
      .then((r) => {
        setData(r);
        setError(null);
        // Scroll to bottom after render
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 30);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : t('admin.analytics.syslogError')),
      )
      .finally(() => setLoading(false));
  }, [token, lineCount, logType, t]);

  // Reload when params change
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 10 s
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 10_000);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, load]);

  const filteredLines: SyslogLine[] =
    data?.lines.filter((l) => levelFilter === 'all' || l.level === levelFilter) ?? [];

  function handleCopy() {
    const text = filteredLines
      .map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    void navigator.clipboard.writeText(text);
  }

  function handleDownload() {
    const text = filteredLines
      .map((l) => `[${l.ts}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syslog-${logType}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
      {/* ── Row 1 : title + type/count/level selectors ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-white">
          {t('admin.analytics.syslogTitle')}
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Log type */}
          <SegmentedControl
            options={[
              { value: 'pm2', label: 'PM2' },
              { value: 'system', label: t('admin.analytics.syslogTypeSystem') },
            ]}
            value={logType}
            onChange={(v) => setLogType(v as LogType)}
          />
          {/* Line count */}
          <SegmentedControl
            options={[
              { value: '50', label: '50' },
              { value: '100', label: '100' },
              { value: '200', label: '200' },
            ]}
            value={String(lineCount)}
            onChange={(v) => setLineCount(Number(v) as LineCount)}
          />
          {/* Level filter */}
          <SegmentedControl
            options={[
              { value: 'all', label: t('admin.analytics.syslogLevelAll') },
              { value: 'error', label: t('admin.analytics.syslogLevelError'), accent: 'red' },
              { value: 'warn', label: t('admin.analytics.syslogLevelWarn'), accent: 'yellow' },
              { value: 'info', label: t('admin.analytics.syslogLevelInfo') },
            ]}
            value={levelFilter}
            onChange={(v) => setLevelFilter(v as LevelFilter)}
          />
        </div>
      </div>

      {/* ── Row 2 : auto-refresh + actions ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border transition-colors ${
              autoRefresh
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                autoRefresh ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'
              }`}
            />
            {t('admin.analytics.syslogAutoRefresh')}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-2.5 py-1 text-[10px] border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : '↻'}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={filteredLines.length === 0}
            className="px-2.5 py-1 text-[10px] border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 transition-colors"
          >
            {t('admin.analytics.syslogCopy')}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={filteredLines.length === 0}
            className="px-2.5 py-1 text-[10px] border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 transition-colors"
          >
            ↓ {t('admin.analytics.syslogDownload')}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* ── Log viewer ── */}
      <div
        ref={scrollRef}
        className="h-96 overflow-y-auto bg-[#07070f] rounded-xl border border-[#191926] p-2.5 font-mono text-[10px] leading-relaxed space-y-px"
      >
        {filteredLines.length === 0 && !loading ? (
          <p className="text-gray-600 text-center py-10">
            {t('admin.analytics.syslogEmpty')}
          </p>
        ) : (
          filteredLines.map((line, i) => (
            <div
              key={i}
              className={`flex gap-2 px-1 py-px rounded hover:bg-white/[0.025] ${levelTextColor(line.level)}`}
            >
              {/* Timestamp */}
              <span className="text-gray-600 shrink-0 tabular-nums select-none">
                {formatTs(line.ts)}
              </span>
              {/* Level badge */}
              <span
                className={`shrink-0 font-bold px-1 rounded text-[9px] self-start mt-px ${levelBadgeClass(line.level)}`}
              >
                {levelBadgeLabel(line.level)}
              </span>
              {/* Source (system only) */}
              {logType === 'system' && (
                <span className="text-purple-400/60 shrink-0 max-w-[90px] truncate self-start">
                  {line.source}
                </span>
              )}
              {/* Message */}
              <span className="break-all min-w-0">{line.message}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Footer: line count + fetch time ── */}
      {data && (
        <p className="text-[10px] text-gray-600">
          {t('admin.analytics.syslogFetched', {
            count: filteredLines.length,
            total: data.count,
          })}
          {' · '}
          {new Date(data.fetchedAt).toLocaleTimeString()}
        </p>
      )}
    </section>
  );
}

/* ─── Reusable segmented-control pill ─────────────────────────── */
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
    <div className="flex rounded-lg overflow-hidden border border-[#2a2a3d] text-[10px]">
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
            className={`px-2.5 py-1 transition-colors ${
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
