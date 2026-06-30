import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { SyslogLine } from '../types';

type ServerLogType = 'pm2' | 'system';
type LineCount = 50 | 100 | 200 | 500;
type LevelFilter = 'all' | 'error' | 'warn' | 'info';

function levelTextColor(level: SyslogLine['level']): string {
  if (level === 'error') return 'text-red-400';
  if (level === 'warn') return 'text-yellow-400';
  return 'text-gray-400';
}

function formatTs(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AdminServerLogsPanel({ defaultType = 'pm2' }: { defaultType?: ServerLogType }) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [logType, setLogType] = useState<ServerLogType>(defaultType);
  const [lines, setLines] = useState<SyslogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<LineCount>(100);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.getVpsSyslog(token, { lines: lineCount, type: logType });
      setLines(res.lines);
      setError(null);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }, 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.diag.serverLogsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [token, lineCount, logType, t]);

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

  const filtered = lines.filter((l) => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.message.toLowerCase().includes(q) || l.source.toLowerCase().includes(q);
  });

  function handleCopy() {
    const text = filtered
      .map((l) => `[${l.ts}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {logType === 'pm2'
          ? t('admin.support.diag.serverLogsPm2Hint')
          : t('admin.support.diag.serverLogsSystemHint')}
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <SegmentedControl
          options={[
            { value: 'pm2', label: t('admin.support.diag.logTabPm2') },
            { value: 'system', label: t('admin.support.diag.logTabSystem') },
          ]}
          value={logType}
          onChange={(v) => setLogType(v as ServerLogType)}
        />
        <SegmentedControl
          options={[
            { value: '50', label: '50' },
            { value: '100', label: '100' },
            { value: '200', label: '200' },
            { value: '500', label: '500' },
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

      <div className="flex flex-wrap gap-2">
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
        <button
          type="button"
          onClick={handleCopy}
          disabled={filtered.length === 0}
          className="px-3 py-2 min-h-[44px] text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-xl disabled:opacity-50"
        >
          {t('admin.support.logsCopy')}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div
        ref={scrollRef}
        className="h-[min(55dvh,24rem)] overflow-y-auto overscroll-contain bg-[#07070f] rounded-xl border border-[#191926] p-2.5 font-mono text-[10px] leading-relaxed space-y-0.5"
      >
        {filtered.length === 0 && !loading ? (
          <p className="text-gray-600 text-center py-10">{t('admin.support.logsEmpty')}</p>
        ) : (
          filtered.map((line, idx) => (
            <div key={`${line.ts}-${idx}`} className={`flex gap-2 ${levelTextColor(line.level)}`}>
              <span className="text-gray-600 shrink-0 tabular-nums">{formatTs(line.ts, i18n.language)}</span>
              <span className="text-purple-400/70 shrink-0 max-w-[5rem] truncate">{line.source}</span>
              <span className="break-all min-w-0">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; accent?: 'red' | 'yellow' }[];
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
