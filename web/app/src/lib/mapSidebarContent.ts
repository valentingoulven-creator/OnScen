import { sortMapEventsForPanel } from './mapEventClusters';
import {
  clipSalonsForMapView,
  filterLivesInViewport,
  filterMarkersInViewport,
  filterPeopleForZoom,
  filterPeopleInViewport,
  filterSalonsForZoom,
  getMapBoundsCenter,
  getMapMarkerVisibility,
  isPublicSalon,
  shouldClipMapMarkersToViewport,
  type MapDetailTier,
  type MapViewDetailState,
} from './mapMarkerVisibility';
import { applyFavoritesFirst } from './nearbyPanelSettings';
import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';

export interface MapSidebarContent {
  /** Aucun filtre carte actif. */
  noFilters: boolean;
  /** Lives/Salon actifs mais zoom trop large (niveau overview). */
  zoomTooWide: boolean;
  /** Clusters événements — comptes suivis. */
  eventClustersFollowing: MapEventCityCluster[];
  /** Clusters événements dans la zone visible. */
  eventClusters: MapEventCityCluster[];
  /** Clusters événements populaires hors suivi et hors zone. */
  eventClustersSuggestions: MapEventCityCluster[];
  /** Événements des comptes suivis. */
  eventsFollowing: MapEventMarker[];
  /** Événements dans la zone visible. */
  events: MapEventMarker[];
  /** Événements à venir hors suivi et hors zone visible. */
  eventsSuggestions: MapEventMarker[];
  /** Lives des comptes suivis (tous les directs en ligne). */
  livesFollowing: Live[];
  /** Lives dans la zone visible selon le zoom carte. */
  lives: Live[];
  /** Lives populaires (viewers), hors suivi et hors zone visible. */
  livesSuggestions: Live[];
  /** Salons des comptes suivis. */
  salonsFollowing: Salon[];
  /** Salons dans la zone visible. */
  salons: Salon[];
  /** Salons populaires (auditeurs), hors suivi et hors zone visible. */
  salonsSuggestions: Salon[];
  people: NearbyPerson[];
}

const MAP_SIDEBAR_SUGGESTIONS_MAX = 20;

function uniqueLiveCount(lists: Live[][]): number {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const live of list) ids.add(live.id);
  }
  return ids.size;
}

function uniqueSalonCount(lists: Salon[][]): number {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const salon of list) ids.add(salon.id);
  }
  return ids.size;
}

function uniqueEventCount(lists: MapEventMarker[][]): number {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const event of list) ids.add(event.id);
  }
  return ids.size;
}

function uniqueClusterCount(lists: MapEventCityCluster[][]): number {
  const keys = new Set<string>();
  for (const list of lists) {
    for (const cluster of list) keys.add(cluster.cityKey);
  }
  return keys.size;
}

function sortLivesByViewersDesc(lives: Live[]): Live[] {
  return [...lives].sort(
    (a, b) => (b.viewersCount ?? 0) - (a.viewersCount ?? 0) || a.title.localeCompare(b.title)
  );
}

function sortSalonsByListenersDesc(salons: Salon[]): Salon[] {
  return [...salons].sort(
    (a, b) => (b.listenersCount ?? 0) - (a.listenersCount ?? 0) || a.title.localeCompare(b.title)
  );
}

function sortClustersByCountDesc(clusters: MapEventCityCluster[]): MapEventCityCluster[] {
  return [...clusters].sort(
    (a, b) => b.count - a.count || a.cityLabel.localeCompare(b.cityLabel)
  );
}


function isSidebarFollowingEvent(
  e: MapEventMarker,
  followingIds: Set<string>,
  savedEventPostIds: Set<string>
): boolean {
  return (
    savedEventPostIds.has(e.id) ||
    (e.authorId != null && followingIds.has(e.authorId))
  );
}

function clusterHasFollowingOrSavedEvent(
  cluster: MapEventCityCluster,
  followingIds: Set<string>,
  savedEventPostIds: Set<string>
): boolean {
  return cluster.events.some((e) =>
    isSidebarFollowingEvent(e, followingIds, savedEventPostIds)
  );
}

export function countMapSidebarItems(content: MapSidebarContent): number {
  return (
    uniqueClusterCount([
      content.eventClustersFollowing,
      content.eventClusters,
      content.eventClustersSuggestions,
    ]) +
    uniqueEventCount([content.eventsFollowing, content.events, content.eventsSuggestions]) +
    uniqueLiveCount([content.livesFollowing, content.lives, content.livesSuggestions]) +
    uniqueSalonCount([content.salonsFollowing, content.salons, content.salonsSuggestions]) +
    content.people.length
  );
}

export function countSalonsSidebarItems(content: MapSidebarContent): number {
  return uniqueSalonCount([
    content.salonsFollowing,
    content.salons,
    content.salonsSuggestions,
  ]);
}

export function countEventsSidebarItems(content: MapSidebarContent): number {
  return (
    uniqueClusterCount([
      content.eventClustersFollowing,
      content.eventClusters,
      content.eventClustersSuggestions,
    ]) +
    uniqueEventCount([content.eventsFollowing, content.events, content.eventsSuggestions])
  );
}

/** Badge filtre Lives : lives + personnes live + hôtes salon live (zone visible). */
export function countLivesFilterBadge(
  livesFilterOn: boolean,
  salonFilterOn: boolean,
  content: MapSidebarContent,
  liveSalonCount: number
): number {
  if (!livesFilterOn) return 0;
  let count =
    uniqueLiveCount([content.livesFollowing, content.lives, content.livesSuggestions]) +
    content.people.length;
  if (content.zoomTooWide) return count;
  if (!salonFilterOn) count += liveSalonCount;
  return count;
}

/** Libellé court du niveau de zoom pour le sous-titre du panneau latéral. */
export function mapDetailTierLabel(tier: MapDetailTier): string {
  switch (tier) {
    case 'overview':
      return 'Vue globale';
    case 'city':
      return 'Vue ville';
    case 'street':
      return 'Vue détaillée';
  }
}

export function buildMapSidebarContent(opts: {
  detail: MapViewDetailState;
  eventsFilterOn: boolean;
  livesFilterOn: boolean;
  salonFilterOn: boolean;
  eventsOnly: boolean;
  showAllSalonsAtCityZoom: boolean;
  mapEvents: MapEventMarker[];
  eventClusters: MapEventCityCluster[];
  lives: Live[];
  salons: Salon[];
  people: NearbyPerson[];
  favoriteIds: Set<string>;
  /** Comptes suivis (follow) — section Suivi du panneau lives. */
  followingIds?: Set<string>;
  /** Publications événement enregistrées (favori post) — section Suivi événements. */
  savedEventPostIds?: Set<string>;
  /** Pool complet pour la section Suivi quand aucun filtre carte actif. */
  allMapEvents?: MapEventMarker[];
  /** Centre de la dernière requête nearby ; si absent, centre des bounds (tests). */
  nearbyFetchCenter?: [number, number] | null;
}): MapSidebarContent {
  const {
    detail,
    eventsFilterOn,
    livesFilterOn,
    salonFilterOn,
    eventsOnly,
    showAllSalonsAtCityZoom,
    mapEvents,
    eventClusters,
    lives,
    salons,
    people,
    favoriteIds,
    followingIds = new Set(),
    savedEventPostIds = new Set(),
    allMapEvents = mapEvents,
    nearbyFetchCenter,
  } = opts;

  const anyFilter = eventsFilterOn || livesFilterOn || salonFilterOn;
  if (!anyFilter) {
    const activeLives = lives.filter((l) => l.isActive !== false);
    const livesFollowing =
      followingIds.size > 0
        ? sortLivesByViewersDesc(activeLives.filter((l) => followingIds.has(l.hostId)))
        : [];

    const salonPool = salons.filter(isPublicSalon);
    const salonsFollowing =
      followingIds.size > 0
        ? sortSalonsByListenersDesc(salonPool.filter((s) => followingIds.has(s.hostId)))
        : [];

    const hasEventsFollowingSources =
      followingIds.size > 0 || savedEventPostIds.size > 0;
    const eventsFollowing = hasEventsFollowingSources
      ? applyFavoritesFirst(
          sortMapEventsForPanel(allMapEvents, favoriteIds).filter((e) =>
            isSidebarFollowingEvent(e, followingIds, savedEventPostIds)
          ),
          (e) => e.id,
          savedEventPostIds,
          true
        )
      : [];

    return {
      noFilters: true,
      zoomTooWide: false,
      eventClustersFollowing: [],
      eventClusters: [],
      eventClustersSuggestions: [],
      eventsFollowing,
      events: [],
      eventsSuggestions: [],
      livesFollowing,
      lives: [],
      livesSuggestions: [],
      salonsFollowing,
      salons: [],
      salonsSuggestions: [],
      people: [],
    };
  }

  const { tier, bounds } = detail;
  const fetchAnchor =
    nearbyFetchCenter ?? (bounds ? getMapBoundsCenter(bounds) : null);
  /** Clip lives/personnes seulement quand bounds stables (évite blackout flyTo). */
  const livesClipGeo =
    fetchAnchor != null && shouldClipMapMarkersToViewport(detail, fetchAnchor);
  const visibility = getMapMarkerVisibility({
    tier,
    eventsOnly,
    hasEventClusters: eventClusters.length > 0,
    showAllSalonsAtCityZoom,
    livesFilterOn,
    salonFilterOn,
    eventsFilterOn,
  });

  /** Salon filter shows overview dots — do not block the sidebar at world zoom. */
  const zoomTooWide = tier === 'overview' && livesFilterOn && !salonFilterOn;

  let sidebarClusters: MapEventCityCluster[] = [];
  let sidebarEvents: MapEventMarker[] = [];

  if (eventsFilterOn) {
    if (tier === 'overview' && visibility.eventClusters) {
      sidebarClusters = filterMarkersInViewport(eventClusters, bounds);
    } else if (tier !== 'overview') {
      const sorted = sortMapEventsForPanel(mapEvents, favoriteIds);
      sidebarEvents = filterMarkersInViewport(sorted, bounds);
    }
  }

  const salonClipGeo =
    salonFilterOn &&
    fetchAnchor != null &&
    shouldClipMapMarkersToViewport(detail, fetchAnchor);
  const salonPool = salonFilterOn ? salons.filter(isPublicSalon) : salons;
  /** Overview : pas de clip viewport (points simplifiés, comme les clusters événements). */
  const salonsInView =
    salonFilterOn && tier !== 'overview' && salonClipGeo && fetchAnchor
      ? clipSalonsForMapView(salonPool, detail, fetchAnchor)
      : salonPool;
  const visibleSalons = filterSalonsForZoom(
    salonsInView,
    visibility,
    showAllSalonsAtCityZoom,
    tier
  );
  const sidebarSalons = salonFilterOn ? visibleSalons : [];

  const livesInView = livesClipGeo ? filterLivesInViewport(lives, bounds) : lives;
  const visibleLives = visibility.lives ? livesInView : [];
  const sidebarLives = livesFilterOn ? visibleLives : [];

  const peopleInView = livesClipGeo ? filterPeopleInViewport(people, bounds) : people;
  const visiblePeople = filterPeopleForZoom(peopleInView, visibility, tier);
  const salonHostIds = new Set(sidebarSalons.map((s) => s.hostId));
  const liveIds = new Set(sidebarLives.map((l) => l.id));
  const sidebarPeople =
    livesFilterOn && visibility.people
      ? visiblePeople.filter(
          (p) =>
            !p.salonId &&
            !(p.isLive && p.liveId && liveIds.has(p.liveId)) &&
            !salonHostIds.has(p.id)
        )
      : [];

  const sortedSalons = applyFavoritesFirst(
    sidebarSalons,
    (s) => s.hostId,
    favoriteIds,
    true
  );
  const sortedLives = applyFavoritesFirst(
    sidebarLives,
    (l) => l.hostId,
    favoriteIds,
    true
  );

  const MAP_LIVE_SUGGESTIONS_MAX = MAP_SIDEBAR_SUGGESTIONS_MAX;
  const activeLives = lives.filter((l) => l.isActive !== false);
  const livesFollowing =
    livesFilterOn && followingIds.size > 0
      ? sortLivesByViewersDesc(activeLives.filter((l) => followingIds.has(l.hostId)))
      : [];
  const inViewLiveIds = new Set(sortedLives.map((l) => l.id));
  const livesSuggestions =
    livesFilterOn
      ? sortLivesByViewersDesc(
          activeLives.filter(
            (l) => !followingIds.has(l.hostId) && !inViewLiveIds.has(l.id)
          )
        ).slice(0, MAP_LIVE_SUGGESTIONS_MAX)
      : [];

  const salonsFollowing =
    salonFilterOn && followingIds.size > 0
      ? sortSalonsByListenersDesc(
          salonPool.filter((s) => followingIds.has(s.hostId))
        )
      : [];
  const inViewSalonIds = new Set(sortedSalons.map((s) => s.id));
  const salonsSuggestions =
    salonFilterOn
      ? sortSalonsByListenersDesc(
          salonPool.filter(
            (s) => !followingIds.has(s.hostId) && !inViewSalonIds.has(s.id)
          )
        ).slice(0, MAP_SIDEBAR_SUGGESTIONS_MAX)
      : [];

  const sortedAllEvents = sortMapEventsForPanel(mapEvents, favoriteIds);
  const hasEventsFollowingSources =
    followingIds.size > 0 || savedEventPostIds.size > 0;
  const eventsFollowing =
    eventsFilterOn && hasEventsFollowingSources
      ? applyFavoritesFirst(
          sortedAllEvents.filter((e) =>
            isSidebarFollowingEvent(e, followingIds, savedEventPostIds)
          ),
          (e) => e.id,
          savedEventPostIds,
          true
        )
      : [];
  const inViewEventIds = new Set(sidebarEvents.map((e) => e.id));
  const eventsSuggestions =
    eventsFilterOn
      ? sortMapEventsForPanel(
          mapEvents.filter(
            (e) =>
              !isSidebarFollowingEvent(e, followingIds, savedEventPostIds) &&
              !inViewEventIds.has(e.id)
          ),
          favoriteIds
        ).slice(0, MAP_SIDEBAR_SUGGESTIONS_MAX)
      : [];

  const inViewClusterKeys = new Set(sidebarClusters.map((c) => c.cityKey));
  const useEventClusters =
    eventsFilterOn && tier === 'overview' && visibility.eventClusters;
  const eventClustersFollowing =
    useEventClusters && hasEventsFollowingSources
      ? sortClustersByCountDesc(
          eventClusters.filter((c) =>
            clusterHasFollowingOrSavedEvent(c, followingIds, savedEventPostIds)
          )
        )
      : [];
  const eventClustersSuggestions =
    useEventClusters
      ? sortClustersByCountDesc(
          eventClusters.filter(
            (c) =>
              !inViewClusterKeys.has(c.cityKey) &&
              !clusterHasFollowingOrSavedEvent(c, followingIds, savedEventPostIds)
          )
        ).slice(0, MAP_SIDEBAR_SUGGESTIONS_MAX)
      : [];

  const sortedPeople = applyFavoritesFirst(
    sidebarPeople,
    (p) => p.id,
    favoriteIds,
    true
  );

  return {
    noFilters: false,
    zoomTooWide,
    eventClustersFollowing,
    eventClusters: sidebarClusters,
    eventClustersSuggestions,
    eventsFollowing,
    events: sidebarEvents,
    eventsSuggestions,
    livesFollowing,
    lives: sortedLives,
    livesSuggestions,
    salonsFollowing,
    salons: sortedSalons,
    salonsSuggestions,
    people: sortedPeople,
  };
}
