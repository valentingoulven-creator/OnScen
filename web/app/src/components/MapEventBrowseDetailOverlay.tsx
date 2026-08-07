import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { EventCard } from './EventCard';
import { FeedPostInteractions } from './FeedPostInteractions';
import { useAuth } from '../context/AuthContext';
import { resolveEventCoordsSync } from '../lib/mapEventCoords';
import type { FeedPost } from '../types';

function MapViewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A2 2 0 014 15.382V5.618a2 2 0 011.553-1.947L9 2l6 3 5.447-2.724A2 2 0 0120 4.618v9.764a2 2 0 01-1.553 1.947L13 18l-4-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v18M15 5v13" />
    </svg>
  );
}

export function MapEventBrowseDetailOverlay({
  post,
  variant = 'overlay',
  onClose,
  onViewOnMap,
  onOpenInFeed,
  onPostChange,
}: {
  post: FeedPost;
  /** overlay = modal plein écran ; sidebar = panneau bas de la sidebar (liste browse visible). */
  variant?: 'overlay' | 'sidebar';
  onClose: () => void;
  onViewOnMap?: (post: FeedPost) => void;
  onOpenInFeed?: (postId: string) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [activePost, setActivePost] = useState(post);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSidebar = variant === 'sidebar';

  useEffect(() => {
    setActivePost(post);
  }, [post]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const handlePostChange = useCallback(
    (patch: Partial<FeedPost>) => {
      setActivePost((prev) => {
        const next = { ...prev, ...patch };
        onPostChange?.(prev.id, patch);
        return next;
      });
    },
    [onPostChange]
  );

  const locationCoords = useMemo(() => {
    const location = activePost.eventLocation?.trim();
    if (!location) return null;
    return resolveEventCoordsSync(location);
  }, [activePost.eventLocation]);

  const hasMapFooterActions = Boolean(onViewOnMap || onOpenInFeed);

  const detailBody = (
    <>
      <div
        className={`relative flex flex-col overflow-hidden bg-[#12121a] ${
          isSidebar
            ? 'border-t border-[var(--ms-border)] max-h-[min(42dvh,16rem)]'
            : 'w-full max-w-md max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))] rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-2 right-2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-gray-200 hover:text-white hover:bg-black/70 border border-white/10 backdrop-blur-sm transition shrink-0 ${
            isSidebar ? 'top-1.5 right-1.5 w-9 h-9' : ''
          }`}
          aria-label={t('common.close')}
        >
          ✕
        </button>

        <FeedPostInteractions
          post={activePost}
          token={token}
          onPostChange={handlePostChange}
          onToast={showToast}
          inlineToolbar={hasMapFooterActions}
        >
          {({ toolbar, comments }) => (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pb-2">
                <EventCard
                  post={activePost}
                  layout="vertical"
                  compact={isSidebar}
                  embedded
                  locationNavigable
                  locationCoords={locationCoords}
                  profileActions={hasMapFooterActions ? toolbar : undefined}
                  onOpen={() => {}}
                  onPostChange={handlePostChange}
                />
                {comments ? <div className={`px-3 ${isSidebar ? 'text-sm' : ''}`}>{comments}</div> : null}
              </div>

              <div
                className={`shrink-0 border-t border-white/10 bg-[#0e0e14]/95 ${
                  isSidebar
                    ? 'px-2 py-2'
                    : 'px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
                }`}
              >
                {hasMapFooterActions ? (
                  <div className="flex gap-2 w-full min-w-0">
                    {onViewOnMap ? (
                      <button
                        type="button"
                        onClick={() => onViewOnMap(activePost)}
                        className="flex-1 min-h-[44px] px-2 py-2 rounded-xl text-xs sm:text-sm font-semibold text-purple-100 bg-purple-600 hover:bg-purple-500 transition flex items-center justify-center gap-1.5"
                      >
                        <MapViewIcon className="w-3.5 h-3.5 shrink-0" />
                        {t('map.eventsBrowseViewOnMap')}
                      </button>
                    ) : null}
                    {onOpenInFeed ? (
                      <button
                        type="button"
                        onClick={() => onOpenInFeed(activePost.id)}
                        className="flex-1 min-h-[44px] px-2 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-200 border border-[#2d2d3d] bg-[#1a1a26] hover:bg-[#22222f] transition"
                      >
                        {t('map.eventModalOpenInFeed')}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center justify-around gap-1 w-full min-h-[44px]">{toolbar}</div>
                )}
              </div>
            </div>
          )}
        </FeedPostInteractions>
      </div>

      {toast ? (
        <div
          className={
            isSidebar
              ? 'px-2 pb-2 pointer-events-none'
              : 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] pointer-events-none'
          }
        >
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );

  if (isSidebar) {
    return (
      <div className="shrink-0 min-h-0" role="region" aria-label={t('feed.eventDetails')}>
        {detailBody}
      </div>
    );
  }

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('feed.eventDetails')}
      onClick={onClose}
    >
      {detailBody}
    </div>
  );

  return createPortal(modal, document.body);
}
