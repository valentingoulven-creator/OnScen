import { memo, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { applyFeedPreferences, boostPostsByGenreAffinity, sortFeedPostsByPublicationDate } from '../lib/feedFilter';
import { HOME_FEED_DISPLAY_PREFS } from '../lib/feedUserPrefs';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { fetchStoriesBundle, invalidateStoriesCache } from '../lib/storiesApiCache';
import {
  clipboardItemsToImageFile,
  dataUrlToFeedImageDataUrl,
} from '../lib/feedImagePaste';
import { ACCEPTED_FEED_VIDEO_FORMATS, ACCEPTED_IMAGE_FORMATS, validateImageFileAsync } from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import {
  fileToFeedVideoDataUrl,
  validateFeedVideoFile,
} from '../lib/feedVideo';
import { geocodeCountryFromQuery } from '../lib/geocodeAddress';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { dispatchMapEventsRefresh, dispatchMapOpenCreateSalon } from '../lib/mapUiEvents';
import type { CommentAlign, FeedPost, FeedPostComment, MapStory, MusicNewsItem, TrendingUser } from '../types';
import { StoryAvatarRing } from '../components/MapStoryRings';
import { StoriesInlineBar, type StorySheetState } from '../components/StoriesInlineBar';
import { FeedInlineAdBanner } from '../components/FeedInlineAdBanner';
import { StoryViewer } from '../components/StoryViewer';
import {
  findStackForStory,
  groupStoriesByUser,
  latestStory,
  pickInitialStory,
  resolveNextStory,
  resolvePrevStory,
  resolveAfterStoryDeleted,
  stackIndexForStory,
  type StoryUserStack,
} from '../lib/storyViewerNav';
import { ShareLinkMenu } from '../components/ShareLinkMenu';
import { ShareToUserSheet } from '../components/ShareToUserSheet';
import { buildFeedPostSharePayload, getFeedPostShareUrl } from '../lib/feedPostShare';
import { markFeedPostLinkShared, readFeedPostLinkSharedIds } from '../lib/feedPostShareState';
import { EventsCarousel } from '../components/EventsCarousel';
import { HorizontalScrollCarousel } from '../components/HorizontalScrollCarousel';
import { NewsArticleCard } from '../components/NewsArticleCard';
import { getUpcomingUserEvents, isUpcomingEvent } from '../lib/feedEvents';
import { EventLocationInput } from '../components/EventLocationInput';
import { ConfirmModal } from '../components/ConfirmModal';
import { pickRecentUserSounds, type FeaturedUserSoundItem } from '../lib/featuredUserSounds';
import {
  formatEventDateInputValue,
  isEventDateInFuture,
  parseEventDateInputValue,
} from '../lib/eventDateInput';

const PhotoImageEditor = lazy(() =>
  import('../components/PhotoImageEditor').then((m) => ({ default: m.PhotoImageEditor }))
);

interface ActualiteTabPageProps {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
  /** Scroll vers une publication (ex. depuis la carte). */
  focusPostId?: string | null;
  onFocusPostConsumed?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pays affiché / filtré quand la géoloc est refusée ou indisponible (MODIF 167). */
const EVENTS_COUNTRY_FALLBACK = { code: 'FR', name: 'France' } as const;

function countryCodeToFlag(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return '🌍';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

import i18n from '../i18n';

function formatWhen(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return i18n.t('feed.timeAgoNow');
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n.t('feed.timeAgoMinutes', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t('feed.timeAgoHours', { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return i18n.t('feed.timeAgoDays', { count: d });
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'fr-FR';
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    const locale = i18n.language.startsWith('en') ? 'en-US' : 'fr-FR';
    return d.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="15" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m22 8-5 3.5v5L22 20V8z" />
    </svg>
  );
}


function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ─── Post interaction icons ───────────────────────────────────────────────────

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ReshareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 23l-4-4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function BookmarkIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Comment alignment display (existing comments) ────────────────────────────

function commentRowClass(align?: CommentAlign): string {
  if (align === 'right')  return 'flex-row-reverse';
  if (align === 'center') return 'justify-center';
  return '';
}

function commentBubbleClass(align?: CommentAlign): string {
  if (align === 'right')  return 'text-right';
  if (align === 'center') return 'text-center';
  if (align === 'full')   return 'w-full text-justify';
  return 'text-left';
}


const TrendingUserCard = memo(function TrendingUserCard({ user, onOpenProfile }: { user: TrendingUser; onOpenProfile: (userId: string) => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(user.userId)}
      className="flex flex-col items-center gap-1.5 w-20 shrink-0"
      aria-label={`Voir le profil de ${user.username}`}
    >
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-900 to-purple-900 border-2 border-[#2a2a3d]">
        {user.avatarUrl && imgOk ? (
          <img
            src={user.avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-purple-300 uppercase">
            {user.username.charAt(0)}
          </div>
        )}
        <div className="absolute top-0 left-0 bg-black/50 rounded-br-lg px-1 py-0.5 text-[10px] font-bold text-white leading-none">
          {user.rank <= 3 ? rankMedal(user.rank) : `#${user.rank}`}
        </div>
        {(user.liveCount > 0) && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full border border-[#0b0b0f] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </div>
        )}
      </div>
      <p className="text-[10px] font-semibold text-white text-center leading-tight line-clamp-1 w-full">{user.username}</p>
    </button>
  );
});

function SectionHeader({
  label,
  emoji,
  subtitle,
  uppercase = true,
}: {
  label: string;
  emoji: string;
  subtitle?: string;
  uppercase?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-base leading-none">{emoji}</span>
      <h3
        className={`text-xs font-bold text-gray-300 tracking-wide${uppercase ? ' uppercase' : ''}`}
      >
        {label}
      </h3>
        {subtitle ? (
        <span className="text-[10px] max-[374px]:text-[11px] text-gray-500 font-normal normal-case tracking-normal">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

// ─── Pull-to-refresh container ────────────────────────────────────────────────

function PullToRefreshContainer({
  onRefresh,
  refreshing,
  className,
  children,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pullY, setPullY] = useState(0);
  const isPulling = useRef(false);
  const startY = useRef(0);
  const pullYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const onRefreshRef = useRef(onRefresh);
  const THRESHOLD = 64;

  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return;
      startY.current = e.touches[0].clientY;
      pullYRef.current = 0;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      if (el.scrollTop > 2) {
        isPulling.current = false;
        pullYRef.current = 0;
        setPullY(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      const v = delta > 0 ? Math.min(delta * 0.45, 80) : 0;
      pullYRef.current = v;
      setPullY(v);
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      if (pullYRef.current >= THRESHOLD) {
        onRefreshRef.current();
      }
      pullYRef.current = 0;
      setPullY(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div ref={containerRef} className={`feed-scroll ${className ?? ''}`.trim()}>
      {!refreshing && pullY > 0 ? (
        <div
          className="absolute left-0 right-0 top-0 z-10 flex items-end justify-center overflow-hidden pointer-events-none"
          style={{ height: pullY }}
          aria-hidden
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-purple-500/70 border-t-transparent shrink-0 mb-1"
            style={{
              opacity: 0.3 + progress * 0.7,
              transform: `rotate(${pullY * 4}deg) scale(${0.5 + progress * 0.5})`,
            }}
          />
        </div>
      ) : null}
      {refreshing ? (
        <div className="flex items-center justify-center h-11 shrink-0 pointer-events-none" aria-hidden>
          <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      ) : null}
      {children}
    </div>
  );
}

// ─── News tab content ─────────────────────────────────────────────────────────

function ActualitesContent({
  newsItems,
  newsLoading,
  newsError,
  onRefresh,
  refreshing,
  onBack,
  communityEvents = [],
  communityEventsLoading = false,
  trendingUsers = [],
  trendingLoading = false,
  onOpenProfile,
  onOpenAuthor,
  onShareEvent,
  countryCode = null,
  countryName = null,
  countryEventPosts = [],
  countryEventsLoading = false,
  featuredUserSounds = [],
  featuredUserSoundsLoading = false,
  onOpenReel,
  onOpenSalon,
}: {
  newsItems: MusicNewsItem[];
  newsLoading: boolean;
  newsError: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  onBack?: () => void;
  communityEvents?: FeedPost[];
  communityEventsLoading?: boolean;
  trendingUsers?: TrendingUser[];
  trendingLoading?: boolean;
  onOpenProfile: (userId: string) => void;
  onOpenAuthor: (post: FeedPost) => void;
  onShareEvent?: (post: FeedPost) => void;
  countryCode?: string | null;
  countryName?: string | null;
  countryEventPosts?: FeedPost[];
  countryEventsLoading?: boolean;
  featuredUserSounds?: FeaturedUserSoundItem[];
  featuredUserSoundsLoading?: boolean;
  onOpenReel?: (reelId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string) => void;
}) {
  const { t } = useTranslation();
  const displayCountryCode = countryCode ?? EVENTS_COUNTRY_FALLBACK.code;
  const userCreatedEvents = communityEvents;
  // MODIF 159 – country events (replaces static promo news items)
  const countryUpcoming = countryEventPosts
    .filter((p) => p.isEvent && isUpcomingEvent(p.eventDate))
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
  // MODIF 159/167 – remplace Promotions ; titre = pays (géoloc, profil ou France)
  const displayCountryName = countryName ?? EVENTS_COUNTRY_FALLBACK.name;
  const countrySectionLabel = t('feed.eventsCountryLabel', {
    country: displayCountryName.toUpperCase(),
  });
  const countrySectionEmoji = countryCodeToFlag(displayCountryCode);
  const trendsCountrySubtitle = `${countryCodeToFlag(displayCountryCode)} · ${displayCountryName}`;

  if (newsLoading && newsItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">{t('feed.loadingNews')}</p>
      </div>
    );
  }

  if (newsError && newsItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-sm text-gray-500 text-center">{newsError}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <PullToRefreshContainer
      onRefresh={onRefresh}
      refreshing={refreshing}
      className="flex-1 min-h-0 min-w-0 h-full px-3 pb-6"
    >
      <div className="space-y-3 min-w-0">
        {/* MODIF 214/215 – Tendances par pays en tête (remplace Stories dans Actualités) */}
        <div className="mt-4 space-y-2.5">
          <SectionHeader
            label={t('feed.trendsWeek')}
            emoji="🔥"
            subtitle={trendsCountrySubtitle}
          />
          {trendingLoading && trendingUsers.length === 0 ? (
            <div className="overflow-x-auto -mx-3 px-3">
              <div className="flex gap-4 w-max pb-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 w-20 shrink-0">
                    <div className="w-16 h-16 rounded-full bg-[#1e1e2f] animate-pulse" />
                    <div className="w-14 h-2 rounded bg-[#1e1e2f] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : trendingUsers.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">{t('feed.trendsEmpty')}</p>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3">
              <div className="flex gap-4 w-max pb-1">
                {trendingUsers.map((user) => (
                  <TrendingUserCard key={user.userId} user={user} onOpenProfile={onOpenProfile} />
                ))}
              </div>
            </div>
          )}
        </div>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-amber-300 bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 transition"
            aria-label={t('feed.backHomeAria')}
          >
            {t('feed.backHome')}
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4 min-w-0">
      {/* Les nouveautés — sons publiés par la communauté (salons + reels) */}
      <div className="space-y-2.5">
        <SectionHeader
          label={t('feed.featured')}
          emoji="🌟"
          subtitle={t('feed.featuredUserSoundsSubtitle')}
          uppercase={false}
        />
        {featuredUserSoundsLoading && featuredUserSounds.length === 0 ? (
          <div className="overflow-x-auto -mx-3 px-3">
            <div className="flex gap-3 w-max pb-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[300px] shrink-0 overflow-hidden rounded-xl border border-[#2a2a3d] bg-[#12121a] animate-pulse"
                >
                  <div className="aspect-video bg-[#1e1e2f]" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 rounded bg-[#1e1e2f]" />
                    <div className="h-3 w-4/5 rounded bg-[#1e1e2f]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : featuredUserSounds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <p className="text-xs text-gray-500">{t('feed.featuredUserSoundsEmpty')}</p>
          </div>
        ) : (
          <HorizontalScrollCarousel
            itemCount={featuredUserSounds.length}
            ariaPrevLabel={t('feed.featuredCarouselPrev')}
            ariaNextLabel={t('feed.featuredCarouselNext')}
            scrollClassName="ms-hscroll-track overflow-x-auto flex w-max gap-3 pb-1 snap-x snap-mandatory"
          >
            {featuredUserSounds.map((item) => (
              <NewsArticleCard
                key={`${item.kind}-${item.id}`}
                className="w-[300px] shrink-0 snap-start"
                imageUrl={item.imageUrl}
                title={item.title}
                excerpt={item.excerpt}
                source={item.source}
                timeAgo={formatWhen(item.publishedAt)}
                badge={t(item.badgeKey)}
                genres={item.genres}
                readMoreLabel={t('feed.featuredReadMore')}
                onReadMoreClick={() => {
                  if (item.kind === 'salon') {
                    onOpenSalon?.(item.id, item.title);
                  } else {
                    onOpenReel?.(item.id);
                  }
                }}
              />
            ))}
          </HorizontalScrollCarousel>
        )}
      </div>

      {/* Événements autour — publications événement créées par les utilisateurs */}
      <div className="space-y-2.5 min-w-0">
        <SectionHeader
          label={t('feed.eventsAround')}
          emoji="📍"
          subtitle={t('feed.eventsAroundRadius')}
        />
        {communityEventsLoading && userCreatedEvents.length === 0 ? (
          <p className="text-[11px] text-gray-500 px-0.5">{t('feed.eventsCommunityLoading')}</p>
        ) : userCreatedEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <CalendarIcon className="w-7 h-7 text-gray-600" />
            <p className="text-xs text-gray-500">{t('feed.eventsCommunityEmpty')}</p>
          </div>
        ) : (
          <EventsCarousel posts={userCreatedEvents} onOpen={onOpenAuthor} onShare={onShareEvent} />
        )}
      </div>

      {/* MODIF 159 – Événements dans le pays de l'utilisateur (remplace Promotions éditoriales) */}
      <div className="space-y-2.5 min-w-0">
        <SectionHeader label={countrySectionLabel} emoji={countrySectionEmoji} />
        {countryEventsLoading ? (
          <p className="text-[11px] text-gray-500 px-0.5">{t('feed.eventsCountryLoading')}</p>
        ) : countryUpcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <CalendarIcon className="w-7 h-7 text-gray-600" />
            <p className="text-xs text-gray-500">{t('feed.eventsCountryEmpty')}</p>
          </div>
        ) : (
          <EventsCarousel
            posts={countryUpcoming}
            onOpen={onOpenAuthor}
            onShare={onShareEvent}
            getExtraBadges={() => (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {countryCodeToFlag(displayCountryCode)} · {displayCountryName}
              </span>
            )}
          />
        )}
      </div>

      {newsItems.length === 0 && !newsLoading && (
        <p className="text-sm text-gray-500 text-center py-8">
          Aucune actualité pour le moment.
        </p>
      )}
      </div>
    </PullToRefreshContainer>
  );
}

// ─── PostCard component ───────────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
  onOpenAuthor: (post: FeedPost) => void;
  storiesByUser: Map<string, MapStory[]>;
  commentOpenPostId: string | null;
  commentDraft: string;
  onCommentDraftChange: (v: string) => void;
  fullComments: FeedPostComment[] | undefined;
  commentsLoading: boolean;
  commentPosting: boolean;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onPostComment: () => void;
  onReshare: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}

const PostCard = memo(function PostCard({
  post,
  onOpenAuthor,
  storiesByUser,
  commentOpenPostId,
  commentDraft,
  onCommentDraftChange,
  fullComments,
  commentsLoading,
  commentPosting,
  onToggleLike,
  onToggleComments,
  onPostComment,
  onReshare,
  onShare,
  onToggleFavorite,
}: PostCardProps) {
  const { t } = useTranslation();
  const commentsOpen = commentOpenPostId === post.id;
  const displayedComments = fullComments ?? post.recentComments ?? [];
  const authorStory = latestStory(storiesByUser.get(post.author.id) ?? []);
  const authorHasStory = !!post.authorHasActiveStory;

  const upcoming = isUpcomingEvent(post.eventDate);

  return (
    <article
      id={`feed-post-${post.id}`}
      className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-2 scroll-mt-4"
    >
      {/* Event badge */}
      {post.isEvent && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-200 border-purple-500/40">
            <CalendarIcon className="w-3 h-3" />
            Événement
          </span>
          {upcoming && (
            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
              À venir
            </span>
          )}
        </div>
      )}

      {/* Author row */}
      <button
        type="button"
        onClick={() => onOpenAuthor(post)}
        className="flex items-center gap-2 text-left w-full"
        aria-label={
          authorHasStory ? `Story de ${post.author.username}` : `Profil de ${post.author.username}`
        }
      >
        <StoryAvatarRing
          hasActiveStory={authorHasStory}
          storyImageUrl={authorStory?.imageUrl}
          avatarUrl={post.author.avatarUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <UsernameDisplay
              username={post.author.username}
              usernameColor={post.author.usernameColor}
              usernameWaveFrom={post.author.usernameWaveFrom}
              usernameWaveTo={post.author.usernameWaveTo}
              className="text-sm font-semibold truncate block"
            />
            {authorHasStory ? (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded">
                Story
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-gray-500">
            {post.resharedFromId && <span className="text-green-500/80 mr-1">🔁 {t('feed.reshared')}</span>}
            {formatWhen(post.createdAt)}
          </p>
        </div>
      </button>

      {/* Event date & location block */}
      {post.isEvent && (post.eventDate || post.eventLocation) && (
        <div className="rounded-lg bg-purple-950/40 border border-purple-500/20 px-3 py-2 space-y-1.5">
          {post.eventDate && (
            <div className="flex items-start gap-2">
              <CalendarIcon className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
              <span className="text-xs text-purple-100 capitalize">{formatEventDate(post.eventDate)}</span>
            </div>
          )}
          {post.eventLocation && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
              <span className="text-xs text-gray-200">{post.eventLocation}</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {post.content.trim() ? (
        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{post.content}</p>
      ) : null}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full rounded-lg max-h-64 object-cover bg-[#1e1e2f]"
        />
      )}
      {post.videoUrl && (
        <video
          src={post.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg max-h-80 bg-[#1e1e2f]"
        />
      )}

      {/* Reshared original post embed */}
      {post.resharedFrom && (
        <div className="rounded-lg border border-[#2a2a3d] bg-[#0e0e18] p-2.5 space-y-1.5">
          <button
            type="button"
            onClick={() => onOpenAuthor(post.resharedFrom!)}
            className="flex items-center gap-2 text-left w-full"
          >
            <StoryAvatarRing
              hasActiveStory={!!post.resharedFrom.authorHasActiveStory}
              storyImageUrl={latestStory(storiesByUser.get(post.resharedFrom.author.id) ?? [])?.imageUrl}
              avatarUrl={post.resharedFrom.author.avatarUrl}
              size="sm"
            />
            <UsernameDisplay
              username={post.resharedFrom.author.username}
              usernameColor={post.resharedFrom.author.usernameColor}
              usernameWaveFrom={post.resharedFrom.author.usernameWaveFrom}
              usernameWaveTo={post.resharedFrom.author.usernameWaveTo}
              className="text-xs font-semibold truncate"
            />
            <span className="text-[10px] text-gray-600 shrink-0">{formatWhen(post.resharedFrom.createdAt)}</span>
          </button>
          {post.resharedFrom.content.trim() && (
            <p className="text-xs text-gray-300 whitespace-pre-wrap break-words line-clamp-4">
              {post.resharedFrom.content}
            </p>
          )}
          {post.resharedFrom.imageUrl && (
            <img
              src={post.resharedFrom.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full rounded-md max-h-40 object-cover bg-[#1e1e2f]"
            />
          )}
          {post.resharedFrom.videoUrl && (
            <video
              src={post.resharedFrom.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-md max-h-48 bg-[#1e1e2f]"
            />
          )}
        </div>
      )}

      {/* ── Interaction bar ── */}
      <div className="flex items-center gap-0.5 pt-1 border-t border-[#1a1a28]">
        {/* Like */}
        <button
          type="button"
          onClick={onToggleLike}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ${
            post.likedByMe ? 'text-red-400' : 'text-gray-500 hover:text-red-300 hover:bg-red-900/10'
          }`}
          title={post.likedByMe ? t('feed.unlike') : t('feed.like')}
        >
          <HeartIcon filled={post.likedByMe} className="w-3.5 h-3.5 shrink-0" />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>

        {/* Comment */}
        <button
          type="button"
          onClick={onToggleComments}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ${
            commentsOpen ? 'text-purple-400' : 'text-gray-500 hover:text-purple-300 hover:bg-purple-900/10'
          }`}
          title={t('feed.comment')}
        >
          <CommentIcon className="w-3.5 h-3.5 shrink-0" />
          {post.commentCount > 0 && <span>{post.commentCount}</span>}
        </button>

        {/* Reshare */}
        <button
          type="button"
          onClick={onReshare}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ${
            post.resharedByMe
              ? 'text-green-300 bg-green-900/10'
              : 'text-gray-500 hover:text-green-300 hover:bg-green-900/10'
          }`}
          title={post.resharedByMe ? t('feed.alreadyReshared') : t('feed.reshare')}
        >
          <ReshareIcon className="w-3.5 h-3.5 shrink-0" />
        </button>

        {/* External share */}
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium text-gray-500 hover:text-blue-300 hover:bg-blue-900/10"
          title={t('common.share')}
        >
          <ShareIcon className="w-3.5 h-3.5 shrink-0" />
        </button>

        {/* Bookmark (pushed right) */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition text-xs font-medium ml-auto ${
            post.favoriteByMe
              ? 'text-amber-400'
              : 'text-gray-500 hover:text-amber-300 hover:bg-amber-900/10'
          }`}
          title={post.favoriteByMe ? t('feed.removeFavorite') : t('feed.addFavorite')}
        >
          <BookmarkIcon filled={post.favoriteByMe} className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {/* ── Comments section ── */}
      {commentsOpen && (
        <div className="space-y-2 pt-1">
          {commentsLoading && (
            <p className="text-xs text-gray-600 text-center">{t('feed.commentsLoading')}</p>
          )}
          {!commentsLoading && displayedComments.length === 0 && (
            <p className="text-xs text-gray-600 text-center">{t('feed.commentsEmpty')}</p>
          )}
          <div className="post-comments-scroll max-h-[280px] space-y-2">
            {displayedComments.map((c) => (
              <div key={c.id} className={`flex gap-2 ${commentRowClass(c.textAlign)}`}>
                {c.textAlign !== 'center' && (
                  <img
                    src={c.avatarUrl || '/icon.svg'}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover bg-[#1e1e2f] shrink-0 mt-0.5"
                  />
                )}
                <div className={`min-w-0 bg-[#0e0e18] rounded-xl px-3 py-2 ${commentBubbleClass(c.textAlign)} ${c.textAlign === 'full' ? 'flex-1' : 'max-w-[85%]'}`}>
                  <p className="text-[11px] font-semibold text-white truncate">{c.username}</p>
                  <p className="text-xs text-gray-300 break-words">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Comment input */}
          <div className="pt-1">
            <div className="flex gap-2">
              <textarea
                value={commentDraft}
                onChange={(e) => onCommentDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onPostComment(); }
                }}
                placeholder={t('feed.commentPlaceholder')}
                rows={1}
                maxLength={500}
                className="flex-1 rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <button
                type="button"
                disabled={!commentDraft.trim() || commentPosting}
                onClick={onPostComment}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white disabled:opacity-40 transition shrink-0"
              >
                {commentPosting ? '…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export function ActualiteTabPage({
  onOpenProfile,
  onOpenReel,
  onOpenSalon,
  onOpenLive,
  isActive,
  focusPostId,
  onFocusPostConsumed,
}: ActualiteTabPageProps) {
  const { token, user } = useAuth();
  const { t, i18n } = useTranslation();

  // ── Fil state ──
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageAttaching, setImageAttaching] = useState(false);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [videoAttaching, setVideoAttaching] = useState(false);
  const [editorSource, setEditorSource] = useState<File | string | null>(null);
  const [editorPreviewUrl, setEditorPreviewUrl] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ── Événement ──
  const [isEvent, setIsEvent] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventDateDraft, setEventDateDraft] = useState('');
  const [eventDateError, setEventDateError] = useState<string | null>(null);
  const eventDateInputRef = useRef<HTMLInputElement>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [eventType, setEventType] = useState<'dance' | 'chant' | 'autre'>('autre');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  // ── News panel (toggle depuis Accueil) ──
  const [showNews, setShowNews] = useState(false);
  const [newsItems, setNewsItems] = useState<MusicNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // ── Tendances réelles (MODIF 160) ──
  const [trendingUsers, setTrendingUsers] = useState<TrendingUser[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // ── MODIF 159 – Événements par pays (Nominatim reverse geocoding) ──
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [countryEventPosts, setCountryEventPosts] = useState<FeedPost[]>([]);
  const [countryEventsLoading, setCountryEventsLoading] = useState(false);
  const [communityEventPosts, setCommunityEventPosts] = useState<FeedPost[]>([]);
  const [communityEventsLoading, setCommunityEventsLoading] = useState(false);
  const [featuredUserSounds, setFeaturedUserSounds] = useState<FeaturedUserSoundItem[]>([]);
  const [featuredUserSoundsLoading, setFeaturedUserSoundsLoading] = useState(false);

  // ── Post interactions ──
  const [commentOpenPostId, setCommentOpenPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [fullComments, setFullComments] = useState<Record<string, FeedPostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentPosting, setCommentPosting] = useState<Record<string, boolean>>({});

  // ── Share & Toast ──
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [linkSharedPostIds, setLinkSharedPostIds] = useState<Set<string>>(() => readFeedPostLinkSharedIds());
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRemoveFavoritePost, setConfirmRemoveFavoritePost] = useState<FeedPost | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stories pour anneaux / ouverture depuis les publications ──
  const [feedStoriesByUser, setFeedStoriesByUser] = useState<Map<string, MapStory[]>>(new Map());
  const [feedStorySheet, setFeedStorySheet] = useState<StorySheetState>({ kind: 'closed' });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const sharePayload = useMemo(() => {
    if (!sharePost) return null;
    return buildFeedPostSharePayload(sharePost, i18n.language, {
      feedPostTitle: t('share.feedPostTitle'),
      eventTitle: t('share.eventTitle'),
      eventDate: t('share.eventDate'),
      eventLocation: t('share.eventLocation'),
    });
  }, [sharePost, i18n.language, t]);

  useEffect(() => {
    if (!sharePost) {
      setShareUrl('');
      return;
    }
    let cancelled = false;
    void getFeedPostShareUrl(sharePost.id).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [sharePost]);

  // ── Feed prefs ──
  const viewerTastes = useMemo(
    () => ({
      interests: user?.interests,
      favoriteGenres: user?.favoriteGenres,
      favoriteArtists: user?.favoriteArtists,
    }),
    [user?.interests, user?.favoriteGenres, user?.favoriteArtists]
  );

  const visiblePosts = useMemo(() => {
    if (!user?.id) return sortFeedPostsByPublicationDate(posts);
    const filtered = applyFeedPreferences(posts, HOME_FEED_DISPLAY_PREFS, {
      viewerId: user.id,
      favoriteIds,
      viewerTastes,
    });
    // Boost posts from genre-matched authors when the user has favorite genres set
    return boostPostsByGenreAffinity(filtered, viewerTastes.favoriteGenres);
  }, [posts, user?.id, favoriteIds, viewerTastes]);

  const communityEvents = useMemo(
    () => getUpcomingUserEvents(communityEventPosts, { favoriteAuthorIds: favoriteIds }),
    [communityEventPosts, favoriteIds]
  );

  useEffect(() => {
    if (!isActive) setShowNews(false);
  }, [isActive]);

  useEffect(() => {
    if (!focusPostId || !isActive || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`feed-post-${focusPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-purple-400/80', 'ring-offset-2', 'ring-offset-[#0b0b0f]');
        window.setTimeout(
          () => el.classList.remove('ring-2', 'ring-purple-400/80', 'ring-offset-2', 'ring-offset-[#0b0b0f]'),
          2200
        );
      }
      onFocusPostConsumed?.();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [focusPostId, isActive, loading, visiblePosts.length, onFocusPostConsumed]);

  const loadFeedStories = useCallback(async () => {
    if (!token) {
      setFeedStoriesByUser(new Map());
      return;
    }
    try {
      const bundle = await fetchStoriesBundle(token);
      const allStories = [...bundle.stories];
      for (const s of bundle.mine) {
        if (!allStories.some((x) => x.id === s.id)) allStories.push(s);
      }
      setFeedStoriesByUser(groupStoriesByUser(allStories));
    } catch {
      setFeedStoriesByUser(new Map());
    }
  }, [token]);

  // ── Load feed posts (GET /api/feed) ──
  const loadFeed = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [feedRes] = await Promise.all([
          api.getFeedPosts(token, {
            limit: 50,
            followingOnly: true,
          }),
          loadFeedStories(),
        ]);
        setPosts(feedRes.posts);
      } catch {
        setError('Impossible de charger le fil.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, loadFeedStories]
  );

  useEffect(() => {
    if (!isActive || !token || showNews) return;
    void loadFeed();
  }, [isActive, token, showNews, loadFeed]);

  useEffect(() => {
    if (!isActive || !token) return;
    void api
      .getMyFavorites(token)
      .then((r) => setFavoriteIds(new Set(r.favorites.map((f) => f.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [isActive, token]);

  const feedStoryStacks = useMemo((): StoryUserStack[] => {
    const stacks: StoryUserStack[] = [];
    for (const [userId, stories] of feedStoriesByUser) {
      if (stories.length) stacks.push({ userId, stories });
    }
    stacks.sort((a, b) => {
      const aLatest = a.stories[a.stories.length - 1]?.createdAt ?? 0;
      const bLatest = b.stories[b.stories.length - 1]?.createdAt ?? 0;
      return bLatest - aLatest;
    });
    return stacks;
  }, [feedStoriesByUser]);

  const feedViewerStack =
    feedStorySheet.kind === 'view'
      ? findStackForStory(feedStoryStacks, feedStorySheet.story)
      : undefined;
  const feedViewerStackIndex =
    feedStorySheet.kind === 'view' && feedViewerStack
      ? stackIndexForStory(feedViewerStack, feedStorySheet.story)
      : 0;

  const goNextFeedStory = useCallback(() => {
    if (feedStorySheet.kind !== 'view') return;
    const next = resolveNextStory(feedStoryStacks, feedStorySheet.story, user?.id);
    if (!next) return;
    setFeedStorySheet({ kind: 'view', story: next.story, isOwn: next.isOwn });
  }, [feedStorySheet, feedStoryStacks, user?.id]);

  const goPrevFeedStory = useCallback(() => {
    if (feedStorySheet.kind !== 'view') return;
    const prev = resolvePrevStory(feedStoryStacks, feedStorySheet.story, user?.id);
    if (!prev) return;
    setFeedStorySheet({ kind: 'view', story: prev.story, isOwn: prev.isOwn });
  }, [feedStorySheet, feedStoryStacks, user?.id]);

  const canNextFeedStory =
    feedStorySheet.kind === 'view' &&
    resolveNextStory(feedStoryStacks, feedStorySheet.story, user?.id) != null;
  const canPrevFeedStory =
    feedStorySheet.kind === 'view' &&
    resolvePrevStory(feedStoryStacks, feedStorySheet.story, user?.id) != null;

  const handleFeedStoryDeleted = useCallback(
    (deleted: MapStory) => {
      invalidateStoriesCache();
      setFeedStoriesByUser((prev) => {
        const next = new Map(prev);
        const list = (next.get(deleted.userId) ?? []).filter((s) => s.id !== deleted.id);
        if (list.length) next.set(deleted.userId, list);
        else next.delete(deleted.userId);
        return next;
      });
      const nav = resolveAfterStoryDeleted(feedStoryStacks, deleted, user?.id);
      if (nav.action === 'close') setFeedStorySheet({ kind: 'closed' });
      else setFeedStorySheet({ kind: 'view', story: nav.story, isOwn: nav.isOwn });
      void loadFeedStories();
    },
    [feedStoryStacks, user?.id, loadFeedStories]
  );

  const handlePostAuthorClick = useCallback(
    (post: FeedPost) => {
      if (post.authorHasActiveStory) {
        const userStories = feedStoriesByUser.get(post.author.id);
        const story = userStories ? pickInitialStory(userStories) : undefined;
        if (story) {
          setFeedStorySheet({ kind: 'view', story, isOwn: post.author.id === user?.id });
          return;
        }
      }
      onOpenProfile(post.author.id);
    },
    [feedStoriesByUser, onOpenProfile, user?.id]
  );

  // ── Load news ──
  const loadNews = useCallback(async (silent = false) => {
    if (silent) setNewsRefreshing(true);
    else setNewsLoading(true);
    setNewsError(null);
    try {
      const r = await api.getNews();
      setNewsItems(r.news);
    } catch {
      setNewsError('Impossible de charger les actualités.');
    } finally {
      setNewsLoading(false);
      setNewsRefreshing(false);
    }
  }, []);

  // Load news when panel opens; auto-refresh every 5 min
  useEffect(() => {
    if (!isActive || !showNews) return;
    void loadNews();
    const timer = setInterval(() => void loadNews(true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isActive, showNews, loadNews]);

  // ── MODIF 160/215 – Tendances filtrées par pays (comme événements) ──
  const loadTrendingUsers = useCallback(async () => {
    if (!token) return;
    setTrendingLoading(true);
    try {
      const code = countryCode ?? EVENTS_COUNTRY_FALLBACK.code;
      const r = await api.getTrendingUsers(token, code);
      setTrendingUsers(r.users);
    } catch {
      // silently ignore – section shows empty state
    } finally {
      setTrendingLoading(false);
    }
  }, [token, countryCode]);

  useEffect(() => {
    if (!isActive || !token || !showNews) return;
    void loadTrendingUsers();
    const timer = setInterval(() => void loadTrendingUsers(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isActive, token, showNews, loadTrendingUsers]);

  // ── MODIF 179 – Événements autour : tous les événements utilisateurs (API eventsOnly) ──
  const loadCommunityEvents = useCallback(async () => {
    if (!token) return;
    setCommunityEventsLoading(true);
    try {
      const res = await api.getFeedPosts(token, {
        eventsOnly: true,
        userEventsOnly: true,
        limit: 50,
      });
      setCommunityEventPosts(res.posts);
    } catch {
      // silently ignore – section shows empty state
    } finally {
      setCommunityEventsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isActive || !token || !showNews) return;
    void loadCommunityEvents();
  }, [isActive, token, showNews, loadCommunityEvents]);

  const loadFeaturedUserSounds = useCallback(async () => {
    if (!token) return;
    setFeaturedUserSoundsLoading(true);
    try {
      const [salonsRes, reelsRes] = await Promise.all([
        api.listSalons(token),
        api.getReelsFeed(token),
      ]);
      setFeaturedUserSounds(pickRecentUserSounds(salonsRes.salons, reelsRes.reels, 5));
    } catch {
      setFeaturedUserSounds([]);
    } finally {
      setFeaturedUserSoundsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isActive || !token || !showNews) return;
    void loadFeaturedUserSounds();
  }, [isActive, token, showNews, loadFeaturedUserSounds]);

  // ── MODIF 159 – Load events filtered by user's country ──
  const loadCountryEvents = useCallback(async () => {
    if (!token) return;
    setCountryEventsLoading(true);
    try {
      const code = countryCode ?? EVENTS_COUNTRY_FALLBACK.code;
      const res = await api.getFeedPosts(token, {
        eventsOnly: true,
        eventCountry: code,
        limit: 50,
      });
      setCountryEventPosts(res.posts);
    } catch {
      // silently ignore – section shows empty state
    } finally {
      setCountryEventsLoading(false);
    }
  }, [token, countryCode]);

  useEffect(() => {
    if (!isActive || !showNews) return;
    void loadCountryEvents();
  }, [isActive, showNews, loadCountryEvents]);

  // Request geolocation when news panel opens (soft permission request)
  // MODIF 159 – Nominatim reverse geocoding → countryCode + countryName
  // MODIF 167 – si geo refusée : ville du profil puis France (plus de titre générique)
  useEffect(() => {
    if (!showNews) return;

    let cancelled = false;

    const applyCountryFallback = async () => {
      const profileCity = user?.city?.trim();
      if (profileCity) {
        try {
          const fromCity = await geocodeCountryFromQuery(profileCity);
          if (!cancelled && fromCity) {
            setCountryCode(fromCity.code);
            setCountryName(fromCity.name);
            return;
          }
        } catch {
          /* profil ville non résolu → France */
        }
      }
      if (!cancelled) {
        setCountryCode(EVENTS_COUNTRY_FALLBACK.code);
        setCountryName(EVENTS_COUNTRY_FALLBACK.name);
      }
    };

    if (!navigator.geolocation) {
      void applyCountryFallback();
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'MeloSong/1.0' } }
        )
          .then((res) => res.json())
          .then((data: { address?: { country_code?: string; country?: string } }) => {
            if (cancelled) return;
            const code = (data.address?.country_code ?? '').toUpperCase();
            const name = data.address?.country ?? '';
            if (code) {
              setCountryCode(code);
              if (name) setCountryName(name);
            } else {
              void applyCountryFallback();
            }
          })
          .catch(() => {
            void applyCountryFallback();
          });
      },
      () => {
        void applyCountryFallback();
      },
      { timeout: 8000 }
    );

    return () => {
      cancelled = true;
    };
  }, [showNews, user?.city]);

  useEffect(() => {
    if (!editorSource) {
      setEditorPreviewUrl(null);
      return;
    }
    if (typeof editorSource === 'string') {
      setEditorPreviewUrl(editorSource);
      return;
    }
    const url = URL.createObjectURL(editorSource);
    setEditorPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editorSource]);

  // ── Image helpers ──
  const openFeedImageEditor = (source: File | string) => {
    setError(null);
    setEditorSource(source);
  };

  const attachImageFromFile = async (file: File) => {
    const validation = await validateImageFileAsync(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide.');
      return;
    }
    setVideoUrl('');
    setError(null);
    setImagePreparing(true);
    try {
      const prepared = await prepareImageFile(file);
      openFeedImageEditor(prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImagePreparing(false);
    }
  };

  const attachVideoFromFile = async (file: File) => {
    setError(null);
    const validation = await validateFeedVideoFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide.');
      return;
    }
    setImageUrl('');
    setEditorSource(null);
    setVideoAttaching(true);
    try {
      setVideoUrl(await fileToFeedVideoDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter la vidéo.");
    } finally {
      setVideoAttaching(false);
    }
  };

  const onFeedEditorConfirm = async (composedUrl: string) => {
    setEditorSource(null);
    setImageAttaching(true);
    setError(null);
    try {
      setImageUrl(await dataUrlToFeedImageDataUrl(composedUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImageAttaching(false);
    }
  };

  const onFeedEditorCancel = () => {
    setEditorSource(null);
  };

  const handleComposePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const file = clipboardItemsToImageFile(items);
    if (!file) return;
    e.preventDefault();
    await attachImageFromFile(file);
  };

  const parsedEventDateDraft = parseEventDateInputValue(eventDateDraft, i18n.language);
  const isEventDateConfirmed =
    Boolean(eventDate.trim()) && parsedEventDateDraft === eventDate;
  const showEventDateValidate = Boolean(eventDateDraft.trim()) && !isEventDateConfirmed;
  const eventFieldsValid =
    !isEvent || (isEventDateConfirmed && Boolean(eventLocation.trim()));

  const confirmEventDate = () => {
    const value = eventDateDraft.trim();
    if (!value) return;
    const parsed = parseEventDateInputValue(value, i18n.language);
    if (!parsed) {
      setEventDateError(t('feed.eventDateInvalid'));
      return;
    }
    if (!isEventDateInFuture(parsed)) {
      setEventDateError(t('feed.eventDatePast'));
      return;
    }
    setEventDateError(null);
    setEventDate(parsed);
    setEventDateDraft(formatEventDateInputValue(parsed, i18n.language));
    eventDateInputRef.current?.blur();
  };
  const canPublish = Boolean(draft.trim() || imageUrl.trim() || videoUrl.trim()) && eventFieldsValid;
  const editorOpen = Boolean(editorSource && editorPreviewUrl);
  const mediaAttaching = imageAttaching || videoAttaching || imagePreparing;

  const publish = async () => {
    if (!token || !canPublish || publishing || mediaAttaching || editorOpen) return;
    setPublishing(true);
    setError(null);
    try {
      const body: Parameters<typeof api.createFeedPost>[1] = { content: draft.trim() };
      const img = imageUrl.trim();
      const vid = videoUrl.trim();
      if (img) body.imageUrl = img;
      if (vid) body.videoUrl = vid;
      if (isEvent) {
        body.isEvent = true;
        body.eventDate = new Date(eventDate).toISOString();
        body.eventLocation = eventLocation.trim();
        body.eventType = eventType;
      }
      const r = await api.createFeedPost(token, body);
      if (isEvent && body.eventLocation) {
        await resolveEventCoords(body.eventLocation);
      }
      setPosts((prev) => [r.post, ...prev]);
      dispatchMapEventsRefresh();
      setDraft('');
      setImageUrl('');
      setVideoUrl('');
      setIsEvent(false);
      setEventDate('');
      setEventDateDraft('');
      setEventDateError(null);
      setEventLocation('');
      setEventType('autre');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Interaction handlers ──

  const updatePostInList = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  const handleLike = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const wasLiked = post.likedByMe;
    updatePostInList(post.id, {
      likedByMe: !wasLiked,
      likeCount: wasLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1,
    });
    try {
      if (wasLiked) {
        await api.unlikeFeedPost(token, post.id);
      } else {
        await api.likeFeedPost(token, post.id);
      }
    } catch {
      updatePostInList(post.id, { likedByMe: wasLiked, likeCount: post.likeCount });
    }
  }, [token, updatePostInList]);

  const handleToggleFavorite = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const wasFav = post.favoriteByMe;
    if (wasFav && !window.confirm('Retirer cette publication de vos favoris ?')) return;
    updatePostInList(post.id, { favoriteByMe: !wasFav });
    try {
      if (wasFav) {
        await api.removeFeedPostFavorite(token, post.id);
        showToast('Retiré des favoris');
      } else {
        await api.addFeedPostFavorite(token, post.id);
        showToast('Ajouté aux favoris ⭐');
      }
    } catch {
      updatePostInList(post.id, { favoriteByMe: wasFav });
      showToast('Erreur — réessayez');
    }
  }, [token, updatePostInList, showToast]);

  const handleReshare = useCallback(async (post: FeedPost) => {
    if (!token) return;
    try {
      const r = await api.reshareFeedPost(token, post.id);
      setPosts((prev) => [r.post, ...prev]);
      updatePostInList(post.id, { resharedByMe: true });
      showToast('Publication repartagée 🔁');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de repartager');
    }
  }, [token, showToast, updatePostInList]);

  const handleFeedPostLinkShared = useCallback(() => {
    const id = sharePost?.id;
    if (!id) return;
    markFeedPostLinkShared(id);
    setLinkSharedPostIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [sharePost?.id]);

  const handleToggleComments = useCallback(async (post: FeedPost) => {
    if (!token) return;
    const isOpen = commentOpenPostId === post.id;
    setCommentOpenPostId(isOpen ? null : post.id);
    if (!isOpen && !fullComments[post.id]) {
      setCommentsLoading((prev) => ({ ...prev, [post.id]: true }));
      try {
        const r = await api.getFeedPostComments(token, post.id);
        setFullComments((prev) => ({ ...prev, [post.id]: r.comments }));
      } catch { /* ignore */ } finally {
        setCommentsLoading((prev) => ({ ...prev, [post.id]: false }));
      }
    }
  }, [token, commentOpenPostId, fullComments]);

  const handlePostComment = useCallback(async (postId: string) => {
    if (!token || commentPosting[postId]) return;
    const content = (commentDrafts[postId] ?? '').trim();
    if (!content) return;
    setCommentPosting((prev) => ({ ...prev, [postId]: true }));
    try {
      const r = await api.postFeedComment(token, postId, content);
      setFullComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] ?? []), r.comment],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      updatePostInList(postId, { commentCount: r.commentCount });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de commenter');
    } finally {
      setCommentPosting((prev) => ({ ...prev, [postId]: false }));
    }
  }, [token, commentDrafts, commentPosting, updatePostInList, showToast]);

  const storiesSection = useMemo(
    () => (
      <StoriesInlineBar
        onOpenProfile={onOpenProfile}
        onOpenReel={onOpenReel}
        onOpenLive={onOpenLive}
        isActive={isActive}
      />
    ),
    [onOpenProfile, onOpenReel, onOpenLive, isActive]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full bg-[var(--ms-bg)]">
      <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-2xl mx-auto">


        {/* ══ FIL D'ACCUEIL ═════════════════════════════════════════════════ */}
        {!showNews && (
          <>
            <PullToRefreshContainer
              onRefresh={() => void loadFeed(true)}
              refreshing={refreshing}
              className="flex-1 min-h-0 min-w-0 h-full p-3 space-y-3"
            >
              <div className="mt-4">{storiesSection}</div>

              <button
                type="button"
                onClick={() => setShowNews(true)}
                className="w-full px-3 py-2 rounded-xl text-sm font-semibold text-amber-300 bg-amber-500/15 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 transition"
                aria-label="Voir l'actualité musicale"
              >
                Actualités
              </button>

              <div className="rounded-xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-3 space-y-2">
                    <p className="text-xs text-[var(--ms-text-muted)] font-medium uppercase tracking-wide">{t('feed.publish')}</p>
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_FORMATS}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void attachImageFromFile(file);
                      }}
                    />
                    <input
                      ref={videoFileInputRef}
                      type="file"
                      accept={ACCEPTED_FEED_VIDEO_FORMATS}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void attachVideoFromFile(file);
                      }}
                    />
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onPaste={handleComposePaste}
                      placeholder={t('feed.placeholder')}
                      title="Coller une image (Ctrl+V)"
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)] px-3 py-2 text-sm text-[var(--ms-text)] placeholder:text-[var(--ms-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ms-accent)]/50"
                    />

                    {/* ── Créer un événement ── */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isEvent}
                        onChange={(e) => {
                          setIsEvent(e.target.checked);
                          if (!e.target.checked) {
                            setEventDate('');
                            setEventDateDraft('');
                            setEventDateError(null);
                            setEventLocation('');
                            setEventType('autre');
                          }
                        }}
                        className="melosong-checkbox"
                        aria-label={t('feed.createEvent')}
                      />
                      <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {t('feed.createEvent')}
                      </span>
                    </label>

                    {isEvent && (
                      <div className="space-y-2 p-3 rounded-xl bg-purple-950/30 border border-purple-500/25">
                        <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">{t('feed.eventDetails')}</p>
                        <div>
                          <p className="block text-[10px] text-gray-300 mb-1.5">{t('feed.eventType')}</p>
                          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('feed.eventType')}>
                            {(
                              [
                                ['dance', t('feed.eventTypeDance')],
                                ['chant', t('feed.eventTypeChant')],
                                ['autre', t('feed.eventTypeAutre')],
                              ] as const
                            ).map(([value, label]) => (
                              <label
                                key={value}
                                className={`cursor-pointer select-none rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                                  eventType === value
                                    ? 'bg-purple-600/40 border-purple-400/60 text-purple-100'
                                    : 'bg-[#0b0b0f] border-[#2a2a3d] text-gray-400 hover:border-purple-500/40'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="eventType"
                                  value={value}
                                  checked={eventType === value}
                                  onChange={() => setEventType(value)}
                                  className="sr-only"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-300 mb-1">{t('feed.eventDate')} *</label>
                          <div className="flex gap-2 items-stretch">
                            <div className="relative flex-1 min-w-0">
                              <input
                                ref={eventDateInputRef}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder={t('feed.eventDatePlaceholder')}
                                aria-label={t('feed.eventDate')}
                                value={eventDateDraft}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEventDateDraft(value);
                                  setEventDateError(null);
                                  if (!value.trim()) setEventDate('');
                                }}
                                className={`w-full rounded-lg bg-[#0b0b0f] border px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 ${
                                  eventDateError
                                    ? 'border-red-500/60 focus:ring-red-500/40'
                                    : isEventDateConfirmed
                                      ? 'border-green-500/60 focus:ring-green-500/40 pr-9'
                                      : 'border-[#2a2a3d] focus:ring-purple-500/50'
                                }`}
                              />
                              {isEventDateConfirmed && (
                                <span
                                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-green-400"
                                  aria-hidden
                                >
                                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            {showEventDateValidate && (
                              <button
                                type="button"
                                onClick={confirmEventDate}
                                className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-purple-600/45 border border-purple-400/50 text-purple-100 hover:bg-purple-600/65 transition"
                              >
                                {t('feed.eventDateValidate')}
                              </button>
                            )}
                          </div>
                          {eventDateError && (
                            <p className="mt-1 text-[10px] text-red-400" role="alert">
                              {eventDateError}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-300 mb-1">{t('feed.eventLocation')} *</label>
                          <EventLocationInput
                            value={eventLocation}
                            onChange={setEventLocation}
                            profileCity={user?.city}
                          />
                        </div>
                      </div>
                    )}

                    {(imageUrl.trim() || imageAttaching) && (
                      <div className="flex items-start gap-2">
                        {imageUrl.trim() ? (
                          <img
                            src={imageUrl}
                            alt="Aperçu"
                            className="h-20 w-20 rounded-lg object-cover bg-[#1e1e2f] border border-[#2a2a3d] shrink-0"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-[#1e1e2f] border border-[#2a2a3d] animate-pulse shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[10px] text-gray-300">
                            {imageAttaching ? t('feed.preparingImage') : t('feed.imageAttached')}
                          </p>
                          {imageUrl.trim() && !imageAttaching && (
                            <button
                              type="button"
                              onClick={() => setImageUrl('')}
                              className="mt-1 text-[10px] font-semibold text-gray-500 hover:text-white"
                            >
                              {t('feed.removeImage')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {(videoUrl.trim() || videoAttaching) && (
                      <div className="flex items-start gap-2">
                        {videoUrl.trim() ? (
                          <video
                            src={videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="h-24 w-36 rounded-lg object-cover bg-[#1e1e2f] border border-[#2a2a3d] shrink-0"
                          />
                        ) : (
                          <div className="h-24 w-36 rounded-lg bg-[#1e1e2f] border border-[#2a2a3d] animate-pulse shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[10px] text-gray-300">
                            {videoAttaching ? t('feed.preparingVideo') : t('feed.videoAttached')}
                          </p>
                          {videoUrl.trim() && !videoAttaching && (
                            <button
                              type="button"
                              onClick={() => setVideoUrl('')}
                              className="mt-1 text-[10px] font-semibold text-gray-500 hover:text-white"
                            >
                              {t('feed.removeVideo')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-600">{draft.length}/2000</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={mediaAttaching || editorOpen || Boolean(videoUrl.trim())}
                          onClick={() => imageFileInputRef.current?.click()}
                          title={t('feed.attachImage')}
                          aria-label={t('feed.attachImage')}
                          className={`min-w-11 min-h-11 flex items-center justify-center p-1.5 rounded-lg transition disabled:opacity-40 ${
                            imageUrl.trim()
                              ? 'text-purple-300 bg-purple-900/40'
                              : 'text-[var(--ms-text-muted)] hover:text-gray-300 hover:bg-[var(--ms-surface-2)]'
                          }`}
                        >
                          <PhotoIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={mediaAttaching || editorOpen || Boolean(imageUrl.trim())}
                          onClick={() => videoFileInputRef.current?.click()}
                          title={t('feed.attachVideo')}
                          aria-label={t('feed.attachVideo')}
                          className={`min-w-11 min-h-11 flex items-center justify-center p-1.5 rounded-lg transition disabled:opacity-40 ${
                            videoUrl.trim()
                              ? 'text-purple-300 bg-purple-900/40'
                              : 'text-[var(--ms-text-muted)] hover:text-gray-300 hover:bg-[var(--ms-surface-2)]'
                          }`}
                        >
                          <VideoIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!canPublish || publishing || mediaAttaching || editorOpen}
                          onClick={() => void publish()}
                          className="min-h-11 rounded-lg bg-[var(--ms-accent)] hover:bg-purple-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {publishing ? t('feed.publishing') : t('feed.publish')}
                        </button>
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                  </div>

              {loading && posts.length === 0 && (
                <div className="space-y-3 py-2" aria-hidden="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3 space-y-3 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="w-11 h-11 rounded-full bg-[#1e1e2f] ms-skeleton shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-[#1e1e2f] rounded ms-skeleton w-1/3" />
                          <div className="h-2.5 bg-[#1e1e2f] rounded ms-skeleton w-1/4" />
                        </div>
                      </div>
                      <div className="h-3 bg-[#1e1e2f] rounded ms-skeleton w-full" />
                      <div className="h-3 bg-[#1e1e2f] rounded ms-skeleton w-4/5" />
                      <div className="h-28 bg-[#1e1e2f] rounded-lg ms-skeleton w-full" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && visiblePosts.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <p className="text-sm text-gray-300">
                    {posts.length === 0
                      ? 'Aucune publication de vos abonnements pour le moment.'
                      : 'Aucune publication ne correspond à vos filtres.'}
                  </p>
                  {posts.length === 0 ? (
                    <p className="text-xs text-[var(--ms-text-muted)] max-w-xs">
                      Suivez des artistes depuis la carte ou leurs profils pour remplir votre fil d&apos;accueil.
                    </p>
                  ) : null}
                </div>
              )}
              {visiblePosts.map((post, postIndex) => (
                <div key={post.id} className="space-y-3">
                  <PostCard
                    post={{
                      ...post,
                      resharedByMe: !!post.resharedByMe || linkSharedPostIds.has(post.id),
                    }}
                    onOpenAuthor={handlePostAuthorClick}
                    storiesByUser={feedStoriesByUser}
                    commentOpenPostId={commentOpenPostId}
                    commentDraft={commentDrafts[post.id] ?? ''}
                    onCommentDraftChange={(v: string) => setCommentDrafts((p) => ({ ...p, [post.id]: v }))}
                    fullComments={fullComments[post.id]}
                    commentsLoading={commentsLoading[post.id] ?? false}
                    commentPosting={commentPosting[post.id] ?? false}
                    onToggleLike={() => void handleLike(post)}
                    onToggleComments={() => void handleToggleComments(post)}
                    onPostComment={() => void handlePostComment(post.id)}
                    onReshare={() => void handleReshare(post)}
                    onShare={() => setSharePost(post)}
                    onToggleFavorite={() => void handleToggleFavorite(post)}
                  />
                  {postIndex === 0 ? (
                    <FeedInlineAdBanner
                      onCtaSalon={() => dispatchMapOpenCreateSalon()}
                      onCtaLive={onOpenLive ? () => onOpenLive('') : undefined}
                    />
                  ) : null}
                </div>
              ))}
              {!loading && visiblePosts.length === 0 ? (
                <FeedInlineAdBanner
                  onCtaSalon={() => dispatchMapOpenCreateSalon()}
                  onCtaLive={onOpenLive ? () => onOpenLive('') : undefined}
                />
              ) : null}
            </PullToRefreshContainer>
          </>
        )}

        {/* ══ ACTUALITÉS (news) ══════════════════════════════════════════════ */}
        {showNews && (
          <ActualitesContent
            newsItems={newsItems}
            newsLoading={newsLoading}
            newsError={newsError}
            onRefresh={() => {
              void loadNews(true);
              void loadFeed(true);
              void loadCommunityEvents();
              void loadCountryEvents();
              void loadTrendingUsers();
              void loadFeaturedUserSounds();
            }}
            refreshing={newsRefreshing}
            onBack={() => setShowNews(false)}
            onOpenProfile={onOpenProfile}
            onOpenAuthor={handlePostAuthorClick}
            onShareEvent={setSharePost}
            communityEvents={communityEvents}
            communityEventsLoading={communityEventsLoading}
            trendingUsers={trendingUsers}
            trendingLoading={trendingLoading}
            countryCode={countryCode}
            countryName={countryName}
            countryEventPosts={countryEventPosts}
            countryEventsLoading={countryEventsLoading}
            featuredUserSounds={featuredUserSounds}
            featuredUserSoundsLoading={featuredUserSoundsLoading}
            onOpenReel={onOpenReel}
            onOpenSalon={onOpenSalon}
          />
        )}

      </div>

      {editorOpen ? (
        <Suspense fallback={null}>
          <PhotoImageEditor
            mode="feed"
            initialImage={editorPreviewUrl!}
            initialSource={editorSource!}
            onConfirm={(result) => void onFeedEditorConfirm(result.imageUrl)}
            onCancel={onFeedEditorCancel}
          />
        </Suspense>
      ) : null}

      {/* ── Share sheet ── */}
      {sharePost && shareUrl && !shareToUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setSharePost(null)}
          url={shareUrl}
          title={sharePayload?.title}
          text={sharePayload?.text}
          onToast={showToast}
          onShared={handleFeedPostLinkShared}
          onSendToUser={token ? () => setShareToUserOpen(true) : undefined}
        />
      )}

      {sharePost && shareUrl && shareToUserOpen && token ? (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setSharePost(null);
          }}
          token={token}
          shareUrl={shareUrl}
          shareText={sharePayload?.text}
          onToast={showToast}
          onSent={handleFeedPostLinkShared}
        />
      ) : null}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}

      {feedStorySheet.kind === 'view' && feedViewerStack ? (
        <StoryViewer
          story={feedStorySheet.story}
          stack={feedViewerStack.stories}
          stackIndex={feedViewerStackIndex}
          onClose={() => setFeedStorySheet({ kind: 'closed' })}
          onNext={goNextFeedStory}
          onPrev={goPrevFeedStory}
          canNext={canNextFeedStory}
          canPrev={canPrevFeedStory}
          isOwn={feedStorySheet.isOwn}
          token={token ?? undefined}
          onDeleted={handleFeedStoryDeleted}
        />
      ) : null}
    </div>
  );
}
