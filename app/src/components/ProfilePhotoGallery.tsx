import { useEffect, useRef, useState } from 'react';
import {
  ACCEPTED_IMAGE_FORMATS,
  SUPPORTED_IMAGE_FORMATS_LABEL,
  validateProfilePhoto,
} from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import { PhotoImageEditor } from './PhotoImageEditor';

const MAX_PHOTOS = 5;
const GALLERY_SLOTS = MAX_PHOTOS - 1;

interface ProfilePhotoGalleryProps {
  photos: string[];
  fallbackSeed: string;
  editing?: boolean;
  onChange?: (photos: string[]) => void;
}

function PhotoActionBar({
  showMain,
  onSetMain,
  onRemove,
}: {
  showMain?: boolean;
  onSetMain?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="absolute bottom-0 inset-x-0 flex gap-1 p-1 bg-black/75 backdrop-blur-sm">
      {showMain && onSetMain ? (
        <button
          type="button"
          onClick={onSetMain}
          className="flex-1 min-h-[28px] text-[9px] sm:text-[10px] py-1 rounded-md bg-purple-600/90 text-white font-semibold"
        >
          Principale
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="min-w-[28px] min-h-[28px] px-1.5 text-sm rounded-md bg-red-600/90 text-white font-bold"
        aria-label="Supprimer la photo"
      >
        ×
      </button>
    </div>
  );
}

export function ProfilePhotoGallery({
  photos,
  fallbackSeed: _fallbackSeed,
  editing,
  onChange,
}: ProfilePhotoGalleryProps) {
  const [_activeIndex, setActiveIndex] = useState(0);
  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editorFile) {
      setEditorPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editorFile);
    setEditorPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editorFile]);

  const avatarUrl = photos[0];
  const galleryPhotos = photos.slice(1);

  const openGalleryPicker = () => {
    if (photos.length >= MAX_PHOTOS || !onChange || isPreparingFile) return;
    fileInputRef.current?.click();
  };

  const handleGalleryFile = async (file: File | undefined) => {
    if (!file || !onChange) return;
    if (photos.length >= MAX_PHOTOS) {
      alert(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    const validation = validateProfilePhoto(file);
    if (!validation.valid) {
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

  const onEditorConfirm = (dataUrl: string) => {
    if (!onChange) return;
    onChange([...photos, dataUrl]);
    setActiveIndex(photos.length);
    setEditorFile(null);
  };

  const onEditorCancel = () => {
    setEditorFile(null);
  };

  const removePhoto = (index: number) => {
    if (!onChange) return;
    if (!window.confirm('Supprimer cette photo ?')) return;
    const next = photos.filter((_, i) => i !== index);
    onChange(next);
    setActiveIndex(Math.max(0, Math.min(index, next.length - 1)));
  };

  const setAsMain = (index: number) => {
    if (!onChange || index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
    setActiveIndex(0);
  };

  if (editing) {
    const canAdd = photos.length < MAX_PHOTOS;
    const busy = Boolean(editorFile) || isPreparingFile;

    return (
      <>
        {editorFile && editorPreviewUrl ? (
          <PhotoImageEditor
            mode="profile"
            initialImage={editorPreviewUrl}
            initialSource={editorFile}
            onConfirm={(result) => onEditorConfirm(result.imageUrl)}
            onCancel={onEditorCancel}
          />
        ) : null}
        <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide">
              Photos du profil
            </h3>
            <span className="text-[11px] text-gray-500 font-medium">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>

          {/* Avatar principal — cercle large, centré */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-purple-400/70 uppercase tracking-wider">
              Avatar principal
            </span>
            {avatarUrl ? (
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-900/30 bg-[#1a1a26]">
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow">
                  Avatar
                </span>
                <PhotoActionBar onRemove={() => removePhoto(0)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={openGalleryPicker}
                disabled={busy}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-dashed border-purple-500/40 bg-[#1a1a26] flex flex-col items-center justify-center gap-1.5 text-purple-300/70 hover:border-purple-400 hover:text-purple-300 hover:bg-purple-950/20 transition disabled:opacity-50"
                aria-label="Ajouter l'avatar"
              >
                <span className="text-2xl leading-none">{busy ? '…' : '📷'}</span>
                <span className="text-[10px] font-semibold">Ajouter avatar</span>
              </button>
            )}
          </div>

          {/* Galerie — 4 emplacements carrés pleine largeur */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Galerie · {galleryPhotos.length}/{GALLERY_SLOTS}
            </span>
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 w-full">
              {galleryPhotos.map((url, i) => {
                const photoIndex = i + 1;
                return (
                  <div
                    key={`${url}-${photoIndex}`}
                    className="relative aspect-square min-h-[72px] sm:min-h-[80px] rounded-xl overflow-hidden border border-[#2d2d3d] bg-[#1a1a26]"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <PhotoActionBar
                      showMain
                      onSetMain={() => setAsMain(photoIndex)}
                      onRemove={() => removePhoto(photoIndex)}
                    />
                  </div>
                );
              })}
              {canAdd ? (
                <button
                  type="button"
                  onClick={openGalleryPicker}
                  disabled={busy}
                  className="aspect-square min-h-[72px] sm:min-h-[80px] rounded-xl border border-dashed border-[#2d2d3d] bg-[#1a1a26] flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-purple-500/50 hover:text-purple-400 hover:bg-purple-950/10 transition disabled:opacity-50"
                  aria-label="Choisir depuis la galerie"
                >
                  <span className="text-xl leading-none">{busy ? '…' : '🖼️'}</span>
                  <span className="text-[9px] sm:text-[10px] font-semibold px-1 text-center leading-tight">
                    Galerie
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_FORMATS}
            className="hidden"
            onChange={(e) => void handleGalleryFile(e.target.files?.[0])}
          />

          {canAdd ? (
            <>
              <button
                type="button"
                onClick={openGalleryPicker}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/15 border border-purple-500/35 text-purple-200 text-xs font-bold hover:bg-purple-600/25 disabled:opacity-50 transition"
              >
                <span aria-hidden>🖼️</span>
                {isPreparingFile
                  ? 'Conversion HEIC en cours…'
                  : editorFile
                    ? 'Modifiez votre photo…'
                    : 'Ajouter une photo (galerie)'}
              </button>
              {validationError ? (
                <p className="text-[11px] text-red-400 text-center leading-snug">{validationError}</p>
              ) : (
                <p className="text-[11px] text-gray-500 text-center leading-snug">
                  {SUPPORTED_IMAGE_FORMATS_LABEL} · compression auto · min 320 px · max 1080 px ·
                  rognage et filtres
                </p>
              )}
            </>
          ) : null}
        </div>
      </>
    );
  }

  if (photos.length === 0) return null;

  const gridCols = photos.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide">
          Photos du profil
        </h3>
        <span className="text-[11px] text-gray-500 font-medium">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>
      <div className={`grid ${gridCols} gap-1.5 sm:gap-2`}>
        {photos.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-square overflow-hidden rounded-xl bg-[#1a1a26] border border-[#2d2d3d]"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            {i === 0 ? (
              <span className="absolute top-1.5 left-1.5 text-[9px] bg-purple-600/90 text-white px-1.5 py-0.5 rounded-full font-bold">
                Avatar
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {photos.length > 1 ? (
        <p className="text-center text-[11px] text-gray-500">
          {photos.length} photos · la première est l&apos;avatar
        </p>
      ) : null}
    </section>
  );
}
