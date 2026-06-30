import { memo, useMemo, useState, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatWeekRangeLabel } from '../lib/feedEvents';
import {
  countMapSidebarItems,
  countEventsSidebarItems,
  countSalonsSidebarItems,
  mapDetailTierLabel,
  type MapSidebarContent,
} from '../lib/mapSidebarContent';
import type { MapViewDetailState } from '../lib/mapMarkerVisibility';
import { MapEventRow } from './MapCityEventsPanel';
import { PlatformListeningIcon } from './PlatformListeningIcon';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

interface NearbyPeoplePanelProps {
  content: MapSidebarContent;
  detail: MapViewDetailState;
  loading?: boolean;
  eventsLoading?: boolean;
  layout?: 'side' | 'bottom';
  selectedSalonId?: string | null;
  onHide?: () => void;
  onEventClick?: (event: MapEventMarker) => void;
  onEventClusterClick?: (cluster: MapEventCityCluster) => void;
  onSalonClick?: (salon: Salon) => void;
  onLiveClick?: (live: Live) => void;
  onPersonClick?: (person: NearbyPerson) => void;
  eventsFilterOn?: boolean;
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
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

const CityClusterRow = memo(function CityClusterRow({
  cluster,
  onSelect,
}: {
  cluster: MapEventCityCluster;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-2 py-1 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-purple-500/40 transition"
      >
        <div className="flex items-start gap-1.5">
          <span className="text-sm shrink-0 leading-none" aria-hidden>
            📍
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className={`${SIDEBAR_ROW_NAME} text-gray-100`}>{cluster.cityLabel}</p>
            <p className={`${SIDEBAR_ROW_META} text-purple-300/90`}>
              {cluster.count} événement{cluster.count !== 1 ? 's' : ''} cette semaine
            </p>
          </div>
        </div>
      </button>
    </li>
  );
});

const SalonSidebarRow = memo(function SalonSidebarRow({
  salon,
  active,
  onSelect,
}: {
  salon: Salon;
  active: boolean;
  onSelect: () => void;
}) {
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
          <p className={`${SIDEBAR_ROW_META} text-fuchsia-300/90`}>{salon.title}</p>
        </div>
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
  onEventClick,
  onEventClusterClick,
  onSalonClick,
  onLiveClick,
  onPersonClick,
  eventsFilterOn = false,
  livesFilterOn = false,
  salonFilterOn = false,
}: NearbyPeoplePanelProps) {
  const { t } = useTranslation();
  const isBottom = layout === 'bottom';
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
  const eventCount = useMemo(() => countEventsSidebarItems(content), [content]);
  const showWeekLabel =
    eventsFilterOn &&
    (content.eventClusters.length > 0 ||
      content.eventClustersFollowing.length > 0 ||
      content.eventClustersSuggestions.length > 0 ||
      content.events.length > 0 ||
      content.eventsFollowing.length > 0 ||
      content.eventsSuggestions.length > 0);
  const showCategoryPanels = livesFilterOn || salonFilterOn || eventsFilterOn;
  const showEventClusterSections = eventsFilterOn && detail.tier === 'overview';
  const showEventItemSections = eventsFilterOn && detail.tier !== 'overview';
  const followingEmptyText = t('map.sidebarFollowingEmpty', { defaultValue: 'Aucun contenu suivi.' });
  const suggestionsEmptyText = t('map.sidebarSuggestionsEmpty', { defaultValue: 'Aucune suggestion.' });
  const livesInViewEmptyText = content.zoomTooWide
    ? t('map.sidebarLivesZoomHint', { defaultValue: 'Zoomez pour voir les lives dans cette zone.' })
    : t('map.sidebarLivesEmpty', { defaultValue: 'Aucun live dans cette zone.' });
  const salonsInViewEmptyText = t('map.sidebarSalonsEmpty', { defaultValue: 'Aucun salon dans cette zone.' });
  const eventsInViewEmptyText = eventsLoading
    ? t('map.sidebarEventsLoading', { defaultValue: 'Chargement des événements…' })
    : t('map.sidebarEventsEmpty', { defaultValue: 'Aucun événement dans cette zone.' });

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
      return 'Activez Lives, Salon ou Évènement sur la carte pour afficher la liste.';
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
            {showWeekLabel && (
              <p className="text-[9px] text-purple-400/80 mt-0.5">Cette semaine · {formatWeekRangeLabel()}</p>
            )}
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

      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {itemCount === 0 && !showCategoryPanels ? (
          <li className="px-2 sm:px-3 py-6 text-center text-[10px] text-gray-500 leading-snug">
            {emptyMessage()}
          </li>
        ) : (
          <>
            {showEventClusterSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarEventsFollowing', { defaultValue: 'Suivi / Enregistré' })}
                items={content.eventClustersFollowing}
                emptyText={t('map.sidebarEventsFollowingEmpty', {
                  defaultValue: 'Aucun événement suivi ou enregistré.',
                })}
                {...sectionProps('eventClustersFollowing', content.eventClustersFollowing.length)}
                renderItem={(cluster) => (
                  <CityClusterRow
                    key={`follow-cluster-${cluster.cityKey}`}
                    cluster={cluster}
                    onSelect={() => onEventClusterClick?.(cluster)}
                  />
                )}
              />
            )}

            {showEventClusterSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarEventsInView', { defaultValue: 'Événements' })}
                items={content.eventClusters}
                emptyText={eventsInViewEmptyText}
                {...sectionProps('eventClusters', content.eventClusters.length)}
                renderItem={(cluster) => (
                  <CityClusterRow
                    key={cluster.cityKey}
                    cluster={cluster}
                    onSelect={() => onEventClusterClick?.(cluster)}
                  />
                )}
              />
            )}

            {showEventClusterSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesSuggestions', { defaultValue: 'Suggestions' })}
                items={content.eventClustersSuggestions}
                emptyText={suggestionsEmptyText}
                {...sectionProps('eventClustersSuggestions', content.eventClustersSuggestions.length)}
                renderItem={(cluster) => (
                  <CityClusterRow
                    key={`suggest-cluster-${cluster.cityKey}`}
                    cluster={cluster}
                    onSelect={() => onEventClusterClick?.(cluster)}
                  />
                )}
              />
            )}

            {showEventItemSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarEventsFollowing', { defaultValue: 'Suivi / Enregistré' })}
                items={content.eventsFollowing}
                emptyText={t('map.sidebarEventsFollowingEmpty', {
                  defaultValue: 'Aucun événement suivi ou enregistré.',
                })}
                {...sectionProps('eventsFollowing', content.eventsFollowing.length)}
                renderItem={(event) => (
                  <MapEventRow
                    key={`follow-event-${event.id}`}
                    event={event}
                    compact
                    onSelect={() => onEventClick?.(event)}
                  />
                )}
              />
            )}

            {showEventItemSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarEventsInView', { defaultValue: 'Événements' })}
                items={content.events}
                emptyText={eventsInViewEmptyText}
                {...sectionProps('events', content.events.length)}
                renderItem={(event) => (
                  <MapEventRow
                    key={event.id}
                    event={event}
                    compact
                    onSelect={() => onEventClick?.(event)}
                  />
                )}
              />
            )}

            {showEventItemSections && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesSuggestions', { defaultValue: 'Suggestions' })}
                items={content.eventsSuggestions}
                emptyText={suggestionsEmptyText}
                {...sectionProps('eventsSuggestions', content.eventsSuggestions.length)}
                renderItem={(event) => (
                  <MapEventRow
                    key={`suggest-event-${event.id}`}
                    event={event}
                    compact
                    onSelect={() => onEventClick?.(event)}
                  />
                )}
              />
            )}

            {livesFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesFollowing', { defaultValue: 'Suivi' })}
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

            {livesFilterOn && (
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

            {livesFilterOn && (
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

            {salonFilterOn && (
              <CollapsibleSidebarSection
                label={t('map.sidebarLivesFollowing', { defaultValue: 'Suivi' })}
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

            {salonFilterOn && (
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

            {salonFilterOn && (
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

            {content.people.length > 0 && (
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
    </aside>
  );
});
