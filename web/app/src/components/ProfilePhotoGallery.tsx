import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ACCEPTED_IMAGE_FORMATS,
  SUPPORTED_IMAGE_FORMATS_LABEL,
  isHeicImageFileAsync,
  validateProfilePhoto,
} from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import {
  ensurePersistableProfilePhotoUrl,
  isDisplayableProfilePhotoUrl,
  toSingleProfilePhotoSlots,
} from '../lib/profilePhotos';
import { ConfirmModal } from './ConfirmModal';

const PhotoImageEditor = lazy(() =>
  import('./PhotoImageEditor').then((m) => ({ default: m.PhotoImageEditor }))
);

interface ProfilePhotoGalleryProps {
  photos: string[];
  fallbackSeed: string;
  editing?: boolean;
  onChange?: (photos: string[]) => void;
  /** True while file prep or editor overlay is open — block profile save. */
  onBusyChange?: (busy: boolean) => void;
  /** card = encadré ; bare = sans boîte (lecture) */
  variant?: 'card' | 'bare';
  /** Édition : aperçu réduit inline (formulaire profil compact) */
  compact?: boolean;
  /** En lecture : ouvre la visionneuse (index 0 = photo principale). */
  onPhotoClick?: (index: number) => void;
}

function ProfilePhotoImage({
  url,
  className,
  priority = false,
}: {
  url: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const displayable = isDisplayableProfilePhotoUrl(url) && !failed;

  if (!displayable) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1a1a26] text-gray-600 ${className ?? ''}`}
        aria-hidden
      >
        <span className="text-xl sm:text-2xl opacity-50">🖼️</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ProfilePhotoGallery({
  photos,
  fallbackSeed: _fallbackSeed,
  editing,
  onChange,
  onBusyChange,
  variant = 'card',
  compact = false,
  onPhotoClick,
}: ProfilePhotoGalleryProps) {
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const singlePhotos = toSingleProfilePhotoSlots(photos);
  const profilePhotoUrl = singlePhotos[0] ?? '';

  useEffect(() => {
    if (!editorFile) {
      setEditorPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editorFile);
    setEditorPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editorFile]);

  useEffect(() => {
    if (!onBusyChange) return;
    if (!editing) {
      onBusyChange(false);
      return;
    }
    onBusyChange(Boolean(editorFile) || isPreparingFile);
  }, [editing, editorFile, isPreparingFile, onBusyChange]);

  const openPicker = () => {
    if (!onChange || isPreparingFile) return;
    fileInputRef.current?.click();
  };

  const handleGalleryFile = async (file: File | undefined) => {
    if (!file || !onChange) return;
    const validation = validateProfilePhoto(file);
    if (!validation.valid && !(await isHeicImageFileAsync(file))) {
      setValidationError(validation.error ?? 'Fichier non valide.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setValidationError(null);
    setIsPreparingFile(true);
    try {
      const prepared = await prepareImageFile(file);
      setEditorFile(prepared);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Impossible de préparer cette image.'
      );
    } finally {
      setIsPreparingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onEditorConfirm = async (dataUrl: string) => {
    if (!onChange) return;
    const persisted = await ensurePersistableProfilePhotoUrl(dataUrl);
    if (!persisted) {
      setValidationError('Impossible d\'enregistrer cette photo.');
      setEditorFile(null);
      return;
    }
    onChange([persisted]);
    setEditorFile(null);
  };

  const onEditorCancel = () => {
    setEditorFile(null);
  };

  const confirmRemovePhoto = () => {
    if (!onChange) return;
    onChange([]);
    setDeleteConfirmOpen(false);
  };

  if (editing) {
    const busy = Boolean(editorFile) || isPreparingFile;
    const showingEditorPreview = Boolean(editorFile && editorPreviewUrl);

    const editorOverlay =
      editorFile && editorPreviewUrl ? (
        <Suspense fallback={null}>
          <PhotoImageEditor
            mode="profile"
            initialImage={editorPreviewUrl}
            initialSource={editorFile}
            onConfirm={(result) => void onEditorConfirm(result.imageUrl)}
            onCancel={onEditorCancel}
          />
        </Suspense>
      ) : null;

    const photoSizeClass = compact ? 'w-[4.25rem] h-[4.25rem]' : 'w-24 h-24 sm:w-28 sm:h-28';
    const deleteBtnClass = compact
      ? 'absolute top-0 right-0 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 text-white text-sm font-bold leading-none hover:bg-red-600/90 transition'
      : 'absolute top-0 right-0 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/70 text-white text-base font-bold leading-none hover:bg-red-600/90 transition';

    const photoCircle = profilePhotoUrl ? (
      <div
        className={`relative ${photoSizeClass} rounded-full overflow-hidden border border-[#2d2d3d] bg-[#1a1a26] shrink-0`}
      >
        <ProfilePhotoImage url={profilePhotoUrl} className="w-full h-full object-cover" priority />
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          className={deleteBtnClass}
          aria-label="Supprimer la photo de profil"
        >
          ×
        </button>
      </div>
    ) : showingEditorPreview ? (
      <div
        className={`relative ${photoSizeClass} rounded-full overflow-hidden border border-purple-500/40 bg-[#1a1a26] shrink-0`}
      >
        <img src={editorPreviewUrl!} alt="" className="w-full h-full object-cover opacity-90" />
        {!compact && (
          <span className="absolute inset-x-0 bottom-2 text-center text-[9px] text-purple-200/90 font-medium">
            Aperçu…
          </span>
        )}
      </div>
    ) : (
      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        className={`${photoSizeClass} rounded-full border border-dashed border-[#2d2d3d] bg-[#1a1a26]/80 flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:border-purple-500/40 hover:text-purple-300/80 transition disabled:opacity-50 shrink-0`}
        aria-label="Ajouter une photo de profil"
      >
        <span className={`leading-none ${compact ? 'text-base' : 'text-xl'}`}>{busy ? '…' : '📷'}</span>
        {!compact && <span className="text-[10px] font-medium">Ajouter</span>}
      </button>
    );

    return (
      <>
        {typeof document !== 'undefined' && editorOverlay
          ? createPortal(editorOverlay, document.body)
          : editorOverlay}
        <div
          className={
            compact
              ? 'shrink-0'
              : 'rounded-xl border border-[#1e1e2f]/80 bg-[#12121a]/60 p-3 sm:p-4 space-y-3 w-full'
          }
        >
          {!compact && (
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">
              Photo de profil
            </h3>
          )}

          {compact ? (
            <div className="flex flex-col items-center gap-1.5">
              {photoCircle}
              {profilePhotoUrl && !showingEditorPreview ? (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={busy}
                  className="min-h-[28px] px-2 rounded-md text-[10px] font-semibold text-purple-200/90 bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 transition disabled:opacity-50"
                >
                  {busy ? '…' : 'Changer'}
                </button>
              ) : !profilePhotoUrl && !showingEditorPreview ? (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={busy}
                  className="min-h-[28px] px-2 rounded-md text-[10px] font-semibold text-purple-200/90 bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 transition disabled:opacity-50"
                >
                  {busy ? '…' : 'Ajouter'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {photoCircle}
              {profilePhotoUrl && !showingEditorPreview ? (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={busy}
                  className="text-xs font-medium text-purple-300/90 hover:text-purple-200 transition disabled:opacity-50"
                >
                  {busy ? 'Préparation…' : 'Changer la photo'}
                </button>
              ) : null}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_FORMATS}
            className="hidden"
            onChange={(e) => void handleGalleryFile(e.target.files?.[0])}
          />

          {!compact &&
            (validationError ? (
              <p className="text-[11px] text-red-400 text-center leading-snug">{validationError}</p>
            ) : (
              <p className="text-[10px] text-gray-600 text-center leading-snug">
                {SUPPORTED_IMAGE_FORMATS_LABEL} · min 320 px · max 1080 px · rognage et filtres
              </p>
            ))}
          {compact && validationError ? (
            <p className="text-[9px] text-red-400 text-center leading-snug mt-0.5 max-w-[4.5rem]">
              {validationError}
            </p>
          ) : null}
        </div>

        <ConfirmModal
          open={deleteConfirmOpen}
          title="Supprimer cette photo ?"
          description="Cette action est définitive après enregistrement."
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmRemovePhoto}
        />
      </>
    );
  }

  const displayPhoto = singlePhotos.find((url) => isDisplayableProfilePhotoUrl(url));
  if (!displayPhoto) return null;

  const cell = (
    <ProfilePhotoImage url={displayPhoto} className="w-full h-full object-cover" />
  );

  const photoNode = onPhotoClick ? (
    <button
      type="button"
      onClick={() => onPhotoClick(0)}
      className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#1a1a26] cursor-pointer hover:opacity-90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      aria-label="Voir la photo de profil"
    >
      {cell}
    </button>
  ) : (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#1a1a26]">
      {cell}
    </div>
  );

  if (variant === 'bare') {
    return <section className="w-full overflow-hidden rounded-xl">{photoNode}</section>;
  }

  return (
    <section className="rounded-xl border border-[#1e1e2f]/80 bg-[#12121a]/60 p-3 max-w-xs mx-auto w-full space-y-2">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
        Photo de profil
      </h3>
      {photoNode}
    </section>
  );
}
