import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MapEventBrowseDetailOverlay } from './MapEventBrowseDetailOverlay';
import { MapEventFilterForm } from './MapEventFilterForm';
import { MapEventsBrowseList } from './MapEventsBrowseList';
import { useMapEventsBrowseData } from '../hooks/useMapEventsBrowseData';
import type { MapEventFilterCriteria } from '../lib/mapEventFilter';
import type { FeedPost } from '../types';

export interface MapEventsBrowseSheetProps {
  open: boolean;
  onClose: () => void;
  token: string;
  profileCity?: string;
  favoriteAuthorIds?: ReadonlySet<string>;
  eventsFilterOn: boolean;
  filterCriteria: MapEventFilterCriteria;
  eventFilterCustomized?: boolean;
  aroundEventPosts?: FeedPost[];
  viewerId?: string;
  onApplyFilter?: (criteria: MapEventFilterCriteria) => void;
  onPreviewFilterCity?: (latitude: number, longitude: number, location: string) => void;
  /** Cadre la carte sur les événements de l'onglet actif. */
  onViewOnMap?: (posts: FeedPost[]) => void;
  onOpenEvent?: (post: FeedPost) => void;
  onOpenEventDetail?: (post: FeedPost) => void;
  onOpenInFeed?: (postId: string) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
  selectedMapEventDayKey?: string | null;
  onMapEventDayKeySelect?: (dayKey: string) => void;
  sponsoredEventPosts?: FeedPost[];
}

function MapViewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A2 2 0 014 15.382V5.618a2 2 0 011.553-1.947L9 2l6 3 5.447-2.724A2 2 0 0120 4.618v9.764a2 2 0 01-1.553 1.947L13 18l-4-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v18M15 5v13" />
    </svg>
  );
}

export function MapEventsBrowseSheet({
  open,
  onClose,
  token,
  profileCity,
  favoriteAuthorIds,
  eventsFilterOn,
  filterCriteria,
  eventFilterCustomized = false,
  aroundEventPosts,
  viewerId,
  onApplyFilter,
  onPreviewFilterCity,
  onViewOnMap,
  onOpenEvent,
  onOpenEventDetail,
  onOpenInFeed,
  onPostChange,
  selectedMapEventDayKey,
  onMapEventDayKeySelect,
  sponsoredEventPosts = [],
}: MapEventsBrowseSheetProps) {
  const { t } = useTranslation();
  const [detailPost, setDetailPost] = useState<FeedPost | null>(null);

  const browse = useMapEventsBrowseData({
    enabled: open && Boolean(token),
    token,
    profileCity,
    favoriteAuthorIds,
    eventsFilterOn,
    filterCriteria,
    eventFilterCustomized,
    aroundEventPosts,
    viewerId,
    onPostChange,
  });

  useEffect(() => {
    if (!open) setDetailPost(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailPost) setDetailPost(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, detailPost, onClose]);

  const handleViewOnMap = useCallback(() => {
    if (browse.activePosts.length === 0 || browse.activeLoading) return;
    onViewOnMap?.(browse.activePosts);
    onClose();
  }, [browse.activePosts, browse.activeLoading, onViewOnMap, onClose]);

  const handleOpenPost = useCallback(
    (post: FeedPost) => {
      if (onOpenEventDetail) {
        onOpenEventDetail(post);
        return;
      }
      setDetailPost(post);
    },
    [onOpenEventDetail]
  );

  const handleDetailViewOnMap = useCallback(
    (post: FeedPost) => {
      setDetailPost(null);
      onClose();
      onOpenEvent?.(post);
    },
    [onClose, onOpenEvent]
  );

  const handleApplyFilter = useCallback(
    (criteria: MapEventFilterCriteria) => {
      onApplyFilter?.(criteria);
    },
    [onApplyFilter]
  );

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-events-browse-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-0.5rem))] sm:max-h-[min(36rem,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem))] flex flex-col bg-[#0e0e14] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 flex flex-col min-w-0">
          <div className="px-4 py-3 flex flex-col gap-2 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 id="map-events-browse-title" className="text-base font-bold text-white">
                  {t('map.eventsBrowseTitle')}
                </h2>
                <p className="text-[11px] text-purple-300/70 mt-0.5">{t('map.eventsBrowseHint')}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition touch-manipulation shrink-0"
                aria-label={t('common.close')}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 w-full">
              {onApplyFilter ? (
                <MapEventFilterForm
                  active
                  layout="inline"
                  initialCriteria={filterCriteria}
                  profileCity={profileCity}
                  onApply={handleApplyFilter}
                  onPreviewCity={onPreviewFilterCity}
                  idPrefix="map-events-browse-filter"
                  className="flex-1 min-w-0"
                />
              ) : null}
              <button
                type="button"
                onClick={handleViewOnMap}
                disabled={browse.activeLoading || browse.activePosts.length === 0}
                className="inline-flex shrink-0 items-center gap-1.5 min-h-9 px-2.5 rounded-lg text-[11px] font-semibold text-purple-200 border border-purple-500/35 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:pointer-events-none transition touch-manipulation ml-auto"
              >
                <MapViewIcon className="w-3.5 h-3.5 shrink-0" />
                {t('map.eventsBrowseViewOnMap')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
          <MapEventsBrowseList
            variant="sheet"
            activeTab={browse.activeTab}
            onTabChange={browse.setActiveTab}
            communityEvents={browse.communityEvents}
            countryUpcoming={browse.countryUpcoming}
            communityEventsVisibleCount={browse.communityEventsVisibleCount}
            countryEventsVisibleCount={browse.countryEventsVisibleCount}
            activeLoading={browse.activeLoading}
            eventsByDay={browse.eventsByDay}
            countryEventsByCategory={browse.countryEventsByCategory}
            sectionEmoji={browse.sectionEmoji}
            displayCountryName={browse.displayCountryName}
            countrySectionEmoji={browse.countrySectionEmoji}
            onOpenPost={handleOpenPost}
            onPostChange={browse.handlePostChange}
            selectedMapEventDayKey={selectedMapEventDayKey}
            onMapEventDayKeySelect={onMapEventDayKeySelect}
            sponsoredEventPosts={sponsoredEventPosts}
          />
        </div>
      </div>

      {detailPost ? (
        <MapEventBrowseDetailOverlay
          post={detailPost}
          variant="overlay"
          onClose={() => setDetailPost(null)}
          onViewOnMap={onOpenEvent ? handleDetailViewOnMap : undefined}
          onOpenInFeed={
            onOpenInFeed
              ? (postId) => {
                  setDetailPost(null);
                  onOpenInFeed(postId);
                }
              : undefined
          }
          onPostChange={browse.handlePostChange}
        />
      ) : null}
    </div>,
    document.body
  );
}
