import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { EventCard } from './EventCard';
import { FeedPostInteractions } from './FeedPostInteractions';
import { feedPostFromMapEventMarker } from '../lib/mapFeedEvents';
import type { FeedPost, MapEventMarker } from '../types';

interface MapEventDetailModalProps {
  open: boolean;
  marker: MapEventMarker | null;
  post?: FeedPost | null;
  savedEventPostIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpenAuthor?: (userId: string) => void;
  onPostUpdated?: (postId: string, patch: Partial<FeedPost>) => void;
}

export function MapEventDetailModal({
  open,
  marker,
  post,
  savedEventPostIds,
  onClose,
  onOpenAuthor,
  onPostUpdated,
}: MapEventDetailModalProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !marker) {
      setActivePost(null);
      return;
    }
    const markerId = marker.id;
    setActivePost((prev) => {
      const base = feedPostFromMapEventMarker(marker, post, savedEventPostIds);
      if (prev?.id === markerId) {
        return {
          ...base,
          likedByMe: prev.likedByMe,
          likeCount: prev.likeCount,
          commentCount: prev.commentCount,
          favoriteByMe: base.favoriteByMe,
          recentComments:
            prev.recentComments.length >= base.recentComments.length
              ? prev.recentComments
              : base.recentComments,
        };
      }
      return base;
    });
  }, [open, marker, post, savedEventPostIds]);

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

  const handlePostChange = useCallback(
    (patch: Partial<FeedPost>) => {
      setActivePost((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        onPostUpdated?.(prev.id, patch);
        return next;
      });
    },
    [onPostUpdated]
  );

  if (!open || !marker || !activePost) return null;

  const modal = (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={t('feed.eventDetails')}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-[#12121a] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
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

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pb-2 space-y-3">
            <FeedPostInteractions
              post={activePost}
              token={token}
              onPostChange={handlePostChange}
              onToast={showToast}
              inlineToolbar
            >
              {({ toolbar, comments }) => (
                <>
                  <EventCard
                    post={activePost}
                    compact={false}
                    embedded
                    locationNavigable
                    locationCoords={
                      marker
                        ? { latitude: marker.latitude, longitude: marker.longitude }
                        : null
                    }
                    profileActions={toolbar}
                    onOpen={() => {}}
                    onOpenAuthor={(p) => {
                      if (p.author.id) {
                        onOpenAuthor?.(p.author.id);
                        onClose();
                      }
                    }}
                    onOpenTaggedUser={(userId) => {
                      onOpenAuthor?.(userId);
                      onClose();
                    }}
                    onPostChange={(patch) => handlePostChange(patch)}
                  />
                  {activePost.videoUrl ? (
                    <video
                      src={activePost.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="mx-3 w-[calc(100%-1.5rem)] rounded-xl max-h-80 bg-[#1e1e2f]"
                    />
                  ) : null}
                  {comments ? <div className="px-3">{comments}</div> : null}
                </>
              )}
            </FeedPostInteractions>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] pointer-events-none">
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );

  return createPortal(modal, document.body);
}
