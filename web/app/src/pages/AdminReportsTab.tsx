import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import { getProfilePath } from '../lib/profileDeepLink';
import type { AdminReportCounts, ContentReport } from '../types';

type ReportFilter = 'all' | 'pending' | 'reviewed' | 'dismissed';

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: string): string {
  if (status === 'pending') return 'bg-yellow-500/15 text-yellow-300';
  if (status === 'reviewed') return 'bg-green-500/15 text-green-300';
  return 'bg-gray-500/15 text-gray-300';
}

export function AdminReportsTab() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [counts, setCounts] = useState<AdminReportCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetReports(token);
      setReports(data.reports);
      if (data.counts) setCounts(data.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.reports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handlePatch = async (id: string, status: 'reviewed' | 'dismissed') => {
    if (!token || actionLoading) return;
    setActionLoading(id);
    try {
      await api.adminPatchReport(token, id, status);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, reviewedAt: Date.now() } : r))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.reports.actionError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || actionLoading) return;
    setActionLoading(id);
    try {
      await api.adminDeleteReport(token, id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.support.reports.actionError'));
    } finally {
      setActionLoading(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = reports.filter((r) => {
    const status = r.status ?? 'pending';
    if (filter !== 'all' && status !== filter) return false;
    if (!q) return true;
    return (
      r.reporterUsername.toLowerCase().includes(q) ||
      (r.reporterEmail?.toLowerCase().includes(q) ?? false) ||
      (r.targetUsername?.toLowerCase().includes(q) ?? false) ||
      (r.details?.toLowerCase().includes(q) ?? false) ||
      r.category.toLowerCase().includes(q)
    );
  });

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  if (loading) {
    return <p className="text-sm text-gray-500">{t('admin.support.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t('admin.support.reports.hint')}</p>

      {counts ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { key: 'pending', value: counts.pending, color: 'text-yellow-300' },
              { key: 'urgent', value: counts.urgent, color: 'text-red-400' },
              { key: 'reviewed', value: counts.reviewed, color: 'text-green-400' },
              { key: 'dismissed', value: counts.dismissed, color: 'text-gray-400' },
            ] as const
          ).map((stat) => (
            <div key={stat.key} className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                {t(`admin.support.reports.stats.${stat.key}`)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input
        type="search"
        autoComplete="off"
        className="w-full bg-[#1a1a26] border border-purple-500/40 rounded-2xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-purple-400"
        placeholder={t('admin.support.reports.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'reviewed', 'dismissed', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {t(`admin.support.reports.filter.${f}`)}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">{t('admin.support.reports.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((report) => {
            const status = report.status ?? 'pending';
            return (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  className="w-full text-left rounded-2xl border border-[#2d2d3d] bg-[#12121a] p-3 hover:border-purple-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        @{report.reporterUsername}
                        <span className="ml-1.5 text-gray-500 font-normal">
                          {t('admin.support.reports.flags')}
                        </span>
                        {report.roomType ? (
                          <span className="ml-1 text-purple-300">
                            {t(`admin.support.reports.room.${report.roomType}`, {
                              defaultValue: report.roomType,
                            })}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatDate(report.createdAt, locale)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {report.priority === 'urgent' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300">
                          {t('admin.support.reports.urgent')}
                        </span>
                      ) : null}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass(status)}`}>
                        {t(`admin.support.reports.status.${status}`)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">
                    {t(`admin.support.reports.category.${report.category}`, {
                      defaultValue: report.category,
                    })}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedId(null)}
            >
              <div
                className="w-full max-w-lg max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-[#0b0b0f] border border-[#1e1e2f] overflow-y-auto p-4 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/90">
                      {t('admin.support.reports.dossierKicker')}
                    </p>
                    <h2 className="text-base font-bold">
                      {t(`admin.support.reports.category.${selected.category}`, {
                        defaultValue: selected.category,
                      })}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="w-11 h-11 rounded-xl bg-[#14141c] border border-[#2a2a3a]"
                    onClick={() => setSelectedId(null)}
                    aria-label={t('admin.support.closeTicket')}
                  >
                    ×
                  </button>
                </div>
                {selected.details ? (
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.details}</p>
                ) : null}
                <div className="rounded-2xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-1 text-xs text-gray-400">
                  <p>
                    {t('admin.support.reports.reporter')}: @{selected.reporterUsername}
                    {selected.reporterEmail ? ` · ${selected.reporterEmail}` : ''}
                  </p>
                  {selected.targetUserId ? (
                    <p>
                      {t('admin.support.reports.target')}: @{selected.targetUsername ?? selected.targetUserId}
                    </p>
                  ) : null}
                  {selected.roomId ? (
                    <p className="font-mono text-[10px] text-gray-600">
                      {selected.roomType} · {selected.roomId}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                    onClick={() =>
                      window.open(getProfilePath(selected.reporterId), '_blank', 'noopener,noreferrer')
                    }
                  >
                    {t('admin.support.reports.openReporter')}
                  </button>
                  {selected.targetUserId ? (
                    <button
                      type="button"
                      className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d]"
                      onClick={() =>
                        window.open(getProfilePath(selected.targetUserId!), '_blank', 'noopener,noreferrer')
                      }
                    >
                      {t('admin.support.reports.openTarget')}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(selected.status ?? 'pending') === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === selected.id}
                        onClick={() => void handlePatch(selected.id, 'reviewed')}
                        className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-green-600/80 disabled:opacity-50"
                      >
                        {t('admin.support.reports.markReviewed')}
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === selected.id}
                        onClick={() => void handlePatch(selected.id, 'dismissed')}
                        className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-[#1a1a26] border border-[#2d2d3d] disabled:opacity-50"
                      >
                        {t('admin.support.reports.dismiss')}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={actionLoading === selected.id}
                    onClick={() => setConfirmDeleteId(selected.id)}
                    className="min-h-11 px-3 rounded-xl text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 disabled:opacity-50"
                  >
                    {t('admin.support.reports.delete')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title={t('admin.support.reports.deleteTitle')}
        description={t('admin.support.reports.deleteDesc')}
        loading={Boolean(confirmDeleteId && actionLoading === confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) void handleDelete(confirmDeleteId);
        }}
      />
    </div>
  );
}
