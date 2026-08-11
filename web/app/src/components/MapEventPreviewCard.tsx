import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  formatEventTimeShort,
  getEventDates,
  getFeedEventDisplayTitle,
  getPrimaryEventDate,
  resolveEventHeroVisual,
} from '../lib/feedEvents';
import { getFeedEventTypeDisplayIcon, getFeedEventTypeDisplayLabel } from '../lib/eventType';
import type { FeedPost } from '../types';
import { EventUpvoteButton } from './EventUpvoteButton';
import { OpenLocationMenu } from './OpenLocationMenu';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export interface MapEventPreviewCardProps {
  post: FeedPost;
  locationCoords: { latitude: number; longitude: number };
  onClose: () => void;
  onOpenDetail: () => void;
  onOpenAuthor?: (userId: string) => void;
  onPostChange?: (patch: Partial<FeedPost>) => void;
}

/** Aperçu événement carte — fiche courte : qui / quand / où + 2 actions. */
export function MapEventPreviewCard({
  post,
  locationCoords,
  onClose,
  onOpenDetail,
  onOpenAuthor,
  onPostChange,
}: MapEventPreviewCardProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const hero = resolveEventHeroVisual(post);
  const placeholderGradient = useMemo(() => {
    const fallback = resolveEventHeroVisual({ ...post, imageUrl: undefined });
    return fallback.type === 'gradient'
      ? fallback.gradient
      : 'from-violet-900 via-purple-950 to-fuchsia-950';
  }, [post]);
  const heroImageUrl = hero.type === 'image' ? hero.url : '';
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);

  useEffect(() => {
    setHeroImageFailed(false);
    setLocationMenuOpen(false);
  }, [post.id, heroImageUrl]);

  const showHeroImage = hero.type === 'image' && !heroImageFailed;
  const primaryEventDate = getPrimaryEventDate(post);
  const eventTime = primaryEventDate ? formatEventTimeShort(primaryEventDate) : '';
  const eventDates = getEventDates(post);
  const title = getFeedEventDisplayTitle(post.content) || t('feed.eventTypeAutre');
  const location = post.eventLocation?.trim() ?? '';
  const eventTypeIcon = getFeedEventTypeDisplayIcon(post.eventType);
  const eventTypeName = getFeedEventTypeDisplayLabel(t, post.eventType);

  const metaParts = [eventTime, eventTypeName].filter(Boolean);
  if (eventDates.length > 1) {
    metaParts.push(`+${eventDates.length - 1}`);
  }
  const metaLine = metaParts.join(' · ');

  return (
    <>
      <div className="relative p-2.5 pt-3 sm:p-3 sm:pt-3.5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
          aria-label={t('common.close')}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        {onOpenAuthor ? (
          <button
            type="button"
            onClick={() => {
              if (post.author.id) onOpenAuthor(post.author.id);
            }}
            className="flex items-center gap-1.5 w-full text-left rounded-md min-h-[36px] pr-10 hover:bg-purple-900/20 active:bg-purple-900/30 transition -mx-0.5 px-0.5"
            aria-label={t('reels.openAuthorProfile', {
              username: post.author.username,
              defaultValue: `Voir le profil de ${post.author.username}`,
            })}
          >
            <UserAvatarOnline
              userId={post.author.id}
              avatarUrl={post.author.avatarUrl}
              username={post.author.username}
              size="sm"
            />
            <UsernameDisplay
              username={post.author.username}
              usernameColor={post.author.usernameColor}
              usernameWaveFrom={post.author.usernameWaveFrom}
              usernameWaveTo={post.author.usernameWaveTo}
              className="min-w-0 flex-1 truncate text-sm font-semibold"
            />
          </button>
        ) : (
          <div className="pr-10 min-h-[36px]" aria-hidden />
        )}

        <div className="mt-2.5 flex gap-2.5 items-start">
          <button
            type="button"
            onClick={onOpenDetail}
            className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[#0b0b0f] border border-purple-500/25"
            aria-label={t('map.eventPreviewDetail')}
          >
            {showHeroImage ? (
              <img
                src={hero.url}
                alt=""
                loading="lazy"
                onError={() => setHeroImageFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {eventTypeIcon}
                </span>
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0 min-h-16 flex flex-col justify-center gap-1">
            {metaLine || post.isEvent ? (
              <div className="flex w-full min-w-0 items-center justify-between gap-1">
                {metaLine ? (
                  <p className="min-w-0 truncate text-xs font-medium text-gray-300">{metaLine}</p>
                ) : (
                  <span className="min-w-0 flex-1" aria-hidden />
                )}
                {post.isEvent ? (
                  <EventUpvoteButton
                    postId={post.id}
                    upvoteCount={post.upvoteCount ?? 0}
                    upvotedByMe={post.upvotedByMe ?? false}
                    token={token}
                    compact
                    onChange={(patch) => onPostChange?.(patch)}
                  />
                ) : null}
              </div>
            ) : null}

            {location ? (
              <button
                type="button"
                onClick={() => setLocationMenuOpen(true)}
                className="flex items-start gap-1.5 w-full text-left rounded-md hover:bg-pink-500/10 active:bg-pink-500/15 transition -mx-0.5 px-0.5"
                title={t('openLocation.openLabel', {
                  location,
                  defaultValue: `Itinéraire vers ${location}`,
                })}
                aria-label={t('openLocation.openLabel', {
                  location,
                  defaultValue: `Itinéraire vers ${location}`,
                })}
              >
                <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
                <span className="min-w-0 text-xs leading-snug text-pink-100 break-words">{location}</span>
              </button>
            ) : null}
          </div>
        </div>

        <h2 className="mt-2 w-full text-xs font-medium leading-snug text-gray-200 line-clamp-3">{title}</h2>

        <div className="mt-3">
          <button
            type="button"
            onClick={onOpenDetail}
            className="w-full min-h-[44px] rounded-xl border border-purple-400/45 bg-purple-600/15 hover:bg-purple-600/25 text-purple-100 text-xs font-bold px-3 transition"
          >
            {t('map.eventPreviewDetail')}
          </button>
        </div>
      </div>

      {location ? (
        <OpenLocationMenu
          open={locationMenuOpen}
          onClose={() => setLocationMenuOpen(false)}
          label={location}
          latitude={locationCoords.latitude}
          longitude={locationCoords.longitude}
          overlayZClass="z-[120]"
        />
      ) : null}
    </>
  );
}
