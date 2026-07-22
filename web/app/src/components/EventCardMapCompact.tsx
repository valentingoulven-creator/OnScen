import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  formatEventDateTimeShort,
  getEventDates,
  getPrimaryEventDate,
  resolveEventHeroVisual,
} from '../lib/feedEvents';
import { getMapEventDisplayIcon, type FeedEventType } from '../lib/eventType';
import type { FeedPost } from '../types';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { EventUpvoteButton } from './EventUpvoteButton';
import { OpenLocationMenu } from './OpenLocationMenu';

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function eventTypeLabel(t: ReturnType<typeof useTranslation>['t'], eventType?: FeedEventType | null): string {
  if (eventType === 'dance') return t('feed.eventTypeDance');
  if (eventType === 'chant') return t('feed.eventTypeChant');
  return t('feed.eventTypeAutre');
}

export interface EventCardMapCompactProps {
  post: FeedPost;
  onPostChange?: (patch: Partial<FeedPost>) => void;
  profileActions?: ReactNode;
  onOpenAuthor?: (post: FeedPost) => void;
  onActivate?: () => void;
  activateAriaLabel?: string;
  locationNavigable?: boolean;
  locationCoords?: { latitude: number; longitude: number } | null;
  /** sidebar = hero h-12 ; map = hero h-10, plus serré */
  density?: 'sidebar' | 'map';
  /** Événement sponsorisé sidebar — icône ✨. */
  sponsoredVisual?: boolean;
}

/** Carte événement compacte (sidebar carousel). */
export function EventCardMapCompact({
  post,
  onPostChange,
  profileActions,
  onOpenAuthor,
  onActivate,
  activateAriaLabel,
  locationNavigable = false,
  locationCoords = null,
  density = 'sidebar',
  sponsoredVisual = false,
}: EventCardMapCompactProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const isMap = density === 'map';
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
  const eventDateTime = primaryEventDate ? formatEventDateTimeShort(primaryEventDate) : '';
  const eventDates = getEventDates(post);
  const title = post.content.trim();
  const location = post.eventLocation?.trim() ?? '';
  const eventTypeIcon = getMapEventDisplayIcon(post.eventType, { sponsored: sponsoredVisual });
  const eventTypeName = sponsoredVisual
    ? t('map.sidebarSponsoCategory', { defaultValue: 'Sponso' })
    : eventTypeLabel(t, post.eventType);

  const heroHeight = isMap ? 'h-10' : 'h-12';
  const bodyPad = isMap ? 'p-1.5 space-y-1' : 'p-2 space-y-1.5';

  const locationRow = location ? (
    locationNavigable ? (
      <button
        type="button"
        onClick={() => setLocationMenuOpen(true)}
        className="flex items-start gap-1 min-w-0 w-full text-left rounded-md px-0.5 py-0.5 min-h-[36px] hover:bg-pink-500/10 active:bg-pink-500/15 transition"
        title={t('openLocation.openLabel', {
          location,
          defaultValue: `Itinéraire vers ${location}`,
        })}
        aria-label={t('openLocation.openLabel', {
          location,
          defaultValue: `Itinéraire vers ${location}`,
        })}
      >
        <MapPinIcon className="mt-0.5 h-3 w-3 shrink-0 text-pink-400" />
        <span className="min-w-0 text-[10px] font-semibold leading-snug text-gray-100 line-clamp-1">
          {location}
        </span>
      </button>
    ) : (
      <div className="flex items-start gap-1 min-w-0">
        <MapPinIcon className="mt-0.5 h-3 w-3 shrink-0 text-pink-400" />
        <span className="min-w-0 text-[10px] font-semibold leading-snug text-gray-100 line-clamp-2">
          {location}
        </span>
      </div>
    )
  ) : null;

  const authorRow = (
    <div className="flex items-center gap-1 min-w-0 border-t border-purple-500/10 pt-1">
      {onOpenAuthor ? (
        <button
          type="button"
          onClick={() => onOpenAuthor(post)}
          className="flex items-center gap-1 min-w-0 flex-1 text-left rounded-md px-0.5 py-0.5 hover:bg-purple-900/20 active:bg-purple-900/30 transition min-h-[36px]"
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
            className="min-w-0 flex-1 truncate text-[10px] font-semibold"
          />
        </button>
      ) : (
        <div className="flex items-center gap-1 min-w-0 flex-1">
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
            className="min-w-0 flex-1 truncate text-[10px] font-semibold"
          />
        </div>
      )}
      {profileActions ? (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {profileActions}
        </div>
      ) : null}
    </div>
  );

  const body = (
    <>
      <div className={`relative ${heroHeight} w-full overflow-hidden bg-[#1a1028]`}>
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
            <span className={`${isMap ? 'text-xl' : 'text-2xl'} leading-none drop-shadow-lg`} aria-hidden>
              {eventTypeIcon}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10 pointer-events-none" />

        <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full border border-purple-400/45 bg-purple-600/85 px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm">
          <span className="text-[9px] leading-none" aria-hidden>
            {eventTypeIcon}
          </span>
          {eventTypeName}
        </span>

        {eventDateTime ? (
          <span className="absolute bottom-1 left-1 max-w-[calc(100%-2.5rem)] rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white backdrop-blur-sm truncate">
            {eventDateTime}
            {eventDates.length > 1 ? (
              <span className="ml-0.5 font-semibold text-purple-200/90">+{eventDates.length - 1}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className={bodyPad}>
        {locationRow}
        {title ? (
          <p className={`leading-snug text-gray-400 ${isMap ? 'text-[9px] line-clamp-1' : 'text-[10px] line-clamp-2'}`}>
            {title}
          </p>
        ) : null}
        {authorRow}
      </div>
    </>
  );

  return (
    <>
      <div className="relative">
        {post.isEvent ? (
          <div className="absolute top-1 right-1 z-20 pointer-events-auto">
            <EventUpvoteButton
              postId={post.id}
              upvoteCount={post.upvoteCount ?? 0}
              upvotedByMe={post.upvotedByMe ?? false}
              token={token}
              compact
              onChange={(patch) => onPostChange?.(patch)}
            />
          </div>
        ) : null}

        {onActivate ? (
          <button
            type="button"
            onClick={onActivate}
            className="w-full text-left active:scale-[0.99] transition-transform"
            aria-label={activateAriaLabel}
          >
            {body}
          </button>
        ) : (
          body
        )}
      </div>

      {locationNavigable && location ? (
        <OpenLocationMenu
          open={locationMenuOpen}
          onClose={() => setLocationMenuOpen(false)}
          label={location}
          latitude={locationCoords?.latitude}
          longitude={locationCoords?.longitude}
          overlayZClass="z-[120]"
        />
      ) : null}
    </>
  );
}
