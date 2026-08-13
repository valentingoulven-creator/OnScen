import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapSidebarContent } from '../lib/mapSidebarContent';
import { getEventTypeIcon, SPONSOR_EVENT_ICON, type FeedEventType } from '../lib/eventType';
import {
  filterMapEventClustersByEventType,
  filterMapEventsByEventType,
} from '../lib/mapEventFilter';
import {
  filterLivesByContentCategory,
  type LiveContentCategory,
} from '../lib/liveContentCategory';
import type {
  FeedPost,
  Live,
  MapEventCityCluster,
  MapEventMarker,
  NearbyPerson,
  Salon,
} from '../types';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

type MosaicTile =
  | { kind: 'live'; key: string; data: Live }
  | { kind: 'salon'; key: string; data: Salon }
  | { kind: 'event'; key: string; data: MapEventMarker }
  | { kind: 'eventCluster'; key: string; data: MapEventCityCluster }
  | { kind: 'person'; key: string; data: NearbyPerson }
  | { kind: 'sponso'; key: string; data: FeedPost };

/** Une section mosaïque = même regroupement que l'ancienne sidebar (Suivi / Zone / Suggestions). */
type MosaicSection = {
  titleKey: string;
  defaultTitle: string;
  tiles: MosaicTile[];
  /** Affiché à la place de la grille quand tiles est vide — sections "Suivi" toujours visibles
   * (même à 0), comme sur l'ancienne sidebar, pour que la catégorie reste repérable. */
  emptyKey?: string;
  emptyDefault?: string;
};

const SECTION_TILE_CAP = 12;

const MOSAIC_EVENT_TYPE_FILTERS: {
  type: FeedEventType;
  icon: string;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { type: 'dance', icon: '💃', labelKey: 'feed.eventTypeDance', defaultLabel: 'Danse' },
  { type: 'chant', icon: '🎶', labelKey: 'feed.eventTypeChant', defaultLabel: 'Musique' },
  { type: 'autre', icon: '🎨', labelKey: 'map.mosaicEventTypeArt', defaultLabel: 'Art' },
];

const MOSAIC_LIVE_CATEGORY_FILTERS: {
  category: LiveContentCategory;
  icon: string;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { category: 'dance', icon: '💃', labelKey: 'feed.eventTypeDance', defaultLabel: 'Danse' },
  { category: 'music', icon: '🎶', labelKey: 'feed.eventTypeChant', defaultLabel: 'Musique' },
  { category: 'artistic', icon: '🎨', labelKey: 'map.mosaicEventTypeArt', defaultLabel: 'Art' },
];

const EVENT_TYPE_CHIP =
  'inline-flex items-center justify-center gap-1 min-h-9 px-2.5 rounded-xl border text-[10px] font-bold transition active:scale-95 shrink-0';

function MosaicSubtypeFilterBar<T extends string>({
  ariaLabel,
  allIcon,
  allLabel,
  activeFilter,
  onSelect,
  filters,
  activeClassName,
}: {
  ariaLabel: string;
  allIcon: string;
  allLabel: string;
  activeFilter: T | null;
  onSelect: (next: T | null) => void;
  filters: { id: T; icon: string; labelKey: string; defaultLabel: string }[];
  activeClassName: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 -mx-0.5 px-0.5"
      role="toolbar"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-pressed={activeFilter === null}
        onClick={() => onSelect(null)}
        className={`${EVENT_TYPE_CHIP} ${
          activeFilter === null ? activeClassName : 'bg-[#1a1a24] border-[#2d2d3d] text-white/60'
        }`}
      >
        <span aria-hidden>{allIcon}</span>
        {allLabel}
      </button>
      {filters.map(({ id, icon, labelKey, defaultLabel }) => (
        <button
          key={id}
          type="button"
          aria-pressed={activeFilter === id}
          onClick={() => onSelect(activeFilter === id ? null : id)}
          className={`${EVENT_TYPE_CHIP} ${
            activeFilter === id ? activeClassName : 'bg-[#1a1a24] border-[#2d2d3d] text-white/60'
          }`}
        >
          <span aria-hidden>{icon}</span>
          {t(labelKey, { defaultValue: defaultLabel })}
        </button>
      ))}
    </div>
  );
}

function liveTiles(prefix: string, lives: Live[]): MosaicTile[] {
  return lives.slice(0, SECTION_TILE_CAP).map((data) => ({ kind: 'live', key: `${prefix}-${data.id}`, data }));
}
function salonTiles(prefix: string, salons: Salon[]): MosaicTile[] {
  return salons.slice(0, SECTION_TILE_CAP).map((data) => ({ kind: 'salon', key: `${prefix}-${data.id}`, data }));
}
function eventTiles(prefix: string, events: MapEventMarker[]): MosaicTile[] {
  return events.slice(0, SECTION_TILE_CAP).map((data) => ({ kind: 'event', key: `${prefix}-${data.id}`, data }));
}
function clusterTiles(prefix: string, clusters: MapEventCityCluster[]): MosaicTile[] {
  return clusters
    .slice(0, SECTION_TILE_CAP)
    .map((data) => ({ kind: 'eventCluster', key: `${prefix}-${data.cityKey}`, data }));
}
function personTiles(prefix: string, people: NearbyPerson[]): MosaicTile[] {
  return people.slice(0, SECTION_TILE_CAP).map((data) => ({ kind: 'person', key: `${prefix}-${data.id}`, data }));
}
function sponsoTiles(posts: FeedPost[]): MosaicTile[] {
  return posts.slice(0, SECTION_TILE_CAP).map((data) => ({ kind: 'sponso', key: `sponso-${data.id}`, data }));
}

function tileVisual(tile: MosaicTile): { avatarUrl?: string; title: string; badge: string; ring: string } {
  switch (tile.kind) {
    case 'live':
      return {
        avatarUrl: tile.data.hostAvatarUrl,
        title: tile.data.hostName || tile.data.title,
        badge: '🔴',
        ring: 'border-red-500/60',
      };
    case 'salon':
      return {
        avatarUrl: tile.data.hostAvatarUrl,
        title: tile.data.hostName || tile.data.title,
        badge: '🎵',
        ring: 'border-fuchsia-500/60',
      };
    case 'event':
      return {
        avatarUrl: tile.data.imageUrl || tile.data.authorAvatarUrl,
        title: tile.data.title,
        badge: getEventTypeIcon(tile.data.eventType),
        ring: 'border-purple-500/60',
      };
    case 'eventCluster':
      return { title: tile.data.cityLabel, badge: '📍', ring: 'border-purple-500/60' };
    case 'person':
      return {
        avatarUrl: tile.data.avatarUrl,
        title: tile.data.username,
        badge: tile.data.isLive ? '🔴' : '📍',
        ring: tile.data.isLive ? 'border-red-500/60' : 'border-gray-500/50',
      };
    case 'sponso':
      return {
        avatarUrl: tile.data.imageUrl || tile.data.imageUrls?.[0] || tile.data.author.avatarUrl,
        title: tile.data.author.username,
        badge: SPONSOR_EVENT_ICON,
        ring: 'border-amber-500/60',
      };
  }
}

function MosaicSectionBlock({
  title,
  tiles,
  emptyText,
  onTileClick,
}: {
  title: string;
  tiles: MosaicTile[];
  emptyText?: string;
  onTileClick: (tile: MosaicTile) => void;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 px-1 mb-1.5">{title}</h3>
      {tiles.length === 0 && emptyText ? (
        <p className="text-[11px] text-gray-500 px-1">{emptyText}</p>
      ) : (
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
        {tiles.map((tile) => {
          const visual = tileVisual(tile);
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => onTileClick(tile)}
              className="flex flex-col items-center gap-1 active:scale-95 transition"
            >
              <span
                className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 ${visual.ring} bg-[#1a1a24] flex items-center justify-center`}
              >
                {visual.avatarUrl ? (
                  <img src={visual.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-lg" aria-hidden>
                    {visual.badge}
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none drop-shadow" aria-hidden>
                  {visual.badge}
                </span>
              </span>
              <span className={`text-[10px] leading-tight truncate w-full text-center ${USERNAME_WAVE_CLASS}`}>
                {visual.title}
              </span>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}

type MapFilterMosaicPopupProps = {
  open: boolean;
  onClose: () => void;
  content: MapSidebarContent;
  livesFilterOn: boolean;
  onToggleLivesFilter: () => void;
  salonFilterOn: boolean;
  onToggleSalonFilter: () => void;
  showEventFilter: boolean;
  eventsFilterOn: boolean;
  eventsLoading: boolean;
  onToggleEventFilter: () => void;
  onLiveClick: (live: Live) => void;
  onSalonClick: (salon: Salon) => void;
  onEventClick: (event: MapEventMarker) => void;
  onPersonClick?: (person: NearbyPerson) => void;
  /** Carrousel « Sponso » — même contenu que la sidebar par défaut (aucun filtre actif). */
  sponsoredEventPosts?: FeedPost[];
  onSponsoredEventOpen?: (post: FeedPost) => void;
  /** Bouton « Voir sur le globe » dans l'en-tête. */
  showGlobeButton?: boolean;
  onShowGlobe?: () => void;
};

const FILTER_CHIP_BTN =
  'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 min-h-[2.25rem] px-2 rounded-xl border text-xs font-bold transition active:scale-95';

/**
 * Popup « mosaïque » carte plein écran (mobile compact uniquement, build tel) :
 * remplace la colonne sidebar permanente (NearbyPeoplePanel) — s'ouvre depuis
 * le bouton filtre. Par défaut (aucun filtre) reprend les mêmes catégories que
 * la sidebar (Sponso, Suivi lives/salons/événements) ; dès qu'un filtre est
 * sélectionné, la mosaïque s'ajuste pour reprendre les mêmes groupes que la
 * sidebar pour ce filtre (Suivi / Zone / Suggestions / En direct).
 */
export function MapFilterMosaicPopup({
  open,
  onClose,
  content,
  livesFilterOn,
  onToggleLivesFilter,
  salonFilterOn,
  onToggleSalonFilter,
  showEventFilter,
  eventsFilterOn,
  eventsLoading,
  onToggleEventFilter,
  onLiveClick,
  onSalonClick,
  onEventClick,
  onPersonClick,
  sponsoredEventPosts = [],
  onSponsoredEventOpen,
  showGlobeButton = false,
  onShowGlobe,
}: MapFilterMosaicPopupProps) {
  const { t } = useTranslation();
  const [eventTypeFilter, setEventTypeFilter] = useState<FeedEventType | null>(null);
  const [liveCategoryFilter, setLiveCategoryFilter] = useState<LiveContentCategory | null>(null);

  useEffect(() => {
    if (!open) {
      setEventTypeFilter(null);
      setLiveCategoryFilter(null);
    }
  }, [open]);

  useEffect(() => {
    if (!eventsFilterOn) setEventTypeFilter(null);
  }, [eventsFilterOn]);

  useEffect(() => {
    if (!livesFilterOn) setLiveCategoryFilter(null);
  }, [livesFilterOn]);

  const filterEventMarkers = (markers: MapEventMarker[]) => {
    if (!eventTypeFilter) return markers;
    return filterMapEventsByEventType(markers, eventTypeFilter);
  };

  const filterEventClusters = (clusters: MapEventCityCluster[]) => {
    if (!eventTypeFilter) return clusters;
    return filterMapEventClustersByEventType(clusters, eventTypeFilter);
  };

  const filterLives = (lives: Live[]) => {
    if (!liveCategoryFilter) return lives;
    return filterLivesByContentCategory(lives, liveCategoryFilter);
  };

  const sections = useMemo<MosaicSection[]>(() => {
    const list: MosaicSection[] = [];
    // Sponso masqué sous les filtres Lives/Salon (contenu événement hors sujet ici).
    if (sponsoredEventPosts.length > 0 && !livesFilterOn && !salonFilterOn) {
      list.push({
        titleKey: 'map.sidebarSponsoCategory',
        defaultTitle: 'Sponso',
        tiles: sponsoTiles(sponsoredEventPosts),
      });
    }
    const eventsFollowingEmpty = {
      emptyKey: 'map.sidebarEventsFollowingEmpty',
      emptyDefault: 'Aucun événement suivi ou enregistré.',
    };
    const followingEmpty = { emptyKey: 'map.sidebarFollowingEmpty', emptyDefault: 'Aucun contenu suivi.' };
    const suggestionsEmpty = { emptyKey: 'map.sidebarSuggestionsEmpty', emptyDefault: 'Aucune suggestion.' };

    if (content.noFilters) {
      // Sections « Suivi » toujours visibles (même vides) — comme sur l'ancienne
      // sidebar, pour que l'utilisateur repère la catégorie et sache qu'il peut
      // suivre des comptes pour la remplir.
      list.push({
        titleKey: 'map.sidebarEventsFollowing',
        defaultTitle: 'Événement suivi',
        tiles: eventTiles('ef', filterEventMarkers(content.eventsFollowing)),
        ...eventsFollowingEmpty,
      });
      list.push({
        titleKey: 'map.sidebarLivesFollowing',
        defaultTitle: 'Live suivi',
        tiles: liveTiles('lf', filterLives(content.livesFollowing)),
        ...followingEmpty,
      });
      list.push({
        titleKey: 'map.sidebarSalonsFollowing',
        defaultTitle: 'Salon suivi',
        tiles: salonTiles('sf', content.salonsFollowing),
        ...followingEmpty,
      });
      return list;
    }

    if (eventsFilterOn) {
      list.push({
        titleKey: 'map.sidebarEventsFollowing',
        defaultTitle: 'Événement suivi',
        tiles: eventTiles('evf', filterEventMarkers(content.eventsFollowing)),
        ...eventsFollowingEmpty,
      });
      const visibleClusters = filterEventClusters(content.eventClusters);
      if (visibleClusters.length > 0) {
        list.push({
          titleKey: 'map.sidebarEventsInView',
          defaultTitle: 'Événements',
          tiles: clusterTiles('evc', visibleClusters),
        });
      } else {
        list.push({
          titleKey: 'map.sidebarEventsInView',
          defaultTitle: 'Événements',
          tiles: eventTiles('ev', filterEventMarkers(content.events)),
          emptyKey: 'map.sidebarEventsEmpty',
          emptyDefault: 'Aucun événement dans cette zone.',
        });
      }
      list.push({
        titleKey: 'map.sidebarEventsSuggestions',
        defaultTitle: 'Suggestions',
        tiles: eventTiles('evs', filterEventMarkers(content.eventsSuggestions)),
        ...suggestionsEmpty,
      });
    }
    if (livesFilterOn) {
      list.push({
        titleKey: 'map.sidebarLivesFollowing',
        defaultTitle: 'Live suivi',
        tiles: liveTiles('lvf', filterLives(content.livesFollowing)),
        ...followingEmpty,
      });
      list.push({
        titleKey: 'map.sidebarLivesSuggestions',
        defaultTitle: 'Suggestions',
        tiles: liveTiles('lvs', filterLives(content.livesSuggestions)),
        ...suggestionsEmpty,
      });
      if (content.people.length > 0) {
        list.push({
          titleKey: 'map.sidebarPeopleLive',
          defaultTitle: 'En direct',
          tiles: personTiles('p', content.people),
        });
      }
    }
    if (salonFilterOn) {
      list.push({
        titleKey: 'map.sidebarSalonsFollowing',
        defaultTitle: 'Salon suivi',
        tiles: salonTiles('slf', content.salonsFollowing),
        ...followingEmpty,
      });
      list.push({
        titleKey: 'map.sidebarSalonsSuggestions',
        defaultTitle: 'Suggestions',
        tiles: salonTiles('sls', content.salonsSuggestions),
        ...suggestionsEmpty,
      });
    }
    return list;
  }, [content, eventsFilterOn, livesFilterOn, salonFilterOn, sponsoredEventPosts, eventTypeFilter, liveCategoryFilter]);

  const onTileClick = (tile: MosaicTile) => {
    switch (tile.kind) {
      case 'live':
        onLiveClick(tile.data);
        break;
      case 'salon':
        onSalonClick(tile.data);
        break;
      case 'event':
        onEventClick(tile.data);
        break;
      case 'eventCluster': {
        const first = tile.data.events[0];
        if (first) onEventClick(first);
        break;
      }
      case 'person':
        onPersonClick?.(tile.data);
        break;
      case 'sponso':
        onSponsoredEventOpen?.(tile.data);
        break;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t('map.filterMosaicTitle', { defaultValue: 'Filtres et contenu carte' })}
      className="ms-map-filter-mosaic fixed inset-0 z-40 bg-[#0b0b0f] pointer-events-auto flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-2 border-b border-[#232330]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('map.filterMosaicBackToMap', { defaultValue: 'Retour à la carte' })}
          className="inline-flex items-center gap-1.5 min-h-11 pl-2 pr-3 rounded-xl border border-[#2d2d3d] bg-[#16161f] text-white active:scale-95 transition"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-xs font-bold">
            {t('map.filterMosaicBackToMap', { defaultValue: 'Retour à la carte' })}
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {showGlobeButton && onShowGlobe && (
            <button
              type="button"
              onClick={onShowGlobe}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-xs font-bold text-indigo-200 active:scale-95 transition"
            >
              <span aria-hidden>🌐</span>
              {t('map.filterMosaicShowGlobe', { defaultValue: 'Voir sur le globe' })}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('map.currentFilterClose', { defaultValue: 'Fermer' })}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-[#2d2d3d] bg-[#16161f] text-gray-300 hover:text-white hover:bg-[#1e1e2f] active:scale-95 transition"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 p-2 border-b border-[#232330]">
        <button
          type="button"
          onClick={onToggleLivesFilter}
          aria-pressed={livesFilterOn}
          className={`${FILTER_CHIP_BTN} ${
            livesFilterOn
              ? 'bg-red-950/80 border-red-500 text-red-300'
              : 'bg-[#1a1a24] border-[#2d2d3d] text-white/60'
          }`}
        >
          <span aria-hidden>🔴</span>
          Lives
        </button>
        <button
          type="button"
          onClick={onToggleSalonFilter}
          aria-pressed={salonFilterOn}
          className={`${FILTER_CHIP_BTN} ${
            salonFilterOn
              ? 'bg-fuchsia-950/80 border-fuchsia-500 text-fuchsia-200'
              : 'bg-[#1a1a24] border-[#2d2d3d] text-white/60'
          }`}
        >
          <span aria-hidden>🎵</span>
          Salon
        </button>
        {showEventFilter && (
          <button
            type="button"
            onClick={onToggleEventFilter}
            aria-pressed={eventsFilterOn}
            className={`${FILTER_CHIP_BTN} ${
              eventsFilterOn
                ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                : 'bg-[#1a1a24] border-[#2d2d3d] text-white/60'
            }`}
          >
            {eventsLoading ? (
              <span className="h-2.5 w-2.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
            ) : (
              <span aria-hidden>📅</span>
            )}
            Event
          </button>
        )}
        {showGlobeButton && onShowGlobe && (
          <button
            type="button"
            onClick={onShowGlobe}
            aria-label={t('map.filterMosaicShowGlobe', { defaultValue: 'Voir sur le globe' })}
            title={t('map.filterMosaicShowGlobe', { defaultValue: 'Voir sur le globe' })}
            className="shrink-0 inline-flex items-center justify-center min-h-[2.25rem] min-w-[2.25rem] px-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 active:scale-95 transition"
          >
            <span aria-hidden className="text-sm">🌐</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
        {eventsFilterOn ? (
          <MosaicSubtypeFilterBar
            ariaLabel={t('map.mosaicEventTypeFilterAria', { defaultValue: 'Filtrer par type d’événement' })}
            allIcon="📅"
            allLabel={t('map.mosaicEventTypeAll', { defaultValue: 'Tous' })}
            activeFilter={eventTypeFilter}
            onSelect={setEventTypeFilter}
            activeClassName="bg-purple-950/80 border-purple-500 text-purple-200"
            filters={MOSAIC_EVENT_TYPE_FILTERS.map(({ type, icon, labelKey, defaultLabel }) => ({
              id: type,
              icon,
              labelKey,
              defaultLabel,
            }))}
          />
        ) : null}
        {livesFilterOn ? (
          <MosaicSubtypeFilterBar
            ariaLabel={t('map.mosaicLiveTypeFilterAria', { defaultValue: 'Filtrer par type de live' })}
            allIcon="🔴"
            allLabel={t('map.mosaicEventTypeAll', { defaultValue: 'Tous' })}
            activeFilter={liveCategoryFilter}
            onSelect={setLiveCategoryFilter}
            activeClassName="bg-red-950/80 border-red-500 text-red-300"
            filters={MOSAIC_LIVE_CATEGORY_FILTERS.map(({ category, icon, labelKey, defaultLabel }) => ({
              id: category,
              icon,
              labelKey,
              defaultLabel,
            }))}
          />
        ) : null}
        {sections.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6 px-2">
            {t('map.filterMosaicEmpty', {
              defaultValue: 'Active un filtre pour voir les lives, salons et événements ici.',
            })}
          </p>
        ) : (
          sections.map((section, index) => (
            <MosaicSectionBlock
              key={`${section.titleKey}-${index}`}
              title={t(section.titleKey, { defaultValue: section.defaultTitle })}
              tiles={section.tiles}
              emptyText={
                section.emptyKey
                  ? t(section.emptyKey, { defaultValue: section.emptyDefault })
                  : undefined
              }
              onTileClick={onTileClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
