import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapEventPreviewCard } from './MapEventPreviewCard';
import { feedPostFromMapEventMarker } from '../lib/mapFeedEvents';
import { getFeedEventDisplayTitle } from '../lib/feedEvents';
import type { FeedPost, MapEventMarker } from '../types';

interface MapEventMapInfoPanelProps {
  marker: MapEventMarker;
  post?: FeedPost | null;
  savedEventPostIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpenDetail: () => void;
  onOpenAuthor?: (userId: string) => void;
  onPostUpdated?: (postId: string, patch: Partial<FeedPost>) => void;
}

/** Fiche aperçu événement ancrée sur la carte (mobile : bottom sheet, desktop : coin haut-gauche). */
export function MapEventMapInfoPanel({
  marker,
  post,
  savedEventPostIds,
  onClose,
  onOpenDetail,
  onOpenAuthor,
  onPostUpdated,
}: MapEventMapInfoPanelProps) {
  const { t } = useTranslation();
  const [activePost, setActivePost] = useState<FeedPost | null>(null);

  useEffect(() => {
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
          upvoteCount: prev.upvoteCount ?? base.upvoteCount,
          upvotedByMe: prev.upvotedByMe ?? base.upvotedByMe,
        };
      }
      return base;
    });
  }, [marker, post, savedEventPostIds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const locationCoords = useMemo(
    () => ({ latitude: marker.latitude, longitude: marker.longitude }),
    [marker.latitude, marker.longitude]
  );

  const previewTitle =
    getFeedEventDisplayTitle(activePost?.content ?? '') || t('feed.eventTypeAutre');

  if (!activePost) return null;

  return (
    <div
      className="absolute inset-x-3 bottom-[max(4.25rem,calc(0.75rem+env(safe-area-inset-bottom)))] z-[35] pointer-events-auto w-[min(calc(100%-1.5rem),20rem)] max-w-md mx-auto sm:inset-x-auto sm:bottom-auto sm:top-3 sm:left-3 sm:right-auto sm:mx-0 sm:w-full sm:max-w-[17.5rem]"
      role="region"
      aria-label={t('map.eventPreviewAria', {
        title: previewTitle,
        defaultValue: `Aperçu de l'événement ${previewTitle}`,
      })}
    >
      <div className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-purple-500/45 bg-[#12121a] shadow-[0_0_22px_rgba(168,85,247,0.18)]">
        <MapEventPreviewCard
          post={activePost}
          locationCoords={locationCoords}
          onClose={onClose}
          onOpenDetail={onOpenDetail}
          onOpenAuthor={onOpenAuthor}
          onPostChange={handlePostChange}
        />
      </div>
    </div>
  );
}
