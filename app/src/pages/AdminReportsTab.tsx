import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ConfirmModal } from '../components/ConfirmModal';
import type { ContentReport } from '../types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  salon: 'Salon',
  live: 'Live',
  dm: 'Message privé',
  reel: 'Reel',
  profile: 'Profil',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  reviewed: { label: 'Examiné', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  dismissed: { label: 'Rejeté', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

export function AdminReportsTab() {
  const { token } = useAuth();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'dismissed'>('all');

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminGetReports(token);
      setReports(data.reports);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handlePatch = async (id: string, status: 'reviewed' | 'dismissed') => {
    if (!token || actionLoading) return;
    setActionLoading(id);
    try {
      await api.adminPatchReport(token, id, status);
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, reviewedAt: Date.now() } : r
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
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
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === 'all'
    ? reports
    : reports.filter((r) => (r.status ?? 'pending') === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={loadReports}
          className="mt-3 px-4 py-2 text-xs bg-purple-600 text-white rounded-lg"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'reviewed', 'dismissed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-[#1a1a26] text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? `Tous (${reports.length})` : STATUS_CONFIG[f]?.label}
            {f !== 'all' && ` (${reports.filter((r) => (r.status ?? 'pending') === f).length})`}
          </button>
        ))}
        <button
          type="button"
          onClick={loadReports}
          className="ml-auto px-3 py-1.5 rounded-full text-xs bg-[#1a1a26] text-gray-400 hover:text-white transition"
        >
          ↻ Actualiser
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm text-gray-400">
            {filter === 'all' ? 'Aucun signalement' : `Aucun signalement "${STATUS_CONFIG[filter]?.label}"`}
          </p>
        </div>
      )}

      {filtered.map((report) => {
        const status = report.status ?? 'pending';
        const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
        const isLoading = actionLoading === report.id;

        return (
          <div
            key={report.id}
            className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">
                  {report.reporterUsername}
                  <span className="ml-1.5 text-gray-500 font-normal">signale</span>
                  {report.roomType && (
                    <span className="ml-1 text-purple-400">
                      {ROOM_TYPE_LABELS[report.roomType] ?? report.roomType}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(report.createdAt)}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            {/* Category + Details */}
            <div className="space-y-1">
              <p className="text-xs text-gray-300 font-medium">{report.category}</p>
              {report.details && (
                <p className="text-xs text-gray-500 leading-relaxed">{report.details}</p>
              )}
            </div>

            {/* IDs */}
            <div className="text-[10px] text-gray-600 space-y-0.5">
              {report.targetUserId && <p>Cible : {report.targetUserId}</p>}
              {report.roomId && <p>Room : {report.roomId}</p>}
              {report.messageId && <p>Message : {report.messageId}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePatch(report.id, 'reviewed')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:opacity-50 transition"
                  >
                    ✓ Marquer examiné
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePatch(report.id, 'dismissed')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30 hover:bg-gray-600/30 disabled:opacity-50 transition"
                  >
                    Rejeter
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setConfirmDeleteId(report.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-50 transition ml-auto"
              >
                {isLoading ? '…' : '🗑 Supprimer'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
