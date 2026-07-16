import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { UserSnapshotMeta } from '../types';

interface AdminUserSnapshotsPanelProps {
  token: string;
  userId: string;
  username: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Restauration de compte (admin) — spec commun/docs/RESTORE-COMPTE-ADMIN.md.
 * Scope v1 : profil (champs métier) + contenu possédé (feed, reels, stories,
 * albums, compositions). Ne couvre pas DM/chats/paiements (voir spec §7).
 */
export function AdminUserSnapshotsPanel({ token, userId, username }: AdminUserSnapshotsPanelProps) {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<UserSnapshotMeta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.listUserSnapshots(token, userId);
      setSnapshots(r.snapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network', { defaultValue: 'Erreur réseau' }));
    } finally {
      setLoading(false);
    }
  }, [token, userId, t]);

  useEffect(() => {
    if (expanded && snapshots === null) void reload();
  }, [expanded, snapshots, reload]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await api.createUserSnapshot(token, userId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network', { defaultValue: 'Erreur réseau' }));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshotId: string, createdAt: number) => {
    const dateLabel = new Date(createdAt).toLocaleString();
    const typed = window.prompt(
      t('admin.accounts.snapshots.restoreConfirmPrompt', {
        username,
        date: dateLabel,
        defaultValue: `Ceci va remplacer le profil et le contenu actuels de @${username} par l'état du ${dateLabel}. Tapez le pseudo pour confirmer :`,
      })
    );
    if (typed !== username) return;
    setRestoringId(snapshotId);
    setError('');
    try {
      await api.restoreUserSnapshot(token, userId, snapshotId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.network', { defaultValue: 'Erreur réseau' }));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <section className="rounded-xl border border-[#2d2d3d] bg-[#12121a] p-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 min-h-[44px] text-left"
      >
        <span className="text-xs font-semibold text-gray-300">
          {t('admin.accounts.snapshots.title', { defaultValue: 'Sauvegarde & restauration' })}
        </span>
        <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-gray-500 leading-snug">
            {t('admin.accounts.snapshots.hint', {
              defaultValue:
                'Profil + contenu possédé (posts, reels, stories, discographie). Ne couvre pas les messages privés.',
            })}
          </p>

          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="w-full min-h-[44px] py-2 rounded-lg bg-cyan-600/70 text-xs font-semibold disabled:opacity-50"
          >
            {creating
              ? t('app.loading', { defaultValue: 'Chargement…' })
              : t('admin.accounts.snapshots.createNow', { defaultValue: 'Sauvegarder maintenant' })}
          </button>

          {error && <p className="text-[10px] text-red-400">{error}</p>}

          {loading ? (
            <p className="text-[10px] text-gray-500">{t('app.loading', { defaultValue: 'Chargement…' })}</p>
          ) : snapshots && snapshots.length > 0 ? (
            <ul className="space-y-1.5">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-200">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {formatSize(s.sizeBytes)} ·{' '}
                      {t('admin.accounts.snapshots.itemCounts', {
                        posts: s.itemCounts.feedPosts,
                        reels: s.itemCounts.reels,
                        stories: s.itemCounts.stories,
                        defaultValue: `${s.itemCounts.feedPosts} posts, ${s.itemCounts.reels} reels, ${s.itemCounts.stories} stories`,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={restoringId === s.id}
                    onClick={() => void handleRestore(s.id, s.createdAt)}
                    className="shrink-0 min-h-[44px] px-3 rounded-lg bg-amber-600/70 text-[11px] font-semibold disabled:opacity-50"
                  >
                    {restoringId === s.id
                      ? t('app.loading', { defaultValue: 'Chargement…' })
                      : t('admin.accounts.snapshots.restore', { defaultValue: 'Restaurer' })}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-gray-500">
              {t('admin.accounts.snapshots.empty', { defaultValue: 'Aucune sauvegarde pour ce compte.' })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
