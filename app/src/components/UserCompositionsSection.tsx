import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  formatDurationSec,
  getAudioDurationSec,
  readFileAsDataUrl,
  validateCompositionFile,
} from '../lib/compositionUpload';
import { ConfirmModal } from './ConfirmModal';

export interface UserCompositionItem {
  id: string;
  userId: string;
  title: string;
  artist?: string;
  fileUrl: string;
  durationSec?: number;
  createdAt: number;
}

interface UserCompositionsSectionProps {
  defaultArtist?: string;
  refreshKey?: number;
}

type PendingUpload = {
  dataUrl: string;
  durationSec?: number;
  fileName: string;
};

export function UserCompositionsSection({
  defaultArtist = '',
  refreshKey = 0,
}: UserCompositionsSectionProps) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [compositions, setCompositions] = useState<UserCompositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState(defaultArtist);

  useEffect(() => {
    setUploadArtist((a) => a || defaultArtist);
  }, [defaultArtist]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const loadCompositions = useCallback(() => {
    if (!token) {
      setCompositions([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api
      .getMyCompositions(token)
      .then((r) => setCompositions(r.compositions))
      .catch(() => setCompositions([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    void loadCompositions();
  }, [loadCompositions, refreshKey]);

  const resetUploadForm = () => {
    setPendingUpload(null);
    setUploadTitle('');
    setUploadError(null);
  };

  const openFilePicker = () => {
    if (importing || uploading) return;
    fileInputRef.current?.click();
  };

  const handleAudioPick = async (file: File) => {
    setUploadError(null);
    const validationError = validateCompositionFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setImporting(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const durationSec = await getAudioDurationSec(dataUrl);
      const baseTitle = file.name.replace(/\.[^.]+$/, '').trim();
      setPendingUpload({ dataUrl, durationSec, fileName: file.name });
      setUploadTitle(baseTitle);
      setUploadArtist((a) => a || defaultArtist);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('profile.compositions.uploadFailed'));
    } finally {
      setImporting(false);
    }
  };

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pendingUpload || uploading) return;
    setUploadError(null);
    setUploading(true);
    try {
      await api.createComposition(token, {
        title: uploadTitle.trim(),
        artist: uploadArtist.trim() || undefined,
        fileUrl: pendingUpload.dataUrl,
        durationSec: pendingUpload.durationSec,
      });
      resetUploadForm();
      await loadCompositions();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('profile.compositions.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = (item: UserCompositionItem) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.fileUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(null));
  };

  const requestDeleteComposition = (id: string) => {
    if (!token) return;
    setConfirmDeleteId(id);
  };

  const confirmDeleteComposition = async () => {
    if (!token || !confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeletingId(id);
    try {
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      await api.deleteComposition(token, id);
      await loadCompositions();
      setConfirmDeleteId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('profile.compositions.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <section className="p-4 max-w-lg mx-auto w-full space-y-3">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={importing || uploading}
          className="w-full py-3 rounded-xl border-2 border-dashed border-purple-500/40 bg-[#0b0b12] hover:border-purple-500/70 hover:bg-purple-950/20 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
        >
          {importing ? (
            <>
              <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-purple-300">{t('profile.compositions.importing')}</span>
            </>
          ) : (
            <>
              <span className="text-2xl text-purple-400" aria-hidden>
                ♪
              </span>
              <span className="text-sm font-bold text-purple-200">{t('profile.compositions.uploadCta')}</span>
              <span className="text-[10px] text-gray-500">{t('profile.compositions.uploadHint')}</span>
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,.mp3,.wav,.m4a,.ogg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleAudioPick(file);
          }}
        />

        {uploadError && !pendingUpload && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {uploadError}
          </p>
        )}

        {loading && <p className="text-xs text-gray-500 text-center py-8">{t('common.loading')}</p>}

        {!loading && compositions.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="text-3xl opacity-40" aria-hidden>
              🎵
            </p>
            <p className="text-sm text-gray-400">{t('profile.compositions.empty')}</p>
          </div>
        )}

        {!loading && compositions.length > 0 && (
          <ul className="space-y-2">
            {compositions.map((item) => {
              const date = new Date(item.createdAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const isPlaying = playingId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[#2d2d3d] bg-[#12121a] p-3"
                >
                  <button
                    type="button"
                    onClick={() => togglePlay(item)}
                    aria-label={isPlaying ? t('profile.compositions.pause') : t('profile.compositions.play')}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition ${
                      isPlaying
                        ? 'bg-purple-600 text-white'
                        : 'bg-[#1a1a26] border border-purple-500/40 text-purple-300 hover:bg-purple-950/40'
                    }`}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {[item.artist, formatDurationSec(item.durationSec), date].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestDeleteComposition(item.id)}
                    disabled={deletingId === item.id}
                    title={t('profile.compositions.delete')}
                    aria-label={t('profile.compositions.delete')}
                    className="shrink-0 w-9 h-9 rounded-full bg-black/50 border border-red-500/40 text-red-300 text-xs hover:bg-red-950/60 disabled:opacity-50"
                  >
                    {deletingId === item.id ? '…' : '🗑'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingUpload && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="composition-upload-title"
        >
          <form
            onSubmit={(e) => void submitUpload(e)}
            className="w-full max-w-sm rounded-2xl bg-[#12121a] border border-[#2d2d3d] p-4 space-y-3 shadow-xl"
          >
            <h4 id="composition-upload-title" className="text-sm font-bold text-white">
              {t('profile.compositions.uploadTitle')}
            </h4>
            <p className="text-[11px] text-gray-500 truncate">{pendingUpload.fileName}</p>
            {pendingUpload.durationSec != null && (
              <p className="text-[11px] text-purple-300">
                {t('profile.compositions.duration')}: {formatDurationSec(pendingUpload.durationSec)}
              </p>
            )}
            <label className="block">
              <span className="text-xs text-gray-400">{t('profile.compositions.fieldTitle')}</span>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                maxLength={120}
                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">{t('profile.compositions.fieldArtist')}</span>
              <input
                value={uploadArtist}
                onChange={(e) => setUploadArtist(e.target.value)}
                maxLength={120}
                placeholder={defaultArtist}
                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"
              />
            </label>
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
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadTitle.trim()}
                className="flex-[2] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm disabled:opacity-40"
              >
                {uploading ? t('profile.compositions.uploading') : t('profile.compositions.uploadSubmit')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Supprimer cette composition ?"
        description="Cette action est irréversible."
        loading={Boolean(deletingId && confirmDeleteId === deletingId)}
        loadingLabel="Suppression…"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => void confirmDeleteComposition()}
      />
    </>
  );
}
