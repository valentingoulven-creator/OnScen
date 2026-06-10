import { sortMapEventsForPanel } from './mapEventClusters';
import {
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
  eventClusters: MapEventCityCluster[];
  events: MapEventMarker[];
  lives: Live[];
  salons: Salon[];
  people: NearbyPerson[];
}

export function countMapSidebarItems(content: MapSidebarContent): number {
  return (
    content.eventClusters.length +
    content.events.length +
    content.lives.length +
    content.salons.length +
    content.people.length
  );
}

/** Badge filtre Lives : lives + personnes live + hôtes salon live (zone visible). */
export function countLivesFilterBadge(
  livesFilterOn: boolean,
  salonFilterOn: boolean,
  content: MapSidebarContent,
  liveSalonCount: number
): number {
  if (!livesFilterOn || content.zoomTooWide) return 0;
  let count = content.lives.length + content.people.length;
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
    nearbyFetchCenter,
  } = opts;

  const anyFilter = eventsFilterOn || livesFilterOn || salonFilterOn;
  if (!anyFilter) {
    return {
      noFilters: true,
      zoomTooWide: false,
      eventClusters: [],
      events: [],
      lives: [],
      salons: [],
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

  const zoomTooWide = tier === 'overview' && (livesFilterOn || salonFilterOn);

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

  const salonPool = salonFilterOn ? salons.filter(isPublicSalon) : salons;
  const salonsInView = filterMarkersInViewport(salonPool, bounds);
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
  const sortedPeople = applyFavoritesFirst(
    sidebarPeople,
    (p) => p.id,
    favoriteIds,
    true
  );

  return {
    noFilters: false,
    zoomTooWide,
    eventClusters: sidebarClusters,
    events: sidebarEvents,
    lives: sortedLives,
    salons: sortedSalons,
    people: sortedPeople,
  };
}
