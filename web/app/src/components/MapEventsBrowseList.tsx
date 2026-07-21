import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EventsCarousel } from './EventsCarousel';
import { EventDayPinIcon } from './EventDayPinIcon';
import { formatEventDateShort } from '../lib/feedEvents';
import { getMapEventBrowseDayIndex } from '../lib/mapEventDayColors';
import {
  countryEventCategoryEmoji,
  type FeedPostsByCategoryGroup,
} from '../lib/mapEventBrowseCategories';
import type { FeedPostsByDayGroup } from '../lib/feedEvents';
import type { MapEventsBrowseTab } from '../hooks/useMapEventsBrowseData';
import type { FeedPost } from '../types';

function SectionHeader({
  label,
  dayIndex,
  dayKey,
  selectedDayKey,
  onDayKeySelect,
  emoji,
  subtitle,
  compact = false,
}: {
  label: string;
  dayIndex?: number;
  dayKey?: string;
  selectedDayKey?: string | null;
  onDayKeySelect?: (dayKey: string) => void;
  emoji?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const pinInteractive = Boolean(dayKey && onDayKeySelect);
  const pinSelected = pinInteractive && selectedDayKey === dayKey;

  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${compact ? 'px-0.5' : 'px-1'}`}>
      {emoji ? (
        <span className={`leading-none shrink-0 ${compact ? 'text-sm' : 'text-base'}`}>{emoji}</span>
      ) : pinInteractive ? (
        <button
          type="button"
          onClick={() => onDayKeySelect!(dayKey!)}
          aria-pressed={pinSelected}
          aria-label={
            pinSelected
              ? t('map.eventsDayPinFilterClear', { day: label })
              : t('map.eventsDayPinFilter', { day: label })
          }
          title={
            pinSelected
              ? t('map.eventsDayPinFilterClear', { day: label })
              : t('map.eventsDayPinFilter', { day: label })
          }
          className={`shrink-0 w-11 h-11 -my-2 flex items-center justify-center rounded-lg transition touch-manipulation ${
            pinSelected
              ? 'ring-2 ring-purple-500/80 bg-purple-500/15'
              : 'hover:bg-white/5 active:bg-white/10'
          }`}
        >
          <EventDayPinIcon dayIndex={dayIndex ?? 0} className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      ) : (
        <EventDayPinIcon
          dayIndex={dayIndex ?? 0}
          className={`shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
        />
      )}
      <h3
        className={`font-bold text-gray-300 tracking-wide uppercase ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {label}
      </h3>
      {subtitle ? (
        <span
          className={`text-gray-500 font-normal normal-case tracking-normal ${
            compact ? 'text-[9px] line-clamp-1' : 'text-[10px] max-[374px]:text-[11px]'
          }`}
        >
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

function formatDaySectionLong(dayKey: string, locale: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function getDaySectionHeader(
  dayKey: string,
  locale: string,
  t: TFunction
): { label: string; subtitle?: string } {
  const today = new Date().toLocaleDateString('en-CA');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
  const longDate = formatDaySectionLong(dayKey, locale);

  if (dayKey === today) {
    return { label: t('map.eventsDayToday'), subtitle: longDate };
  }
  if (dayKey === tomorrowStr) {
    return { label: t('map.eventsDayTomorrow'), subtitle: longDate };
  }
  return { label: formatEventDateShort(`${dayKey}T12:00:00`), subtitle: longDate };
}

export interface MapEventsBrowseListProps {
  variant?: 'sheet' | 'sidebar';
  activeTab: MapEventsBrowseTab;
  onTabChange: (tab: MapEventsBrowseTab) => void;
  communityEvents: FeedPost[];
  countryUpcoming: FeedPost[];
  /** Compteurs alignés sur les sections jour affichées (pas le total filtré hors fenêtre). */
  communityEventsVisibleCount: number;
  countryEventsVisibleCount: number;
  activeLoading: boolean;
  eventsByDay: FeedPostsByDayGroup[];
  /** Onglet Pays : regroupement Concert / Festivals / Artistique. */
  countryEventsByCategory: FeedPostsByCategoryGroup[];
  sectionEmoji: string;
  displayCountryName: string;
  countrySectionEmoji: string;
  onOpenPost: (post: FeedPost) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
  /** Jour sélectionné pour filtrer carte/globe (pin cliquable). */
  selectedMapEventDayKey?: string | null;
  onMapEventDayKeySelect?: (dayKey: string) => void;
  /** Événements sponsorisés (section Sponso en tête de liste). */
  sponsoredEventPosts?: FeedPost[];
}

function SponsoBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/35 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
      {t('map.sidebarSponsoBadge')}
    </span>
  );
}

function SponsoBrowseSection({
  posts,
  onOpenPost,
  onPostChange,
  compact,
}: {
  posts: FeedPost[];
  onOpenPost: (post: FeedPost) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
  compact: boolean;
}) {
  const { t } = useTranslation();
  if (posts.length === 0) return null;

  return (
    <div className="space-y-2 min-w-0">
      <SectionHeader label={t('map.sidebarSponsoCategory')} emoji="✨" compact={compact} />
      <EventsCarousel
        posts={posts}
        onOpen={onOpenPost}
        onPostChange={onPostChange}
        size={compact ? 'sidebar' : 'compact'}
        getExtraBadges={() => <SponsoBadge />}
      />
    </div>
  );
}

function excludePostsById(posts: FeedPost[], excludedIds: ReadonlySet<string>): FeedPost[] {
  if (excludedIds.size === 0) return posts;
  return posts.filter((post) => !excludedIds.has(post.id));
}

export function MapEventsBrowseList({
  variant = 'sheet',
  activeTab,
  onTabChange,
  communityEvents,
  countryUpcoming,
  communityEventsVisibleCount,
  countryEventsVisibleCount,
  activeLoading,
  eventsByDay,
  countryEventsByCategory,
  sectionEmoji: _sectionEmoji,
  displayCountryName,
  countrySectionEmoji,
  onOpenPost,
  onPostChange,
  selectedMapEventDayKey,
  onMapEventDayKeySelect,
  sponsoredEventPosts = [],
}: MapEventsBrowseListProps) {
  const { t, i18n } = useTranslation();
  const isSidebar = variant === 'sidebar';
  const activePosts = activeTab === 'around' ? communityEvents : countryUpcoming;
  const sponsoredIds = useMemo(
    () => new Set(sponsoredEventPosts.map((post) => post.id)),
    [sponsoredEventPosts]
  );
  const filteredEventsByDay = useMemo(
    () =>
      eventsByDay.map(({ dayKey, posts }) => ({
        dayKey,
        posts: excludePostsById(posts, sponsoredIds),
      })),
    [eventsByDay, sponsoredIds]
  );
  const filteredCountryEventsByCategory = useMemo(
    () =>
      countryEventsByCategory.map(({ category, posts }) => ({
        category,
        posts: excludePostsById(posts, sponsoredIds),
      })),
    [countryEventsByCategory, sponsoredIds]
  );

  const countryCategoryLabel = (category: FeedPostsByCategoryGroup['category']) => {
    switch (category) {
      case 'concert':
        return t('map.eventsBrowseCategoryConcert', 'Concert');
      case 'festivals':
        return t('map.eventsBrowseCategoryFestivals', 'Festivals');
      case 'artistique':
        return t('map.eventsBrowseCategoryArtistique', 'Artistique');
    }
  };

  return (
    <div className={isSidebar ? 'min-w-0' : 'mt-4 space-y-4 min-w-0'}>
      <div
        className={
          isSidebar
            ? 'px-2 pb-2 border-b border-[var(--ms-border)]/80'
            : 'shrink-0 px-3 py-2 border-b border-white/10 -mx-3 mb-4'
        }
        role="tablist"
        aria-label={t('map.eventsBrowseTabsAria')}
      >
        <div
          className={`grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0b0b0f] border border-[#1e1e2f] ${
            isSidebar ? 'text-[10px]' : ''
          }`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'around'}
            onClick={() => onTabChange('around')}
            className={`min-h-[44px] px-1.5 py-1.5 rounded-lg transition flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'around'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold">
              <span aria-hidden>📍</span>
              <span>{t('map.eventsBrowseAroundTab')}</span>
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded-full tabular-nums ${
                  activeTab === 'around' ? 'bg-white/20' : 'bg-[#1a1a26] text-gray-500'
                }`}
              >
                {communityEventsVisibleCount}
              </span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'country'}
            onClick={() => onTabChange('country')}
            className={`min-h-[44px] px-1.5 py-1.5 rounded-lg transition flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'country'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold min-w-0">
              <span aria-hidden>{countrySectionEmoji}</span>
              <span className="truncate">{displayCountryName}</span>
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded-full tabular-nums shrink-0 ${
                  activeTab === 'country' ? 'bg-white/20' : 'bg-[#1a1a26] text-gray-500'
                }`}
              >
                {countryEventsVisibleCount}
              </span>
            </span>
            <span className={`text-[9px] ${activeTab === 'country' ? 'text-purple-100/80' : 'text-gray-600'}`}>
              {t('map.eventsBrowseCountryScope')}
            </span>
          </button>
        </div>
      </div>

      {activeLoading && activePosts.length === 0 ? (
        <div className={`space-y-4 ${isSidebar ? 'px-2 py-3' : ''}`}>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 min-w-0 animate-pulse">
              <div className="h-3 w-28 rounded bg-[#1a1a26] mx-0.5" />
              <div className={`rounded-xl bg-[#1a1a26] ${isSidebar ? 'h-[7.5rem]' : 'h-36'}`} />
            </div>
          ))}
        </div>
      ) : activeTab === 'country' ? (
        <div className={`space-y-3 min-w-0 ${isSidebar ? 'px-2 py-2' : ''}`}>
          <SponsoBrowseSection
            posts={sponsoredEventPosts}
            onOpenPost={onOpenPost}
            onPostChange={onPostChange}
            compact={isSidebar}
          />
          {filteredCountryEventsByCategory.map(({ category, posts }) => (
            <div key={category} className="space-y-2 min-w-0">
              <SectionHeader
                label={countryCategoryLabel(category)}
                emoji={countryEventCategoryEmoji(category)}
                compact={isSidebar}
              />
              {posts.length === 0 ? (
                <p className="text-[10px] text-gray-500 px-0.5">{t('map.eventsDayEmpty')}</p>
              ) : (
                <EventsCarousel
                  posts={posts}
                  onOpen={onOpenPost}
                  onPostChange={onPostChange}
                  size={isSidebar ? 'sidebar' : 'compact'}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`space-y-3 min-w-0 ${isSidebar ? 'px-2 py-2' : ''}`}>
          <SponsoBrowseSection
            posts={sponsoredEventPosts}
            onOpenPost={onOpenPost}
            onPostChange={onPostChange}
            compact={isSidebar}
          />
          {filteredEventsByDay.map(({ dayKey, posts }, dayIndex) => {
            const { label, subtitle } = getDaySectionHeader(dayKey, i18n.language, t);
            const browseDayIndex = getMapEventBrowseDayIndex(dayKey);
            const resolvedDayIndex = browseDayIndex >= 0 ? browseDayIndex : dayIndex;
            return (
              <div key={dayKey} className="space-y-2 min-w-0">
                <SectionHeader
                  label={label}
                  dayKey={dayKey}
                  dayIndex={resolvedDayIndex}
                  selectedDayKey={selectedMapEventDayKey}
                  onDayKeySelect={onMapEventDayKeySelect}
                  subtitle={subtitle}
                  compact={isSidebar}
                />
                {posts.length === 0 ? (
                  <p className="text-[10px] text-gray-500 px-0.5">{t('map.eventsDayEmpty')}</p>
                ) : (
                  <EventsCarousel
                    posts={posts}
                    onOpen={onOpenPost}
                    onPostChange={onPostChange}
                    size={isSidebar ? 'sidebar' : 'compact'}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
