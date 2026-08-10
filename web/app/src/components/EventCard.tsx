import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  formatEventDateShort,
  getEventDates,
  getEventDateEntries,
  formatEventDateWithEndTime,
  getPrimaryEventDate,
  resolveEventHeroVisual,
  splitFeedEventContent,
} from '../lib/feedEvents';
import { getFeedEventTypeDisplayIcon, getFeedEventTypeDisplayLabel } from '../lib/eventType';
import { storyLinkDisplayLabel } from '../lib/storyLink';
import { resolveEventCoordsSync } from '../lib/mapEventCoords';
import type { FeedPost } from '../types';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { OpenLocationMenu } from './OpenLocationMenu';
import { EventTaggedUsersRow } from './EventTaggedUsersRow';
import { EventUpvoteButton } from './EventUpvoteButton';
import { EventCardMapSidebar } from './EventCardMapSidebar';
import { EventDevSponsoButton } from './EventDevSponsoButton';
import { LinkifiedText } from './LinkifiedText';
import { MentionLinkifiedText } from './MentionLinkifiedText';
import { splitTextWithLinks } from '../lib/linkifyText';

function textHasUrlLinks(text: string): boolean {
  return splitTextWithLinks(text).some((s) => s.type === 'link');
}

const eventTextLinkClass =
  '[&_a]:text-sky-300 [&_a]:hover:text-sky-200 [&_a]:underline [&_a]:decoration-sky-400/40 [&_a]:underline-offset-2 [&_a]:break-all';

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


function eventTypeEmojiClass(isSidebar: boolean, isCompact: boolean): string {
  if (isSidebar) return 'text-[1.75rem] leading-none';
  if (isCompact) return 'text-4xl leading-none';
  return 'text-5xl leading-none';
}

function eventTypeBadgeEmojiClass(isSidebar: boolean, isCompact: boolean): string {
  if (isSidebar) return 'text-[10px] leading-none';
  if (isCompact) return 'text-xs leading-none';
  return 'text-sm leading-none';
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
  /** Densité visuelle carrousel : sidebar = panneau latéral carte (hero plus petit) */
  density?: 'default' | 'compact' | 'sidebar';
  extraBadges?: ReactNode;
  /** Actions (like, commentaire…) à droite de la ligne organisateur. */
  profileActions?: ReactNode;
  /** Clic sur l'organisateur → profil (ligne profil hors du bouton carte). */
  onOpenAuthor?: (post: FeedPost) => void;
  /** Clic organisateur → profil par id (alternative à onOpenAuthor). */
  onOpenProfile?: (userId: string) => void;
  /** Clic sur un compte tagué → profil. */
  onOpenTaggedUser?: (userId: string) => void;
  /** Intégré dans un modal — sans bordure ni halo autour de la carte. */
  embedded?: boolean;
  /** Clic sur le lieu → menu Google Maps / Waze / Plans. */
  locationNavigable?: boolean;
  /** Coords connues (ex. marqueur carte) ; sinon résolution synchrone du libellé. */
  locationCoords?: { latitude: number; longitude: number } | null;
  /** Sync upvote (listes carrousel, profil…). */
  onPostChange?: (patch: Partial<FeedPost>) => void;
  /** Carrousel Sponso sidebar — icône ✨ à la place du type. */
  sponsoredVisual?: boolean;
}

export function EventCard({
  post,
  onOpen,
  onShare,
  layout = 'vertical',
  compact,
  density = 'default',
  extraBadges,
  profileActions,
  onOpenAuthor,
  onOpenProfile,
  onOpenTaggedUser,
  embedded = false,
  locationNavigable = false,
  locationCoords = null,
  onPostChange,
  sponsoredVisual = false,
}: EventCardProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const hero = resolveEventHeroVisual(post);
  const placeholderGradient = useMemo(() => {
    const fallback = resolveEventHeroVisual({ ...post, imageUrl: undefined });
    return fallback.type === 'gradient'
      ? fallback.gradient
      : 'from-violet-900 via-purple-950 to-fuchsia-950';
  }, [post]);
  const heroImageUrl = hero.type === 'image' ? hero.url : '';
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useEffect(() => {
    setHeroImageFailed(false);
    setLocationMenuOpen(false);
  }, [post.id, heroImageUrl]);

  const showHeroImage = hero.type === 'image' && !heroImageFailed;
  const eventDates = getEventDates(post);
  const primaryEventDate = getPrimaryEventDate(post);
  const { title: eventTitle, description: eventDescription } = splitFeedEventContent(post.content);
  const inlineTextLinks =
    textHasUrlLinks(eventTitle) || textHasUrlLinks(eventDescription);
  const canOpenAuthor = Boolean(onOpenAuthor || onOpenProfile);
  const openAuthorProfile = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (onOpenAuthor) onOpenAuthor(post);
    else if (post.author.id) onOpenProfile?.(post.author.id);
  };
  const useDivCardShell = embedded || (inlineTextLinks && !canOpenAuthor);
  const isCarousel = layout === 'carousel';
  const isCompact = compact ?? !isCarousel;
  const isSidebar = density === 'sidebar';

  const resolvedLocationCoords = useMemo(() => {
    if (locationCoords) return locationCoords;
    if (!post.eventLocation?.trim()) return null;
    return resolveEventCoordsSync(post.eventLocation);
  }, [locationCoords, post.eventLocation]);

  if (isSidebar && isCarousel) {
    return (
      <EventCardMapSidebar
        post={post}
        onOpen={onOpen}
        onPostChange={onPostChange}
        sponsoredVisual={sponsoredVisual}
      />
    );
  }

  /** Carrousel horizontal : hauteur hero */
  const heroClass = isCarousel
    ? isSidebar
      ? 'h-14'
      : isCompact
        ? 'h-24'
        : 'h-32'
    : isCompact
      ? 'aspect-[2/1]'
      : 'aspect-video';

  const badgeIconClass = isSidebar ? 'w-2 h-2' : isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const badgeTextClass = isSidebar ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]';
  const badgePadClass = isSidebar ? 'px-1 py-0.5' : isCompact ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const dateOverlayClass = isSidebar
    ? 'text-[9px] px-1 py-0.5'
    : isCompact
      ? 'text-[10px] px-1.5 py-0.5'
      : 'text-[11px] px-2 py-1';
  const profilePadClass = isSidebar ? 'pt-0.5' : isCompact ? 'pt-1' : 'pt-1.5';
  const profileRowBorder = `flex items-center gap-1.5 border-t border-purple-500/15 ${profilePadClass}`;

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

  const profileRowInsideCard = !canOpenAuthor ? (
    <div className={profileRowBorder}>
      <div className={`flex items-center gap-2 min-w-0 ${profileActions ? 'flex-1' : 'w-full'}`}>
        {profileIdentity}
      </div>
      {profileActionsSlot}
    </div>
  ) : null;

  const profileRowOutsideCard = canOpenAuthor ? (
    <div className={`${isCompact ? 'px-2.5 pb-2.5' : 'px-3 pb-3'}`}>
      <div className={profileRowBorder}>
        <button
          type="button"
          onClick={openAuthorProfile}
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

  const eventTypeIcon = getFeedEventTypeDisplayIcon(post.eventType, { sponsored: sponsoredVisual });
  const eventTypeName = getFeedEventTypeDisplayLabel(t, post.eventType, { sponsored: sponsoredVisual });

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
          <span
            className={`${eventTypeEmojiClass(isSidebar, isCompact)} drop-shadow-lg`}
            aria-hidden
          >
            {eventTypeIcon}
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 pointer-events-none" />

      <div
        className={`absolute flex items-start justify-between pointer-events-none ${
          isSidebar
            ? 'top-1 left-1 right-1 gap-1'
            : isCompact
              ? 'top-1.5 left-1.5 right-1.5 gap-1.5'
              : 'top-2 left-2 right-2 gap-2'
        }`}
      >
        <span
          className={`inline-flex items-center gap-0.5 font-bold rounded-full border bg-purple-600/80 text-white border-purple-400/50 backdrop-blur-sm shadow-sm ${badgeTextClass} ${badgePadClass}`}
        >
          <span className={eventTypeBadgeEmojiClass(isSidebar, isCompact)} aria-hidden>
            {eventTypeIcon}
          </span>
          {eventTypeName}
        </span>
      </div>

      {primaryEventDate ? (
        <div
          className={`absolute pointer-events-none ${
            isSidebar
              ? 'bottom-1 left-1 right-1'
              : isCompact
                ? 'bottom-1.5 left-1.5 right-1.5'
                : 'bottom-2 left-2 right-2'
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

      {post.isEvent ? (
        <div
          className={`absolute z-10 pointer-events-auto ${
            isSidebar ? 'bottom-1 right-1' : isCompact ? 'bottom-1.5 right-1.5' : 'bottom-2 right-2'
          }`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <EventUpvoteButton
            postId={post.id}
            upvoteCount={post.upvoteCount ?? 0}
            upvotedByMe={post.upvotedByMe ?? false}
            token={token}
            compact={isCompact}
            onChange={(patch) => onPostChange?.(patch)}
          />
        </div>
      ) : null}
    </div>
  );

  const cardBody = (
    <div
      className={`${
        isSidebar ? 'p-2 space-y-1' : isCompact ? 'p-2.5 space-y-1.5' : 'p-3 space-y-2'
      }`}
    >
      {extraBadges ? <div className="flex items-center gap-1.5 flex-wrap">{extraBadges}</div> : null}

      {locationRow}

      {post.eventLinkUrl ? (
        <a
          href={post.eventLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 w-full min-h-[44px] text-center rounded-lg -mx-1 px-1 py-0.5 text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline decoration-sky-400/35 underline-offset-2"
        >
          {storyLinkDisplayLabel({ url: post.eventLinkUrl })}
        </a>
      ) : null}

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

      {eventTitle ? (
        <LinkifiedText
          as="div"
          text={eventTitle}
          className={`font-semibold text-white leading-snug ${eventTextLinkClass} ${
            isCompact ? 'text-[11px] line-clamp-2' : 'text-sm'
          }`}
        />
      ) : null}

      {eventDescription ? (
        isCompact ? (
          <MentionLinkifiedText
            as="div"
            text={eventDescription}
            mentionUsers={post.eventTaggedUsers}
            onOpenProfile={onOpenTaggedUser}
            className={`text-[11px] text-gray-400 leading-snug line-clamp-2 ${eventTextLinkClass}`}
          />
        ) : (
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/25 p-2.5 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-purple-300/90">
              {t('feed.eventModalSectionDetail')}
            </p>
            <MentionLinkifiedText
              as="div"
              text={eventDescription}
              mentionUsers={post.eventTaggedUsers}
              onOpenProfile={onOpenTaggedUser}
              className={`text-xs text-gray-300 leading-relaxed whitespace-pre-wrap ${eventTextLinkClass}`}
            />
          </div>
        )
      ) : null}

      {profileRowInsideCard}
    </div>
  );

  const handleCardShellClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    onOpen(post);
  };

  const cardShellInner = (
    <>
      {heroVisual}
      {cardBody}
    </>
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
      {post.isEvent && !embedded ? <EventDevSponsoButton post={post} /> : null}
      {canOpenAuthor ? (
        <>
          <div className="w-full">{heroVisual}</div>
          {cardBody}
          {profileRowOutsideCard}
        </>
      ) : useDivCardShell ? (
        <div
          className={`w-full text-left ${embedded ? '' : 'active:scale-[0.99] transition-transform cursor-pointer'}`}
          onClick={embedded ? undefined : handleCardShellClick}
          onKeyDown={
            embedded
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(post);
                  }
                }
          }
          role={embedded ? undefined : 'button'}
          tabIndex={embedded ? undefined : 0}
        >
          {cardShellInner}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(post)}
          className="w-full text-left active:scale-[0.99] transition-transform"
        >
          {cardShellInner}
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
