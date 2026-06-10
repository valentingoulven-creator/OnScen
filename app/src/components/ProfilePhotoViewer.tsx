import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isDisplayableProfilePhotoUrl } from '../lib/profilePhotos';

export function getViewableProfilePhotos(photos: string[]): string[] {
  return photos.filter(isDisplayableProfilePhotoUrl);
}

interface ProfilePhotoViewerProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

export function ProfilePhotoViewer({ photos, initialIndex, onClose }: ProfilePhotoViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const count = photos.length;
  const hasMultiple = count > 1;
  const currentUrl = photos[index];

  useEffect(() => {
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, count - 1))));
  }, [initialIndex, count]);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i - 1 + count) % count);
  }, [count, hasMultiple]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((i) => (i + 1) % count);
  }, [count, hasMultiple]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, onClose]);

  if (!currentUrl) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse photos du profil"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-3 pb-3 sm:px-4 shrink-0"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasMultiple ? (
          <span className="text-sm text-gray-400 tabular-nums font-medium">
            {index + 1} / {count}
          </span>
        ) : (
          <span className="w-12" aria-hidden />
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/15 text-white text-2xl font-light hover:bg-white/25 transition border border-white/20"
          aria-label="Fermer"
        >
          ×
        </button>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center min-h-0 px-2 sm:px-12"
        onClick={(e) => e.stopPropagation()}
      >
        {hasMultiple ? (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-1 sm:left-3 z-10 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/50 text-white text-2xl hover:bg-black/70 transition"
            aria-label="Photo précédente"
          >
            ‹
          </button>
        ) : null}

        <img
          src={currentUrl}
          alt=""
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />

        {hasMultiple ? (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-1 sm:right-3 z-10 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/50 text-white text-2xl hover:bg-black/70 transition"
            aria-label="Photo suivante"
          >
            ›
          </button>
        ) : null}
      </div>

      <div
        className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 flex justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="min-w-[8rem] px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 transition"
        >
          Fermer
        </button>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
