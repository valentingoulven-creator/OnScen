import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatEventDateShort,
  getEventDates,
  getEventDateEntries,
  formatEventDateWithEndTime,
  getPrimaryEventDate,
  hasUpcomingEventDate,
  resolveEventHeroVisual,
} from '../lib/feedEvents';
import { resolveEventCoordsSync } from '../lib/mapEventCoords';
import type { FeedPost } from '../types';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { OpenLocationMenu } from './OpenLocationMenu';
import { EventTaggedUsersRow } from './EventTaggedUsersRow';

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export interface EventCardProps {
  post: FeedPost;
  onOpen: (post: FeedPost) => void;
  onShare?: (post: FeedPost) => void;
  /** vertical = pleine largeur ; carousel = carte fixe pour scroll horizontal */
  layout?: 'vertical' | 'carousel';
  /** Liste verticale compacte (défaut true pour vertical, false pour carousel) */
  compact?: boolean;
  showUpcomingBadge?: boolean;
  extraBadges?: ReactNode;
  /** Actions (like, commentaire…) à droite de la ligne organisateur. */
  profileActions?: ReactNode;
  /** Clic sur l'organisateur → profil (ligne profil hors du bouton carte). */
  onOpenAuthor?: (post: FeedPost) => void;
  /** Clic sur un compte tagué → profil. */
  onOpenTaggedUser?: (userId: string) => void;
  /** Intégré dans un modal — sans bordure ni halo autour de la carte. */
  embedded?: boolean;
  /** Clic sur le lieu → menu Google Maps / Waze / Plans. */
  locationNavigable?: boolean;
  /** Coords connues (ex. marqueur carte) ; sinon résolution synchrone du libellé. */
  locationCoords?: { latitude: number; longitude: number } | null;
}

export function EventCard({
  post,
  onOpen,
  onShare,
  layout = 'vertical',
  compact,
  showUpcomingBadge = true,
  extraBadges,
  profileActions,
  onOpenAuthor,
  onOpenTaggedUser,
  embedded = false,
  locationNavigable = false,
  locationCoords = null,
}: EventCardProps) {
  const { t } = useTranslation();
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const hero = resolveEventHeroVisual(post);
  const placeholderGradient = useMemo(() => {
    const fallback = resolveEventHeroVisual({ ...post, imageUrl: undefined });
    return fallback.type === 'gradient'
      ? fallback.gradient
      : 'from-violet-900 via-purple-950 to-fuchsia-950';
  }, [post.eventLocation, post.content]);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useEffect(() => {
    setHeroImageFailed(false);
    setLocationMenuOpen(false);
  }, [post.id, hero.type === 'image' ? hero.url : '']);

  const showHeroImage = hero.type === 'image' && !heroImageFailed;
  const eventDates = getEventDates(post);
  const primaryEventDate = getPrimaryEventDate(post);
  const upcoming = showUpcomingBadge && hasUpcomingEventDate(post);
  const title = post.content.trim();
  const isCarousel = layout === 'carousel';
  const isCompact = compact ?? !isCarousel;

  const heroClass = isCarousel
    ? 'h-32'
    : isCompact
      ? 'aspect-[2/1]'
      : 'aspect-video';

  const badgeIconClass = isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const badgeTextClass = isCompact ? 'text-[9px]' : 'text-[10px]';
  const badgePadClass = isCompact ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const dateOverlayClass = isCompact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1';
  const profilePadClass = isCompact ? 'pt-1' : 'pt-1.5';
  const profileRowBorder = `flex items-center gap-1.5 border-t border-purple-500/15 ${profilePadClass}`;

  const resolvedLocationCoords = useMemo(() => {
    if (locationCoords) return locationCoords;
    if (!post.eventLocation?.trim()) return null;
    return resolveEventCoordsSync(post.eventLocation);
  }, [locationCoords, post.eventLocation]);

  const locationRow = post.eventLocation ? (
    locationNavigable ? (
      <button
        type="button"
        onClick={() => setLocationMenuOpen(true)}
        className="flex items-center justify-center gap-1.5 w-full text-center rounded-lg -mx-1 px-1 py-0.5 min-h-[44px] hover:bg-pink-500/10 active:bg-pink-500/15 transition group/location"
        title={t('openLocation.openLabel', {
          location: post.eventLocation,
          defaultValue: `Itinéraire vers ${post.eventLocation}`,
        })}
        aria-label={t('openLocation.openLabel', {
          location: post.eventLocation,
          defaultValue: `Itinéraire vers ${post.eventLocation}`,
        })}
      >
        <MapPinIcon
          className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-pink-400 shrink-0 group-hover/location:text-pink-300`}
        />
        <span
          className={`text-[11px] text-gray-200 leading-snug underline decoration-pink-400/35 underline-offset-2 group-hover/location:text-pink-100 ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}
        >
          {post.eventLocation}
        </span>
      </button>
    ) : (
      <div className="flex items-center justify-center gap-1.5 text-center">
        <MapPinIcon className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-pink-400 shrink-0`} />
        <span
          className={`text-[11px] text-gray-200 leading-snug ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}
        >
          {post.eventLocation}
        </span>
      </div>
    )
  ) : null;

  const profileIdentity = (
    <>
      <UserAvatarOnline
        userId={post.author.id}
        avatarUrl={post.author.avatarUrl}
        username={post.author.username}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <UsernameDisplay
          username={post.author.username}
          usernameColor={post.author.usernameColor}
          usernameWaveFrom={post.author.usernameWaveFrom}
          usernameWaveTo={post.author.usernameWaveTo}
          className="text-xs font-semibold truncate block"
        />
        <p className="text-[10px] text-purple-400/80">Organisateur</p>
      </div>
    </>
  );

  const profileActionsSlot = profileActions ? (
    <div
      className="flex items-center shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {profileActions}
    </div>
  ) : null;

  const profileRowInsideCard = !onOpenAuthor ? (
    <div className={profileRowBorder}>
      <div className={`flex items-center gap-2 min-w-0 ${profileActions ? 'flex-1' : 'w-full'}`}>
        {profileIdentity}
      </div>
      {profileActionsSlot}
    </div>
  ) : null;

  const profileRowOutsideCard = onOpenAuthor ? (
    <div className={`${isCompact ? 'px-2.5 pb-2.5' : 'px-3 pb-3'}`}>
      <div className={profileRowBorder}>
        <button
          type="button"
          onClick={() => onOpenAuthor(post)}
          className={`flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-purple-900/25 active:bg-purple-900/35 transition min-h-[44px] ${
            profileActions ? '' : 'w-full'
          }`}
          aria-label={t('reels.openAuthorProfile', {
            username: post.author.username,
            defaultValue: `Voir le profil de ${post.author.username}`,
          })}
        >
          {profileIdentity}
        </button>
        {profileActionsSlot}
      </div>
    </div>
  ) : null;

  const heroVisual = (
    <div className={`relative w-full overflow-hidden bg-[#1a1028] ${heroClass}`}>
      {showHeroImage ? (
        <img
          src={hero.url}
          alt=""
          loading="lazy"
          onError={() => setHeroImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/hero:scale-105"
        />
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}
        >
          <CalendarIcon
            className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} text-purple-300/65 drop-shadow-lg`}
            aria-hidden
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 pointer-events-none" />

      <div
        className={`absolute flex items-start justify-between pointer-events-none ${
          isCompact ? 'top-1.5 left-1.5 right-1.5 gap-1.5' : 'top-2 left-2 right-2 gap-2'
        }`}
      >
        <span
          className={`inline-flex items-center gap-0.5 font-bold rounded-full border bg-purple-600/80 text-white border-purple-400/50 backdrop-blur-sm shadow-sm ${badgeTextClass} ${badgePadClass}`}
        >
          <CalendarIcon className={badgeIconClass} />
          Événement
        </span>
        {upcoming ? (
          <span
            className={`font-semibold text-emerald-100 bg-emerald-600/70 rounded-full border border-emerald-400/40 backdrop-blur-sm ${badgeTextClass} ${badgePadClass}`}
          >
            À venir
          </span>
        ) : null}
      </div>

      {primaryEventDate ? (
        <div
          className={`absolute pointer-events-none ${
            isCompact ? 'bottom-1.5 left-1.5 right-1.5' : 'bottom-2 left-2 right-2'
          }`}
        >
          <span
            className={`inline-flex items-center gap-0.5 font-semibold text-white/95 bg-black/45 rounded-lg backdrop-blur-sm capitalize ${dateOverlayClass}`}
          >
            <CalendarIcon className={`${badgeIconClass} text-purple-300 shrink-0`} />
            {formatEventDateShort(primaryEventDate)}
            {(() => {
              const endTime = post.eventEndTimes?.[0];
              if (!endTime) return null;
              try {
                const d = new Date(endTime);
                if (Number.isNaN(d.getTime())) return null;
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                return <span className="text-purple-200/90 normal-case"> – {hh}:{mm}</span>;
              } catch {
                return null;
              }
            })()}
            {eventDates.length > 1 ? (
              <span className="normal-case text-purple-200/90"> · +{eventDates.length - 1}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      {onOpenAuthor ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/hero:bg-black/20 transition-colors pointer-events-none"
          aria-hidden
        >
          <span className="opacity-0 group-hover/hero:opacity-100 transition-opacity rounded-full bg-black/55 border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {t('map.eventModalOpenInFeed', { defaultValue: 'Voir dans le fil' })}
          </span>
        </div>
      ) : null}
    </div>
  );

  const cardBody = (
    <div className={`${isCompact ? 'p-2.5 space-y-1.5' : 'p-3 space-y-2'}`}>
      {extraBadges ? <div className="flex items-center gap-1.5 flex-wrap">{extraBadges}</div> : null}

      {locationRow}

      {post.eventTaggedUsers && post.eventTaggedUsers.length > 0 ? (
        <EventTaggedUsersRow taggedUsers={post.eventTaggedUsers} onOpenUser={onOpenTaggedUser} />
      ) : null}

      {eventDates.length > 0 ? (
        <div className="space-y-1">
          {getEventDateEntries(post).map(({ start, end }) => (
            <div key={start} className="flex items-start gap-1.5">
              <CalendarIcon className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-purple-400 shrink-0 mt-0.5`} />
              <span className="text-[11px] text-purple-100 capitalize leading-snug line-clamp-1">
                {formatEventDateWithEndTime(start, end)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {title ? (
        <p className={`text-[11px] text-gray-400 leading-snug ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}>
          {title}
        </p>
      ) : null}

      {profileRowInsideCard}
    </div>
  );

  return (
    <div
      className={
        embedded
          ? `group relative text-left w-full ${isCarousel ? 'events-carousel-card snap-start snap-always' : ''}`
          : `group relative text-left overflow-hidden rounded-xl border border-purple-500/40 bg-[#12121a] shadow-[0_0_24px_rgba(168,85,247,0.12)] hover:border-purple-400/55 hover:shadow-[0_0_28px_rgba(168,85,247,0.22)] transition-all ${
              isCarousel ? 'events-carousel-card snap-start snap-always' : 'w-full'
            }`
      }
    >
      {onShare ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare(post);
          }}
          className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-gray-200 hover:text-white hover:bg-black/70 border border-white/10 backdrop-blur-sm transition-colors"
          aria-label={t('common.share')}
          title={t('common.share')}
        >
          <ShareIcon className="w-3.5 h-3.5" />
        </button>
      ) : null}
      {onOpenAuthor ? (
        <>
          <button
            type="button"
            onClick={() => onOpen(post)}
            className="group/hero w-full text-left block cursor-pointer active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
            aria-label={t('map.eventModalOpenInFeed', { defaultValue: 'Voir dans le fil' })}
            title={t('map.eventModalOpenInFeed', { defaultValue: 'Voir dans le fil' })}
          >
            {heroVisual}
          </button>
          {cardBody}
          {profileRowOutsideCard}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(post)}
          className="w-full text-left active:scale-[0.99] transition-transform"
        >
          {heroVisual}
          {cardBody}
        </button>
      )}

      {locationNavigable && post.eventLocation ? (
        <OpenLocationMenu
          open={locationMenuOpen}
          onClose={() => setLocationMenuOpen(false)}
          label={post.eventLocation}
          latitude={resolvedLocationCoords?.latitude}
          longitude={resolvedLocationCoords?.longitude}
          overlayZClass="z-[120]"
        />
      ) : null}
    </div>
  );
}
