import { memo, useMemo, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  countMapSidebarItems,
  countEventsSidebarItems,
  countSalonsSidebarItems,
  mapDetailTierLabel,
  type MapSidebarContent,
} from '../lib/mapSidebarContent';
import type { MapViewDetailState } from '../lib/mapMarkerVisibility';
import type { MapEventFilterCriteria } from '../lib/mapEventFilter';
import { MapEventsBrowseList } from './MapEventsBrowseList';
import { useMapEventsBrowseData } from '../hooks/useMapEventsBrowseData';
import { PlatformListeningIcon } from './PlatformListeningIcon';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { formatCompactCount } from '../lib/formatCount';
import type { FeedPost, Live, MapEventMarker, NearbyPerson, Salon } from '../types';
import { MapEventRow } from './MapCityEventsPanel';
import { EventsCarousel } from './EventsCarousel';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

export interface MapSidebarEventsBrowseConfig {
  token: string;
  profileCity?: string;
  favoriteAuthorIds?: ReadonlySet<string>;
  eventsFilterOn: boolean;
  filterCriteria?: MapEventFilterCriteria;
  /** Sheet filtre « Appliquer » — sinon browse = 3 jours + Sponso. */
  eventFilterCustomized?: boolean;
  viewerId?: string;
  /** Événements filtre carte (rayon fixe) pour l’onglet Autour. */
  aroundEventPosts?: FeedPost[];
  /** Clic carte sidebar : zoom carte uniquement (sans modal). */
  onZoomEventOnMap?: (post: FeedPost) => void;
  /** Feuille browse « Voir sur la carte » : zoom + modal détail. */
  onOpenEvent?: (post: FeedPost) => void;
  /** Feuille browse : modal détail sans recentrage (fallback). */
  onOpenEventDetail?: (post: FeedPost) => void;
  onOpenInFeed?: (postId: string) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
  selectedMapEventDayKey?: string | null;
  onMapEventDayKeySelect?: (dayKey: string) => void;
}

function MapSidebarSponsoSection({
  posts,
  onOpen,
  onPostChange,
  retracted,
  onToggleRetracted,
}: {
  posts: FeedPost[];
  onOpen?: (post: FeedPost) => void;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
  retracted: boolean;
  onToggleRetracted: () => void;
}) {
  const { t } = useTranslation();
  if (posts.length === 0) return null;

  return (
    <li className="border-b border-[var(--ms-border)]/80 list-none">
      <CollapsibleSectionHeader
        label={t('map.sidebarSponsoCategory', { defaultValue: 'Sponso' })}
        count={posts.length}
        retracted={retracted}
        onToggle={onToggleRetracted}
      />
      {!retracted ? (
        <div className="px-1.5 sm:px-2 pb-2 min-w-0">
          <EventsCarousel
            posts={posts}
            size="sidebar"
            sponsoredVisual
            onOpen={(post) => onOpen?.(post)}
            onPostChange={onPostChange}
          />
        </div>
      ) : null}
    </li>
  );
}

interface NearbyPeoplePanelProps {
  content: MapSidebarContent;
  detail: MapViewDetailState;
  loading?: boolean;
  eventsLoading?: boolean;
  layout?: 'side' | 'bottom';
  selectedSalonId?: string | null;
  onHide?: () => void;
  onSalonClick?: (salon: Salon) => void;
  onLiveClick?: (live: Live) => void;
  onEventClick?: (event: MapEventMarker) => void;
  onPersonClick?: (person: NearbyPerson) => void;
  eventsFilterOn?: boolean;
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
  /** Filtre Événement actif — même liste que la popup browse. */
  eventsBrowseMode?: boolean;
  eventsBrowse?: MapSidebarEventsBrowseConfig;
  /** Événements sponsorisés (carrousel Sponso). */
  sponsoredEventPosts?: FeedPost[];
  onSponsoredEventOpen?: (post: FeedPost) => void;
  onSponsoredEventPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
}

function CollapsibleSectionHeader({
  label,
  count,
  retracted,
  onToggle,
}: {
  label: string;
  count: number;
  retracted: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-[var(--ms-border)]/80">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!retracted}
        aria-label={
          retracted
            ? t('map.sidebarExpandCategory', { label, defaultValue: `Déplier ${label}` })
            : t('map.sidebarCollapseCategory', { label, defaultValue: `Replier ${label}` })
        }
        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1.5 text-left hover:bg-[var(--ms-surface-elevated)] transition"
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {count > 0 ? (
            <span className="text-[9px] font-semibold tabular-nums text-purple-400/80">{count}</span>
          ) : null}
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${retracted ? '' : 'rotate-180'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
    </li>
  );
}

const SIDEBAR_SECTION_PAGE_SIZE = 5;

/** Lignes profil compactes (panneau latéral étroit). */
const SIDEBAR_PROFILE_ROW = 'w-full flex items-center gap-1 px-2 py-1 transition text-left';
const SIDEBAR_ROW_NAME = 'text-[10px] font-semibold truncate leading-tight';
const SIDEBAR_ROW_META = 'text-[9px] truncate leading-tight';

function ShowMoreRow({
  mode,
  hiddenCount,
  onClick,
  disabled = false,
}: {
  mode: 'more' | 'less';
  hiddenCount?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] text-[10px] font-semibold text-purple-400/90 hover:text-purple-300 py-1.5 px-1 transition disabled:opacity-35 disabled:pointer-events-none ${
        mode === 'less' ? 'text-right shrink-0' : 'text-left min-w-0'
      }`}
    >
      {mode === 'less'
        ? t('map.sidebarShowLess', { defaultValue: 'Afficher moins' })
        : t('map.sidebarShowMore', {
            count: hiddenCount ?? 0,
            defaultValue: `Afficher plus (${hiddenCount ?? 0})`,
          })}
    </button>
  );
}

function SectionPaginationControls({
  total,
  visibleCount,
  onShowMore,
  onCollapse,
}: {
  total: number;
  visibleCount: number;
  onShowMore: () => void;
  onCollapse: () => void;
}) {
  if (total <= SIDEBAR_SECTION_PAGE_SIZE) return null;
  const clampedVisible = Math.min(visibleCount, total);
  const hiddenCount = total - clampedVisible;
  const canCollapse = clampedVisible > SIDEBAR_SECTION_PAGE_SIZE;

  return (
    <li className="px-2 sm:px-2.5 py-0.5 flex flex-row items-center justify-between gap-2 border-t border-[var(--ms-border)]/40 mt-0.5">
      <ShowMoreRow
        mode="more"
        hiddenCount={hiddenCount}
        onClick={onShowMore}
        disabled={hiddenCount <= 0}
      />
      <ShowMoreRow mode="less" onClick={onCollapse} disabled={!canCollapse} />
    </li>
  );
}

function CollapsibleSidebarSection<T>({
  label,
  items,
  visibleCount,
  onShowMore,
  onCollapse,
  renderItem,
  emptyText,
  retracted,
  onToggleRetracted,
}: {
  label?: string;
  items: T[];
  visibleCount: number;
  onShowMore: () => void;
  onCollapse: () => void;
  renderItem: (item: T) => ReactNode;
  emptyText?: string;
  retracted: boolean;
  onToggleRetracted: () => void;
}) {
  const header =
    label != null ? (
      <CollapsibleSectionHeader
        label={label}
        count={items.length}
        retracted={retracted}
        onToggle={onToggleRetracted}
      />
    ) : null;

  if (items.length === 0) {
    if (!label) return null;
    return (
      <>
        {header}
        {!retracted && emptyText ? (
          <li className="px-2.5 sm:px-3 py-2 text-[10px] text-gray-500 leading-snug">{emptyText}</li>
        ) : null}
      </>
    );
  }

  if (retracted) {
    return <>{header}</>;
  }

  const clampedVisible = Math.min(visibleCount, items.length);
  const visibleItems = items.slice(0, clampedVisible);

  return (
    <>
      {header}
      {visibleItems.map((item) => renderItem(item))}
      <SectionPaginationControls
        total={items.length}
        visibleCount={clampedVisible}
        onShowMore={onShowMore}
        onCollapse={onCollapse}
      />
    </>
  );
}

const SalonSidebarRow = memo(function SalonSidebarRow({
  salon,
  active,
  onSelect,
}: {
  salon: Salon;
  active: boolean;
  onSelect: () => void;
}) {
  const listenerCount = Math.max(0, salon.listenersCount ?? 0);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`${SIDEBAR_PROFILE_ROW} ${
          active
            ? 'bg-fuchsia-900/30 border-l-2 border-fuchsia-500'
            : 'hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent'
        }`}
      >
        <UserAvatarOnline
          userId={salon.hostId}
          username={salon.hostName}
          avatarUrl={salon.hostAvatarUrl}
          size="xs"
          isLive={salon.isLive}
          liveViewersCount={salon.isLive && listenerCount > 0 ? listenerCount : undefined}
        />
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={salon.hostName}
            usernameColor={salon.hostUsernameColor}
            usernameWaveFrom={salon.hostUsernameWaveFrom}
            usernameWaveTo={salon.hostUsernameWaveTo}
            className={SIDEBAR_ROW_NAME}
          />
          <p className={`${SIDEBAR_ROW_META} text-fuchsia-300/90 truncate`}>{salon.title}</p>
        </div>
        {listenerCount > 0 ? (
          <span
            className="shrink-0 text-[9px] sm:text-[10px] font-semibold tabular-nums text-fuchsia-200/90"
            title={`${listenerCount} participant${listenerCount !== 1 ? 's' : ''}`}
            aria-label={`${listenerCount} participant${listenerCount !== 1 ? 's' : ''}`}
          >
            {formatCompactCount(listenerCount)} 🎧
          </span>
        ) : null}
      </button>
    </li>
  );
});

const LiveSidebarRow = memo(function LiveSidebarRow({
  live,
  onSelect,
}: {
  live: Live;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`${SIDEBAR_PROFILE_ROW} hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-red-500/40`}
      >
        <UserAvatarOnline
          userId={live.hostId}
          username={live.hostName}
          size="xs"
          isLive
          liveViewersCount={live.viewersCount}
        />
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={live.hostName}
            usernameColor={live.hostUsernameColor}
            usernameWaveFrom={live.hostUsernameWaveFrom}
            usernameWaveTo={live.hostUsernameWaveTo}
            className={SIDEBAR_ROW_NAME}
          />
          <p className={`${SIDEBAR_ROW_META} text-red-300/90`}>{live.title}</p>
        </div>
      </button>
    </li>
  );
});

const PersonSidebarRow = memo(function PersonSidebarRow({
  person,
  onSelect,
}: {
  person: NearbyPerson;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`${SIDEBAR_PROFILE_ROW} hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-red-500/40`}
      >
        <span className="relative shrink-0">
          <UserAvatarOnline
            userId={person.id}
            username={person.username}
            avatarUrl={person.avatarUrl}
            size="xs"
            isLive={person.isLive}
            liveViewersCount={person.isLive ? person.liveViewersCount : undefined}
          />
          {person.listeningPlatform && (
            <span className="absolute -top-0.5 -left-0.5 z-10 scale-75 origin-top-left">
              <PlatformListeningIcon platform={person.listeningPlatform} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={person.username}
            usernameColor={person.usernameColor}
            usernameWaveFrom={person.usernameWaveFrom}
            usernameWaveTo={person.usernameWaveTo}
            className={SIDEBAR_ROW_NAME}
          />
          <p className={`${SIDEBAR_ROW_META} text-gray-500`}>
            {person.distanceKm != null ? `${person.distanceKm} km` : person.city || 'En direct'}
          </p>
        </div>
      </button>
    </li>
  );
});

export const NearbyPeoplePanel = memo(function NearbyPeoplePanel({
  content,
  detail,
  loading = false,
  eventsLoading = false,
  layout = 'bottom',
  selectedSalonId,
  onHide,
  onSalonClick,
  onLiveClick,
  onEventClick,
  onPersonClick,
  eventsFilterOn = false,
  livesFilterOn = false,
  salonFilterOn = false,
  eventsBrowseMode = false,
  eventsBrowse,
  sponsoredEventPosts = [],
  onSponsoredEventOpen,
  onSponsoredEventPostChange,
}: NearbyPeoplePanelProps) {
  const { t } = useTranslation();
  const isBottom = layout === 'bottom';
  const showEventsBrowseList = eventsBrowseMode && Boolean(eventsBrowse?.token);

  const browse = useMapEventsBrowseData({
    enabled: showEventsBrowseList,
    token: eventsBrowse?.token ?? '',
    profileCity: eventsBrowse?.profileCity,
    favoriteAuthorIds: eventsBrowse?.favoriteAuthorIds,
    eventsFilterOn: eventsBrowse?.eventsFilterOn,
    filterCriteria: eventsBrowse?.filterCriteria,
    eventFilterCustomized: eventsBrowse?.eventFilterCustomized,
    aroundEventPosts: eventsBrowse?.aroundEventPosts,
    viewerId: eventsBrowse?.viewerId,
    onPostChange: eventsBrowse?.onPostChange,
  });

  useEffect(() => {
    if (detail.mapStyle === 'globe' && browse.activeTab !== 'around') {
      browse.setActiveTab('around');
    }
  }, [detail.mapStyle, browse.activeTab, browse.setActiveTab]);

  const handleBrowsePostChange = useCallback(
    (postId: string, patch: Partial<FeedPost>) => {
      browse.handlePostChange(postId, patch);
    },
    [browse]
  );
  const [sectionVisibleCounts, setSectionVisibleCounts] = useState<Record<string, number>>({});
  const [retractedSections, setRetractedSections] = useState<Record<string, boolean>>({});
  const getSectionVisibleCount = useCallback(
    (key: string, total: number) =>
      Math.min(sectionVisibleCounts[key] ?? SIDEBAR_SECTION_PAGE_SIZE, total),
    [sectionVisibleCounts]
  );
  const showMoreInSection = useCallback((key: string, total: number) => {
    setSectionVisibleCounts((prev) => {
      const current = prev[key] ?? SIDEBAR_SECTION_PAGE_SIZE;
      return { ...prev, [key]: Math.min(current + SIDEBAR_SECTION_PAGE_SIZE, total) };
    });
  }, []);
  const collapseSection = useCallback((key: string) => {
    setSectionVisibleCounts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  const isSectionRetracted = useCallback(
    (key: string) => retractedSections[key] === true,
    [retractedSections]
  );
  const toggleSectionRetracted = useCallback((key: string) => {
    setRetractedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const sectionProps = useCallback(
    (key: string, total: number) => ({
      visibleCount: getSectionVisibleCount(key, total),
      onShowMore: () => showMoreInSection(key, total),
      onCollapse: () => collapseSection(key),
      retracted: isSectionRetracted(key),
      onToggleRetracted: () => toggleSectionRetracted(key),
    }),
    [collapseSection, getSectionVisibleCount, isSectionRetracted, showMoreInSection, toggleSectionRetracted]
  );
  const itemCount = countMapSidebarItems(content);
  const liveCount = useMemo(
    () =>
      new Set([
        ...content.livesFollowing.map((l) => l.id),
        ...content.lives.map((l) => l.id),
        ...content.livesSuggestions.map((l) => l.id),
      ]).size,
    [content.livesFollowing, content.lives, content.livesSuggestions]
  );
  const salonCount = useMemo(() => countSalonsSidebarItems(content), [content]);
  const eventCount = useMemo(
    () => (showEventsBrowseList ? browse.activePosts.length : countEventsSidebarItems(content)),
    [showEventsBrowseList, browse.activePosts.length, content]
  );
  const showCategoryPanels = livesFilterOn || salonFilterOn;
  const showFollowingOnlyPanel = content.noFilters;
  const eventsFollowingEmptyText = t('map.sidebarEventsFollowingEmpty', {
    defaultValue: 'Aucun événement suivi ou enregistré.',
  });
  const followingEmptyText = t('map.sidebarFollowingEmpty', { defaultValue: 'Aucun contenu suivi.' });
  const suggestionsEmptyText = t('map.sidebarSuggestionsEmpty', { defaultValue: 'Aucune suggestion.' });
  const livesInViewEmptyText = content.zoomTooWide
    ? t('map.sidebarLivesZoomHint', { defaultValue: 'Zoomez pour voir les lives dans cette zone.' })
    : t('map.sidebarLivesEmpty', { defaultValue: 'Aucun live dans cette zone.' });
  const salonsInViewEmptyText = t('map.sidebarSalonsEmpty', { defaultValue: 'Aucun salon dans cette zone.' });

  const summaryParts: string[] = [];
  if (eventCount > 0) {
    summaryParts.push(`${eventCount} événement${eventCount !== 1 ? 's' : ''}`);
  }
  if (liveCount > 0) {
    summaryParts.push(`${liveCount} live${liveCount !== 1 ? 's' : ''}`);
  }
  if (salonCount > 0) {
    summaryParts.push(`${salonCount} salon${salonCount !== 1 ? 's' : ''}`);
  }
  if (content.people.length > 0) {
    summaryParts.push(`${content.people.length} personne${content.people.length !== 1 ? 's' : ''}`);
  }

  const emptyMessage = () => {
    if (content.noFilters) {
      return t('map.sidebarNoFiltersFollowingEmpty', {
        defaultValue:
          'Aucun live, salon ou événement suivi. Activez Lives, Salon ou Évènement pour explorer la carte.',
      });
    }
    if (content.zoomTooWide) {
      if (livesFilterOn && !salonFilterOn && !eventsFilterOn) {
        if (content.livesFollowing.length > 0 || content.livesSuggestions.length > 0) {
          return 'Zoomez pour voir les lives dans cette zone.';
        }
        return 'Zoomez pour voir les lives.';
      }
      if (salonFilterOn && !livesFilterOn && !eventsFilterOn) {
        return 'Zoomez sur une ville pour voir les salons dans cette zone.';
      }
      return 'Zoomez sur une ville pour voir les lives et salons dans cette zone.';
    }
    if (eventsLoading) return 'Chargement des événements…';
    if (loading) return 'Chargement…';
    return 'Aucun résultat dans cette zone pour les filtres actifs.';
  };

  return (
    <aside
      className={
        isBottom
          ? 'ms-map-sidebar-panel shrink-0 w-full max-h-[min(52dvh,22rem)] sm:max-h-[min(58vh,28rem)] flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-t border-[var(--ms-border)] z-20'
          : showEventsBrowseList
            ? 'ms-map-sidebar-panel shrink-0 w-[min(92vw,22rem)] min-w-[16rem] sm:w-72 flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-r border-[var(--ms-border)] z-20'
            : 'ms-map-sidebar-panel shrink-0 w-[min(38vw,10.5rem)] min-w-[7.5rem] sm:w-56 flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-r border-[var(--ms-border)] z-20'
      }
    >
      <div className="shrink-0 px-2.5 sm:px-3 py-2.5 border-b border-[var(--ms-border)]">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h2 className={`text-xs font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
              {isBottom ? 'Liste carte' : 'Carte'}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {mapDetailTierLabel(detail.tier)}
              {summaryParts.length > 0 ? ` · ${summaryParts.join(' · ')}` : loading ? ' · …' : ''}
            </p>
          </div>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              title="Masquer la liste"
              aria-label="Masquer la liste carte"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)] shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.8 7.8C5.6 9.8 4 12.4 4 15a8 8 0 0 0 8 8c2.6 0 5.2-1.6 7.2-3.8M14.2 14.2c2.2-2 3.8-4.6 3.8-7.2a8 8 0 0 0-8-8c-2.6 0-5.2 1.6-7.2 3.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <ul className="flex-1 min-h-0 overflow-y-auto py-1">
          {!showEventsBrowseList && sponsoredEventPosts.length > 0 ? (
            <MapSidebarSponsoSection
              posts={sponsoredEventPosts}
              onOpen={onSponsoredEventOpen}
              onPostChange={onSponsoredEventPostChange}
              retracted={isSectionRetracted('sponso')}
              onToggleRetracted={() => toggleSectionRetracted('sponso')}
            />
          ) : null}
          {showEventsBrowseList ? (
            <li className="list-none min-w-0">
              <MapEventsBrowseList
                variant="sidebar"
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
                onOpenPost={(post) => {
                  if (eventsBrowse?.onZoomEventOnMap) {
                    eventsBrowse.onZoomEventOnMap(post);
                    return;
                  }
                  if (eventsBrowse?.onOpenEvent) {
                    eventsBrowse.onOpenEvent(post);
                    return;
                  }
                  eventsBrowse?.onOpenEventDetail?.(post);
                }}
                onPostChange={handleBrowsePostChange}
                selectedMapEventDayKey={eventsBrowse?.selectedMapEventDayKey}
                onMapEventDayKeySelect={eventsBrowse?.onMapEventDayKeySelect}
                sponsoredEventPosts={sponsoredEventPosts}
                hideScopeTabs={detail.mapStyle === 'globe'}
              />
            </li>
          ) : null}
        {itemCount === 0 && !showCategoryPanels && !showEventsBrowseList && !showFollowingOnlyPanel ? (
          <li className="px-2 sm:px-3 py-6 text-center text-[10px] text-gray-500 leading-snug">
            {emptyMessage()}
          </li>
        ) : (
          <>
            {showFollowingOnlyPanel && !showEventsBrowseList && (
              <>
                <CollapsibleSidebarSection
                  label={t('map.sidebarEventsFollowing', { defaultValue: 'Événement suivi' })}
                  items={content.eventsFollowing}
                  emptyText={eventsFollowingEmptyText}
                  {...sectionProps('nfEventsFollowing', content.eventsFollowing.length)}
                  renderItem={(event) => (
                    <MapEventRow
                      key={`nf-event-${event.id}`}
                      event={event}
                      compact
                      onSelect={() => onEventClick?.(event)}
                    />
                  )}
                />
                <CollapsibleSidebarSection
                  label={t('map.sidebarLivesFollowing', { defaultValue: 'Live suivi' })}
                  items={content.livesFollowing}
                  emptyText={followingEmptyText}
                  {...sectionProps('nfLivesFollowing', content.livesFollowing.length)}
                  renderItem={(live) => (
                    <LiveSidebarRow
                      key={`nf-live-${live.id}`}
                      live={live}
                      onSelect={() => onLiveClick?.(live)}
                    />
                  )}
                />
                <CollapsibleSidebarSection
                  label={t('map.sidebarSalonsFollowing', { defaultValue: 'Salon suivi' })}
                  items={content.salonsFollowing}
                  emptyText={followingEmptyText}
                  {...sectionProps('nfSalonsFollowing', content.salonsFollowing.length)}
                  renderItem={(salon) => (
                    <SalonSidebarRow
                      key={`nf-salon-${salon.id}`}
                      salon={salon}
                      active={salon.id === selectedSalonId}
                      onSelect={() => onSalonClick?.(salon)}
                    />
                  )}
                />
              </>
            )}

            {!showEventsBrowseList && livesFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesFollowing', { defaultValue: 'Live suivi' })}
                items={content.livesFollowing}
                emptyText={followingEmptyText}
                {...sectionProps('livesFollowing', content.livesFollowing.length)}
                renderItem={(live) => (
                  <LiveSidebarRow
                    key={`follow-${live.id}`}
                    live={live}
                    onSelect={() => onLiveClick?.(live)}
                  />
                )}
              />
            )}

            {!showEventsBrowseList && livesFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesInView', { defaultValue: 'Lives' })}
                items={content.lives}
                emptyText={livesInViewEmptyText}
                {...sectionProps('livesInView', content.lives.length)}
                renderItem={(live) => (
                  <LiveSidebarRow key={live.id} live={live} onSelect={() => onLiveClick?.(live)} />
                )}
              />
            )}

            {!showEventsBrowseList && livesFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesSuggestions', { defaultValue: 'Suggestions' })}
                items={content.livesSuggestions}
                emptyText={suggestionsEmptyText}
                {...sectionProps('livesSuggestions', content.livesSuggestions.length)}
                renderItem={(live) => (
                  <LiveSidebarRow
                    key={`suggest-${live.id}`}
                    live={live}
                    onSelect={() => onLiveClick?.(live)}
                  />
                )}
              />
            )}

            {!showEventsBrowseList && salonFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarSalonsFollowing', { defaultValue: 'Salon suivi' })}
                items={content.salonsFollowing}
                emptyText={followingEmptyText}
                {...sectionProps('salonsFollowing', content.salonsFollowing.length)}
                renderItem={(salon) => (
                  <SalonSidebarRow
                    key={`follow-salon-${salon.id}`}
                    salon={salon}
                    active={salon.id === selectedSalonId}
                    onSelect={() => onSalonClick?.(salon)}
                  />
                )}
              />
            )}

            {!showEventsBrowseList && salonFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarSalonsInView', { defaultValue: 'Salons' })}
                items={content.salons}
                emptyText={salonsInViewEmptyText}
                {...sectionProps('salonsInView', content.salons.length)}
                renderItem={(salon) => (
                  <SalonSidebarRow
                    key={salon.id}
                    salon={salon}
                    active={salon.id === selectedSalonId}
                    onSelect={() => onSalonClick?.(salon)}
                  />
                )}
              />
            )}

            {!showEventsBrowseList && salonFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesSuggestions', { defaultValue: 'Suggestions' })}
                items={content.salonsSuggestions}
                emptyText={suggestionsEmptyText}
                {...sectionProps('salonsSuggestions', content.salonsSuggestions.length)}
                renderItem={(salon) => (
                  <SalonSidebarRow
                    key={`suggest-salon-${salon.id}`}
                    salon={salon}
                    active={salon.id === selectedSalonId}
                    onSelect={() => onSalonClick?.(salon)}
                  />
                )}
              />
            )}

            {!showEventsBrowseList && content.people.length > 0 && (
              <CollapsibleSidebarSection
                label="En direct"
                items={content.people}
                {...sectionProps('people', content.people.length)}
                renderItem={(person) => (
                  <PersonSidebarRow
                    key={person.id}
                    person={person}
                    onSelect={() => onPersonClick?.(person)}
                  />
                )}
              />
            )}
          </>
        )}
        </ul>
      </div>
    </aside>
  );
});
