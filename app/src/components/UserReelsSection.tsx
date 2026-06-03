import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import { ProfileReelPreview } from './ProfileReelPreview';
import type { MusicReel } from '../content/reels';

interface UserReelsSectionProps {
  userId: string;
  title?: string;
  /** Profil personnel : onglets publiés / privés */
  isOwner?: boolean;
  refreshKey?: number;
  onOpenReel: (reelId: string) => void;
}

type OwnerTab = 'published' | 'private';

function normalizeReelsList(raw: unknown): MusicReel[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => normalizeProfileReelFromApi(item as Parameters<typeof normalizeProfileReelFromApi>[0]))
    .filter((r): r is MusicReel => r != null && !!r.posterUrl);
}

function ReelsGrid({
  reels,
  reelScope,
  canManage,
  deletingId,
  publishingId,
  onReelClick,
  onDelete,
  onPublish,
}: {
  reels: MusicReel[];
  reelScope: 'published' | 'private';
  canManage: boolean;
  deletingId: string | null;
  publishingId: string | null;
  onReelClick: (reel: MusicReel) => void;
  onDelete: (reelId: string, e: React.MouseEvent) => void;
  onPublish: (reelId: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
      {reels.map((reel) => (
        <div key={reel.id} className="shrink-0 w-[108px] snap-start relative">
          {canManage && (
            <button
              type="button"
              onClick={(e) => onDelete(reel.id, e)}
              disabled={deletingId === reel.id}
              title="Supprimer"
              aria-label={`Supprimer ${reel.title}`}
              className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-black/70 border border-red-500/50 text-red-300 text-xs hover:bg-red-950/80 disabled:opacity-50"
            >
              {deletingId === reel.id ? '…' : '🗑'}
            </button>
          )}
          <button type="button" onClick={() => onReelClick(reel)} className="w-full text-left group">
            <div className="relative aspect-[9/16] w-[108px] rounded-xl overflow-hidden border border-[#2d2d3d] bg-black group-hover:border-pink-500/50 transition-colors">
              <img
                src={reel.posterUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {reelScope === 'private' && (
                <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 uppercase tracking-wide">
                  Privé
                </span>
              )}
              <p className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-2 leading-tight">
                {reel.title}
              </p>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400 truncate">{reel.artist}</p>
          </button>
          {canManage && reelScope === 'private' && (
            <button
              type="button"
              onClick={(e) => onPublish(reel.id, e)}
              disabled={publishingId === reel.id}
              className="mt-1.5 w-full py-1 rounded-lg bg-emerald-900/50 border border-emerald-500/40 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-800/50 disabled:opacity-50"
            >
              {publishingId === reel.id ? 'Publication…' : 'Publier'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function UserReelsSection({
  userId,
  title,
  isOwner,
  refreshKey = 0,
  onOpenReel,
}: UserReelsSectionProps) {
  const { token } = useAuth();
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('private');
  const reelScope = isOwner ? ownerTab : 'published';
  const canManage = Boolean(isOwner && token);

  const [reels, setReels] = useState<MusicReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [previewReel, setPreviewReel] = useState<MusicReel | null>(null);

  const loadReels = useCallback(() => {
    if (!token) {
      setReels([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    const fetcher =
      reelScope === 'private'
        ? api.getMyPrivateReels(token)
        : api.getUserReels(token, userId).then((r) => ({
            reels: normalizeReelsList(r.reels).filter(
              (reel) => reel.visibility !== 'private' && !reel.isPrivate
            ),
          }));

    return fetcher
      .then((r) => setReels(normalizeReelsList(r.reels)))
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, [token, userId, reelScope]);

  useEffect(() => {
    void loadReels();
  }, [loadReels, refreshKey]);

  const handleReelClick = (reel: MusicReel) => {
    const isPrivate = reel.visibility === 'private' || reel.isPrivate;
    if (isPrivate) setPreviewReel(reel);
    else onOpenReel(reel.id);
  };

  const deleteReel = async (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !canManage) return;
    if (!window.confirm('Supprimer ce reel ? Cette action est irréversible.')) return;
    setDeletingId(reelId);
    try {
      await api.deleteReel(token, reelId);
      if (previewReel?.id === reelId) setPreviewReel(null);
      await loadReels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossible de supprimer');
    } finally {
      setDeletingId(null);
    }
  };

  const publishReel = async (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || publishingId) return;
    if (!window.confirm('Publier ce reel dans le flux public Reels ?')) return;
    setPublishingId(reelId);
    try {
      await api.publishReel(token, reelId);
      await loadReels();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossible de publier');
    } finally {
      setPublishingId(null);
    }
  };

  const sectionTitle =
    title ?? (isOwner ? (ownerTab === 'private' ? 'Mes reels privés' : 'Reels publiés') : 'Reels publiés');
  const emptyMessage = reelScope === 'published' ? 'Aucun reel publié' : 'Aucun reel privé';

  return (
    <>
      <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
        {isOwner && (
          <div className="flex gap-1 p-1 mb-3 bg-[#0b0b0f] border border-[#2d2d3d] rounded-lg">
            {(
              [
                ['private', 'Privés'],
                ['published', 'Publiés'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOwnerTab(id)}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition ${
                  ownerTab === id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mb-3">
          <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">{sectionTitle}</h3>
          {reelScope === 'private' && (
            <p className="text-[10px] text-gray-500 mt-0.5">Visible uniquement sur votre profil</p>
          )}
        </div>

        {loading && <p className="text-xs text-gray-500 text-center py-4">Chargement…</p>}

        {!loading && reels.length === 0 && (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-gray-500">{emptyMessage}</p>
            {isOwner && reelScope === 'private' && (
              <p className="text-xs text-gray-600">Utilisez l’onglet Enregistrer pour filmer un reel privé</p>
            )}
          </div>
        )}

        {!loading && reels.length > 0 && (
          <ReelsGrid
            reels={reels}
            reelScope={reelScope}
            canManage={canManage}
            deletingId={deletingId}
            publishingId={publishingId}
            onReelClick={handleReelClick}
            onDelete={(id, e) => void deleteReel(id, e)}
            onPublish={(id, e) => void publishReel(id, e)}
          />
        )}
      </section>

      {previewReel && <ProfileReelPreview reel={previewReel} onClose={() => setPreviewReel(null)} />}
    </>
  );
}
