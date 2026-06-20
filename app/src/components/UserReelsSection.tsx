import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import { formatCompactCount } from '../lib/formatCount';
import {
  REEL_RECORD_MAX_SEC,
  estimateCreateReelPayloadBytes,
  formatPayloadSize,
  importVideoFile,
  payloadTooLargeForMsdev,
  validateReelVideoFile,
} from '../lib/reelRecording';
import { ProfileReelPreview } from './ProfileReelPreview';
import { ConfirmModal } from './ConfirmModal';
import type { MusicReel } from '../content/reels';

interface UserReelsSectionProps {
  userId: string;
  title?: string;
  /** Profil personnel : onglets publiés / privés */
  isOwner?: boolean;
  /** Follow mutuel avec le propriétaire du profil (reels privés d'un autre utilisateur). */
  canViewPrivateReels?: boolean;
  refreshKey?: number;
  onOpenReel: (reelId: string) => void;
  /** Carrousel horizontal (profil inline) ou grille (onglet Mes reels). */
  layout?: 'carousel' | 'grid';
  /** Onglet propriétaire par défaut (publiés pour l’onglet Mes reels). */
  defaultOwnerTab?: 'published' | 'private';
  /** Masquer le titre de section (onglet dédié). */
  hideSectionTitle?: boolean;
  /** CTA vide : ouvrir l’enregistreur (profil personnel). */
  onRecordReel?: () => void;
  /** Artiste par défaut pour l’import vidéo (profil personnel). */
  defaultArtist?: string;
}

type OwnerTab = 'published' | 'private';

function normalizeReelsList(raw: unknown): MusicReel[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => normalizeProfileReelFromApi(item as Parameters<typeof normalizeProfileReelFromApi>[0]))
    .filter((r): r is MusicReel => r != null && !!r.posterUrl);
}

function AddReelTile({
  layout,
  importing,
  onPickFile,
}: {
  layout: 'carousel' | 'grid';
  importing: boolean;
  onPickFile: () => void;
}) {
  const isGrid = layout === 'grid';
  return (
    <button
      type="button"
      onClick={onPickFile}
      disabled={importing}
      className={
        isGrid
          ? 'relative min-w-0 w-full text-left'
          : 'shrink-0 w-[108px] snap-start relative text-left'
      }
    >
      <div
        className={`relative aspect-[9/16] w-full rounded-xl overflow-hidden border-2 border-dashed border-pink-500/40 bg-[#0b0b12] hover:border-pink-500/70 hover:bg-pink-950/20 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 ${
          isGrid ? '' : 'w-[108px]'
        }`}
      >
        {importing ? (
          <>
            <span className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-semibold text-pink-300">Import…</span>
          </>
        ) : (
          <>
            <span className="text-2xl text-pink-400" aria-hidden>
              +
            </span>
            <span className="text-[10px] font-bold text-pink-300 text-center px-2 leading-tight">
              Ajouter un reel
            </span>
          </>
        )}
      </div>
    </button>
  );
}

function ReelsGrid({
  reels,
  reelScope,
  layout,
  canManage,
  showAddTile,
  importing,
  onPickFile,
  deletingId,
  publishingId,
  onReelClick,
  onDelete,
  onPublish,
}: {
  reels: MusicReel[];
  reelScope: 'published' | 'private';
  layout: 'carousel' | 'grid';
  canManage: boolean;
  showAddTile: boolean;
  importing: boolean;
  onPickFile: () => void;
  deletingId: string | null;
  publishingId: string | null;
  onReelClick: (reel: MusicReel) => void;
  onDelete: (reelId: string, e: React.MouseEvent) => void;
  onPublish: (reelId: string, e: React.MouseEvent) => void;
}) {
  const isGrid = layout === 'grid';

  return (
    <div
      className={
        isGrid
          ? 'grid grid-cols-3 gap-2 sm:gap-3'
          : 'flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory'
      }
    >
      {showAddTile && (
        <AddReelTile layout={layout} importing={importing} onPickFile={onPickFile} />
      )}
      {reels.map((reel) => (
        <div
          key={reel.id}
          className={isGrid ? 'relative min-w-0' : 'shrink-0 w-[108px] snap-start relative'}
        >
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
            <div
              className={`relative aspect-[9/16] w-full rounded-xl overflow-hidden border border-[#2d2d3d] bg-black group-hover:border-pink-500/50 transition-colors ${
                isGrid ? '' : 'w-[108px]'
              }`}
            >
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
              {reel.viewCount != null && reel.viewCount > 0 && (
                <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-gray-200">
                  👁 {formatCompactCount(reel.viewCount)}
                </span>
              )}
              <p className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-2 leading-tight">
                {reel.title}
              </p>
            </div>
            {!isGrid && <p className="mt-1.5 text-[10px] text-gray-400 truncate">{reel.artist}</p>}
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

type PendingUpload = {
  mediaUrl: string;
  posterUrl: string;
  durationSec: number;
};

export function UserReelsSection({
  userId,
  title,
  isOwner,
  canViewPrivateReels = false,
  refreshKey = 0,
  onOpenReel,
  layout = 'carousel',
  defaultOwnerTab = 'published',
  hideSectionTitle = false,
  onRecordReel,
  defaultArtist = '',
}: UserReelsSectionProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ownerTab, setOwnerTab] = useState<OwnerTab>(defaultOwnerTab);
  const showReelTabs = Boolean(isOwner || canViewPrivateReels);
  const reelScope =
    showReelTabs && ownerTab === 'private' ? 'private' : 'published';
  const canManage = Boolean(isOwner && token);

  const [reels, setReels] = useState<MusicReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteReelId, setConfirmDeleteReelId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [previewReel, setPreviewReel] = useState<MusicReel | null>(null);

  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState(defaultArtist);
  const [uploadGenre, setUploadGenre] = useState('');

  useEffect(() => {
    setOwnerTab(defaultOwnerTab);
  }, [defaultOwnerTab, userId]);

  useEffect(() => {
    if (!showReelTabs && ownerTab === 'private') {
      setOwnerTab('published');
    }
  }, [showReelTabs, ownerTab]);

  useEffect(() => {
    setUploadArtist((a) => a || defaultArtist);
  }, [defaultArtist]);

  const resetUploadForm = () => {
    setPendingUpload(null);
    setUploadTitle('');
    setUploadGenre('');
    setUploadError(null);
  };

  const openFilePicker = () => {
    if (importing || uploading) return;
    fileInputRef.current?.click();
  };

  const handleVideoUpload = async (file: File) => {
    setUploadError(null);
    const validationError = validateReelVideoFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setImporting(true);
    try {
      const imported = await importVideoFile(file);
      setPendingUpload(imported);
      setUploadTitle('');
      setUploadArtist((a) => a || defaultArtist);
      setUploadGenre('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setImporting(false);
    }
  };

  const publishUploadedReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pendingUpload || uploading) return;
    setUploadError(null);
    setUploading(true);
    try {
      const body = {
        title: uploadTitle.trim(),
        artist: uploadArtist.trim(),
        genre: uploadGenre.trim(),
        mediaType: 'video' as const,
        mediaUrl: pendingUpload.mediaUrl,
        posterUrl: pendingUpload.posterUrl,
        durationSec: pendingUpload.durationSec,
        visibility: 'private' as const,
        isPrivate: true,
      };
      const payloadBytes = estimateCreateReelPayloadBytes(body);
      if (payloadTooLargeForMsdev(payloadBytes)) {
        setUploadError(
          `Vidéo trop lourde (${formatPayloadSize(payloadBytes)}). Max ${REEL_RECORD_MAX_SEC} s ou qualité plus basse.`
        );
        return;
      }
      await api.createReel(token, body);
      resetUploadForm();
      await loadReels();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Publication impossible');
    } finally {
      setUploading(false);
    }
  };

  const loadReels = useCallback(() => {
    if (!token) {
      setReels([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    const fetcher =
      reelScope === 'private'
        ? isOwner
          ? api.getMyPrivateReels(token)
          : canViewPrivateReels
            ? api.getUserPrivateReels(token, userId)
            : Promise.resolve({ reels: [] })
        : api.getUserReels(token, userId).then((r) => ({
            reels: normalizeReelsList(r.reels).filter(
              (reel) => reel.visibility !== 'private' && !reel.isPrivate
            ),
          }));

    return fetcher
      .then((r) => setReels(normalizeReelsList(r.reels)))
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, [token, userId, reelScope, isOwner, canViewPrivateReels]);

  useEffect(() => {
    void loadReels();
  }, [loadReels, refreshKey]);

  const handleReelClick = (reel: MusicReel) => {
    const isPrivate = reel.visibility === 'private' || reel.isPrivate;
    if (isPrivate) setPreviewReel(reel);
    else onOpenReel(reel.id);
  };

  const requestDeleteReel = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !canManage) return;
    setConfirmDeleteReelId(reelId);
  };

  const confirmDeleteReel = async () => {
    if (!token || !canManage || !confirmDeleteReelId) return;
    const reelId = confirmDeleteReelId;
    setDeletingId(reelId);
    try {
      await api.deleteReel(token, reelId);
      if (previewReel?.id === reelId) setPreviewReel(null);
      await loadReels();
      setConfirmDeleteReelId(null);
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
    title ??
    (isOwner
      ? ownerTab === 'private'
        ? 'Mes reels privés'
        : 'Reels publiés'
      : reelScope === 'private'
        ? t('profile.privateReelsTabOther')
        : 'Reels');
  const emptyMessage =
    reelScope === 'published' ? 'Aucun reel pour le moment' : 'Aucun reel privé pour le moment';
  const privateScopeHint = isOwner
    ? 'Visible uniquement sur votre profil'
    : t('profile.privateReelsMutualHint');

  const sectionClass =
    layout === 'grid'
      ? 'p-4 max-w-lg mx-auto w-full'
      : 'bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4';

  return (
    <>
      <section className={sectionClass}>
        {showReelTabs && (
          <div className="flex gap-1 p-1 mb-3 bg-[#0b0b0f] border border-[#2d2d3d] rounded-lg">
            {(
              [
                ['published', 'Publiés'],
                ['private', 'Privés'],
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

        {!hideSectionTitle && (
          <div className="mb-3">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">{sectionTitle}</h3>
            {reelScope === 'private' && (
              <p className="text-[10px] text-gray-500 mt-0.5">{privateScopeHint}</p>
            )}
          </div>
        )}

        {loading && <p className="text-xs text-gray-500 text-center py-8">Chargement…</p>}

        {isOwner && uploadError && !pendingUpload && (
          <p className="mb-3 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {uploadError}
          </p>
        )}

        {!loading && reels.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="text-3xl opacity-40" aria-hidden>
              🎬
            </p>
            <p className="text-sm text-gray-400">{emptyMessage}</p>
            {isOwner && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-lg shadow-pink-900/30 disabled:opacity-50"
                >
                  {importing ? 'Import…' : 'Importer une vidéo'}
                </button>
                {onRecordReel && (
                  <button
                    type="button"
                    onClick={onRecordReel}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-200 bg-[#1a1a26] border border-[#2d2d3d] hover:border-pink-500/40"
                  >
                    Enregistrer un reel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && reels.length > 0 && (
          <ReelsGrid
            reels={reels}
            reelScope={reelScope}
            layout={layout}
            canManage={canManage}
            showAddTile={Boolean(isOwner)}
            importing={importing}
            onPickFile={openFilePicker}
            deletingId={deletingId}
            publishingId={publishingId}
            onReelClick={handleReelClick}
            onDelete={(id, e) => requestDeleteReel(id, e)}
            onPublish={(id, e) => void publishReel(id, e)}
          />
        )}

        {isOwner && (
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleVideoUpload(file);
            }}
          />
        )}
      </section>

      {pendingUpload && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reel-upload-title"
        >
          <form
            onSubmit={(e) => void publishUploadedReel(e)}
            className="w-full max-w-sm rounded-2xl bg-[#12121a] border border-[#2d2d3d] p-4 space-y-3 shadow-xl"
          >
            <h4 id="reel-upload-title" className="text-sm font-bold text-white">
              Publier sur votre profil
            </h4>
            <p className="text-[11px] text-gray-500">
              Reel privé — visible sur votre profil uniquement.
            </p>
            <div className="space-y-3">
              <img
                src={pendingUpload.posterUrl}
                alt=""
                className="w-full max-w-[min(100%,12rem)] mx-auto aspect-[9/16] rounded-xl object-cover border border-[#2d2d3d]"
              />
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-gray-400">Titre</span>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                    maxLength={120}
                    className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400">Artiste</span>
                  <input
                    value={uploadArtist}
                    onChange={(e) => setUploadArtist(e.target.value)}
                    required
                    maxLength={120}
                    className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-400">Genre</span>
                  <input
                    value={uploadGenre}
                    onChange={(e) => setUploadGenre(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="Ex: Pop, Électro…"
                    className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"
                  />
                </label>
              </div>
            </div>
            {uploadError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-2 py-1.5">
                {uploadError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetUploadForm}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300 disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={
                  uploading || !uploadTitle.trim() || !uploadArtist.trim() || !uploadGenre.trim()
                }
                className="flex-[2] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm disabled:opacity-40"
              >
                {uploading ? 'Publication…' : 'Publier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewReel && <ProfileReelPreview reel={previewReel} onClose={() => setPreviewReel(null)} />}

      <ConfirmModal
        open={confirmDeleteReelId !== null}
        title="Supprimer ce reel ?"
        description="Cette action est irréversible."
        loading={Boolean(deletingId && confirmDeleteReelId === deletingId)}
        loadingLabel="Suppression…"
        onCancel={() => setConfirmDeleteReelId(null)}
        onConfirm={() => void confirmDeleteReel()}
      />
    </>
  );
}
