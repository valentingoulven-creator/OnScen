import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FeedPostInteractions } from './FeedPostInteractions';
import { LinkifiedText } from './LinkifiedText';
import { UsernameDisplay } from './UsernameDisplay';
import { getFeedPostImageUrls } from '../lib/feedPostMedia';
import type { FeedPost } from '../types';

interface FeedPostDetailModalProps {
  open: boolean;
  post: FeedPost | null;
  initialImageIndex?: number;
  onClose: () => void;
  onOpenProfile?: (userId: string) => void;
}

function FeedPostImageGallery({
  urls,
  index,
  onIndexChange,
  label,
}: {
  urls: string[];
  index: number;
  onIndexChange: (next: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const safeIndex = Math.min(Math.max(0, index), urls.length - 1);

  if (urls.length === 0) return null;

  const goPrev = () => onIndexChange(safeIndex <= 0 ? urls.length - 1 : safeIndex - 1);
  const goNext = () => onIndexChange(safeIndex >= urls.length - 1 ? 0 : safeIndex + 1);

  return (
    <div className="relative bg-black/50">
      <img
        src={urls[safeIndex]}
        alt=""
        className="w-full max-h-[min(55dvh,24rem)] object-contain mx-auto"
      />
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 text-white border border-white/15 hover:bg-black/75 transition"
            aria-label={t('profile.galleryPrev', { defaultValue: 'Image précédente' })}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 text-white border border-white/15 hover:bg-black/75 transition"
            aria-label={t('profile.galleryNext', { defaultValue: 'Image suivante' })}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white/90 bg-black/55 px-2.5 py-1 rounded-full border border-white/10">
            {safeIndex + 1} / {urls.length}
          </p>
          <div className="flex justify-center gap-1.5 pb-2 pt-1">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onIndexChange(i)}
                className={`w-2 h-2 rounded-full transition ${
                  i === safeIndex ? 'bg-purple-400 scale-110' : 'bg-white/35 hover:bg-white/55'
                }`}
                aria-label={`${label} (${i + 1}/${urls.length})`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatWhen(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FeedPostDetailModal({
  open,
  post,
  initialImageIndex = 0,
  onClose,
  onOpenProfile,
}: FeedPostDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && post) {
      setActivePost(post);
      setImageIndex(initialImageIndex);
    }
    if (!open) setActivePost(null);
  }, [open, post, initialImageIndex]);

  const imageUrls = activePost ? getFeedPostImageUrls(activePost) : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const handlePostChange = useCallback((patch: Partial<FeedPost>) => {
    setActivePost((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  if (!open || !activePost) return null;

  const locale = i18n.language.startsWith('en') ? 'en-US' : 'fr-FR';

  const modal = (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={t('profile.publicationDetail', { defaultValue: 'Publication' })}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-[#12121a] border border-[#1e1e2f] sm:border-[#2a2a36] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-gray-200 hover:text-white hover:bg-black/70 border border-white/10 backdrop-blur-sm transition shrink-0"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <FeedPostInteractions
              post={activePost}
              token={token}
              onPostChange={handlePostChange}
              onToast={showToast}
              inlineToolbar
            >
              {({ toolbar, comments }) => (
                <div className="space-y-3 pb-3">
                  <div className="px-4 pt-4 pr-14 space-y-2">
                    <button
                      type="button"
                      onClick={() => onOpenProfile?.(activePost.author.id)}
                      className="flex items-center gap-2 text-left min-h-[44px] -ml-1 px-1 rounded-lg hover:bg-white/5 transition"
                    >
                      {activePost.author.avatarUrl ? (
                        <img
                          src={activePost.author.avatarUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#1e1e2f] flex items-center justify-center text-sm">
                          👤
                        </div>
                      )}
                      <div className="min-w-0">
                        <UsernameDisplay
                          username={activePost.author.username}
                          usernameColor={activePost.author.usernameColor}
                          usernameWaveFrom={activePost.author.usernameWaveFrom}
                          usernameWaveTo={activePost.author.usernameWaveTo}
                          className="text-sm font-semibold truncate block"
                        />
                        <p className="text-[11px] text-gray-500">{formatWhen(activePost.createdAt, locale)}</p>
                      </div>
                    </button>
                    {toolbar ? <div className="pt-1">{toolbar}</div> : null}
                  </div>

                  {imageUrls.length > 0 ? (
                    <FeedPostImageGallery
                      urls={imageUrls}
                      index={imageIndex}
                      onIndexChange={setImageIndex}
                      label={t('profile.publicationDetail', { defaultValue: 'Publication' })}
                    />
                  ) : null}

                  {activePost.videoUrl ? (
                    <video
                      src={activePost.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-[min(55dvh,24rem)] bg-black"
                    />
                  ) : null}

                  {activePost.content?.trim() ? (
                    <div className="px-4">
                      <LinkifiedText
                        text={activePost.content.trim()}
                        className="text-sm text-gray-100 whitespace-pre-wrap break-words"
                        onOpenProfile={onOpenProfile}
                      />
                    </div>
                  ) : null}

                  {comments ? <div className="px-4">{comments}</div> : null}
                </div>
              )}
            </FeedPostInteractions>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[121] pointer-events-none">
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );

  return createPortal(modal, document.body);
}
