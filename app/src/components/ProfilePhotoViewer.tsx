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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-sm p-2 sm:p-3"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse photos du profil"
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(85dvh,42rem)] w-full max-w-[min(calc(100vw-1rem),32rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl sm:max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-3 py-2 sm:px-4">
          {hasMultiple ? (
            <span className="text-sm font-medium tabular-nums text-gray-400">
              {index + 1} / {count}
            </span>
          ) : (
            <span className="w-12" aria-hidden />
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/15 text-2xl font-light text-white transition hover:bg-white/25 sm:h-10 sm:w-10"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {hasMultiple ? (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/70 sm:left-2 sm:h-10 sm:w-10"
              aria-label="Photo précédente"
            >
              ‹
            </button>
          ) : null}

          <img
            src={currentUrl}
            alt=""
            className="h-full w-full max-h-full max-w-full object-contain select-none"
            draggable={false}
          />

          {hasMultiple ? (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/70 sm:right-2 sm:h-10 sm:w-10"
              aria-label="Photo suivante"
            >
              ›
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-center px-4 py-1.5 sm:py-2">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[7rem] rounded-xl border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}
