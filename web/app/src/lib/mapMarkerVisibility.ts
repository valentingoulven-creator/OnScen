import { isValidLatLng } from './mapCoords';
import type { MapEventCityCluster } from '../types';

/**
 * Progressive disclosure of map markers by zoom / globe altitude.
 *
 * Flat map (Leaflet zoom):
 *   overview  z < 8   — event city clusters (no viewport clip), pas de capitales
 *     simplified dots for lives/salons when their filter is ON
 *   city      8 ≤ z < 12 — capitales (viewport), events ; salons/lives/people si filtre actif
 *   street    z ≥ 12  — idem (marqueurs passés filtrés par filtre carte)
 *
 * Globe (pointOfView altitude — lower = closer):
 *   overview  alt ≥ 0.6 — pas de capitales
 *   city      0.15 ≤ alt < 0.6 — capitales proches du centre visible
 *   street    alt < 0.15
 */

export type MapDetailTier = 'overview' | 'city' | 'street';

export type MapStyleKind = 'flat' | 'globe';

/** Bounding box of the visible flat map (degrees). */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Zoom / altitude state reported by MapView for sidebar filtering. */
export interface MapViewDetailState {
  tier: MapDetailTier;
  flatZoom: number;
  /** Set when globe is active; null on flat map. */
  globeAltitude: number | null;
  bounds: MapBounds | null;
  mapStyle: MapStyleKind;
}

const BOUNDS_EPSILON = 0.0005;

/** Compare visible map bounds (degrees) within a small tolerance. */
export function mapBoundsEqual(
  a: MapBounds | null | undefined,
  b: MapBounds | null | undefined,
  epsilon = BOUNDS_EPSILON
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.north - b.north) < epsilon &&
    Math.abs(a.south - b.south) < epsilon &&
    Math.abs(a.east - b.east) < epsilon &&
    Math.abs(a.west - b.west) < epsilon
  );
}

/**
 * True when sidebar filtering would yield the same result (tier + visible bounds).
 * Ignores raw zoom/altitude within the same tier.
 */
export function mapSidebarDetailEqual(
  a: MapViewDetailState,
  b: MapViewDetailState
): boolean {
  if (a.tier !== b.tier || a.mapStyle !== b.mapStyle) return false;
  if (a.mapStyle === 'globe') {
    const altA = a.globeAltitude ?? 0;
    const altB = b.globeAltitude ?? 0;
    return Math.abs(altA - altB) < 0.002;
  }
  return mapBoundsEqual(a.bounds, b.bounds);
}

/** Centre géographique d'une bounding box carte plate. */
export function getMapBoundsCenter(bounds: MapBounds): [number, number] {
  return [(bounds.north + bounds.south) / 2, (bounds.west + bounds.east) / 2];
}

/** Distance approximative en km (haversine). */
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bounds stables pour un clip viewport : la zone visible contient le point
 * utilisé pour charger les données nearby (évite blackout pendant flyTo).
 */
export function areBoundsStableForViewportClip(
  bounds: MapBounds | null | undefined,
  anchorLat: number,
  anchorLng: number
): boolean {
  if (!bounds) return false;
  return isInMapBounds(anchorLat, anchorLng, bounds);
}

/** True quand marqueurs lives/personnes peuvent être filtrés par bounds (carte plate). */
export function shouldClipMapMarkersToViewport(
  detail: Pick<MapViewDetailState, 'mapStyle' | 'bounds'>,
  nearbyFetchCenter: [number, number]
): boolean {
  if (detail.mapStyle !== 'flat' || !detail.bounds) return false;
  return areBoundsStableForViewportClip(
    detail.bounds,
    nearbyFetchCenter[0],
    nearbyFetchCenter[1]
  );
}

export function isInMapBounds(
  latitude: number,
  longitude: number,
  bounds: MapBounds | null | undefined
): boolean {
  if (!bounds) return true;
  if (latitude < bounds.south || latitude > bounds.north) return false;
  if (bounds.west <= bounds.east) {
    return longitude >= bounds.west && longitude <= bounds.east;
  }
  // Antimeridian wrap
  return longitude >= bounds.west || longitude <= bounds.east;
}

/** Salon ouvert à tous (accessMode / isPublic, aligné backend normalizeSalonAccess). */
export function isPublicSalon(salon: {
  accessMode?: 'public' | 'invite';
  isPublic?: boolean;
}): boolean {
  if (salon.accessMode === 'invite') return false;
  if (salon.accessMode === 'public') return true;
  return salon.isPublic === true;
}

/**
 * Event clusters clipped to the visible flat-map viewport.
 * Overview: cluster pin at city centroid.
 * City / street: individual venue coords (MODIF 207) — keep cluster when any event is in view.
 */
export function filterEventClustersInViewport(
  clusters: MapEventCityCluster[],
  bounds: MapBounds | null | undefined,
  tier: MapDetailTier
): MapEventCityCluster[] {
  if (!bounds) return clusters;
  // Overview: city-level pins — skip viewport clip so clusters stay visible when dezoomed.
  if (tier === 'overview') {
    return clusters;
  }
  const result: MapEventCityCluster[] = [];
  for (const cluster of clusters) {
    const eventsInView = filterMarkersInViewport(cluster.events, bounds);
    if (eventsInView.length === 0) continue;
    result.push({
      ...cluster,
      events: eventsInView,
      count: eventsInView.length,
    });
  }
  return result;
}

/** Clusters événement dans le rayon visible autour du centre globe (altitude caméra). */
export function filterEventClustersInGlobeRegion(
  clusters: MapEventCityCluster[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
): MapEventCityCluster[] {
  if (!isValidLatLng(centerLat, centerLng) || radiusKm <= 0) return clusters;
  const result: MapEventCityCluster[] = [];
  for (const cluster of clusters) {
    const eventsInView = cluster.events.filter(
      (event) =>
        isValidLatLng(event.latitude, event.longitude) &&
        getDistanceKm(centerLat, centerLng, event.latitude, event.longitude) <= radiusKm
    );
    if (eventsInView.length === 0) continue;
    result.push({
      ...cluster,
      events: eventsInView,
      count: eventsInView.length,
    });
  }
  return result;
}

/** Marqueurs lat/lng dans la zone visible (carte plate ; globe = pas de bounds). */
export function filterMarkersInViewport<T extends { latitude: number; longitude: number }>(
  items: T[],
  bounds: MapBounds | null | undefined
): T[] {
  if (!bounds) return items;
  return items.filter(
    (item) =>
      isValidLatLng(item.latitude, item.longitude) &&
      isInMapBounds(item.latitude, item.longitude, bounds)
  );
}

/** Salons dont les coordonnées tombent dans la zone visible (carte plate). */
export function filterSalonsInViewport<T extends { latitude: number; longitude: number }>(
  salons: T[],
  bounds: MapBounds | null | undefined
): T[] {
  return filterMarkersInViewport(salons, bounds);
}

/** Lives dont les coordonnées tombent dans la zone visible (carte plate). */
export function filterLivesInViewport<T extends { latitude: number; longitude: number }>(
  lives: T[],
  bounds: MapBounds | null | undefined
): T[] {
  return filterMarkersInViewport(lives, bounds);
}

export interface FilterMapEventMarkersInViewDetail {
  mapStyle: MapStyleKind;
  bounds: MapBounds | null | undefined;
  tier: MapDetailTier;
  centerLat: number;
  centerLng: number;
  globeAltitude: number | null;
}

export interface FilterMapEventMarkersInViewOpts {
  eventsFilterOn: boolean;
  dayPinFilter?: string | null;
}

/** Marqueurs événement (dont sponso) dans le viewport carte / rayon globe visible. */
export function filterMapEventMarkersInMapView<
  T extends { latitude: number; longitude: number },
>(
  markers: T[],
  detail: FilterMapEventMarkersInViewDetail,
  opts: FilterMapEventMarkersInViewOpts
): T[] {
  if (!opts.eventsFilterOn) return markers;

  if (detail.mapStyle === 'globe') {
    const restrictToViewport =
      opts.eventsFilterOn ||
      opts.dayPinFilter != null ||
      detail.tier !== 'overview';
    if (!restrictToViewport) return markers;

    const radiusKm = getGlobeCapitalVisibleRadiusKm(detail.globeAltitude ?? 0.6);
    const effectiveRadius =
      radiusKm > 0 ? radiusKm : opts.dayPinFilter ? 4000 : 0;
    if (effectiveRadius <= 0) return markers;

    return markers.filter(
      (marker) =>
        isValidLatLng(marker.latitude, marker.longitude) &&
        getDistanceKm(
          detail.centerLat,
          detail.centerLng,
          marker.latitude,
          marker.longitude
        ) <= effectiveRadius
    );
  }

  const restrictToViewport =
    opts.eventsFilterOn ||
    opts.dayPinFilter != null ||
    detail.tier !== 'overview';
  if (!restrictToViewport || !detail.bounds) return markers;

  return filterMarkersInViewport(markers, detail.bounds);
}

/**
 * Clip lives pour la carte : évite un blackout quand le clip viewport vide la liste
 * alors que des lives existent encore (bounds / fetch anchor transitoires).
 */
export function clipLivesForMapView<T extends { latitude: number; longitude: number }>(
  lives: T[],
  detail: Pick<MapViewDetailState, 'mapStyle' | 'bounds'>,
  nearbyFetchCenter: [number, number]
): T[] {
  if (!shouldClipMapMarkersToViewport(detail, nearbyFetchCenter)) return lives;
  const clipped = filterLivesInViewport(lives, detail.bounds);
  if (clipped.length === 0 && lives.length > 0) return lives;
  return clipped;
}

/** Même garde-fou que clipLivesForMapView pour les salons carte. */
export function clipSalonsForMapView<T extends { latitude: number; longitude: number }>(
  salons: T[],
  detail: Pick<MapViewDetailState, 'mapStyle' | 'bounds'>,
  nearbyFetchCenter: [number, number]
): T[] {
  if (!shouldClipMapMarkersToViewport(detail, nearbyFetchCenter)) return salons;
  const clipped = filterSalonsInViewport(salons, detail.bounds);
  if (clipped.length === 0 && salons.length > 0) return salons;
  return clipped;
}

/** Même garde-fou que clipLivesForMapView pour les personnes carte. */
export function clipPeopleForMapView<T extends { latitude?: number | null; longitude?: number | null }>(
  people: T[],
  detail: Pick<MapViewDetailState, 'mapStyle' | 'bounds'>,
  nearbyFetchCenter: [number, number]
): T[] {
  if (!shouldClipMapMarkersToViewport(detail, nearbyFetchCenter)) return people;
  const clipped = filterPeopleInViewport(people, detail.bounds);
  if (clipped.length === 0 && people.length > 0) return people;
  return clipped;
}

/** Personnes carte (lat/lng optionnels) dans la zone visible. */
export function filterPeopleInViewport<T extends { latitude?: number | null; longitude?: number | null }>(
  people: T[],
  bounds: MapBounds | null | undefined
): T[] {
  if (!bounds) return people;
  return people.filter((p) => {
    if (p.latitude == null || p.longitude == null) return false;
    return (
      isValidLatLng(p.latitude, p.longitude) &&
      isInMapBounds(p.latitude, p.longitude, bounds)
    );
  });
}

/** Filtre filtre Salon : publics uniquement, puis zone visible si bounds connus. */
export function filterSalonsForSalonMapFilter<T extends {
  latitude: number;
  longitude: number;
  accessMode?: 'public' | 'invite';
  isPublic?: boolean;
}>(salons: T[], bounds: MapBounds | null | undefined): T[] {
  return filterSalonsInViewport(salons.filter(isPublicSalon), bounds);
}

/** Leaflet zoom strictly below this → overview tier. */
export const FLAT_ZOOM_CITY_MIN = 8;
/** Leaflet zoom at or above this → street tier. */
export const FLAT_ZOOM_STREET_MIN = 12;

/** Globe altitude at or above this → overview tier. */
export const GLOBE_ALTITUDE_CITY_MAX = 0.6;
/** Globe altitude below this → street tier. */
export const GLOBE_ALTITUDE_STREET_MAX = 0.15;

export function getFlatMapDetailTier(zoom: number): MapDetailTier {
  if (zoom < FLAT_ZOOM_CITY_MIN) return 'overview';
  if (zoom < FLAT_ZOOM_STREET_MIN) return 'city';
  return 'street';
}

export function getGlobeDetailTier(altitude: number): MapDetailTier {
  if (altitude >= GLOBE_ALTITUDE_CITY_MAX) return 'overview';
  if (altitude >= GLOBE_ALTITUDE_STREET_MAX) return 'city';
  return 'street';
}

/** Rayon (km) autour du centre globe pour afficher les capitales au zoom pays. */
export function getGlobeCapitalVisibleRadiusKm(altitude: number): number {
  if (altitude >= GLOBE_ALTITUDE_CITY_MAX) return 0;
  if (altitude <= GLOBE_ALTITUDE_STREET_MAX) return 280;
  const span = GLOBE_ALTITUDE_CITY_MAX - GLOBE_ALTITUDE_STREET_MAX;
  const t = (GLOBE_ALTITUDE_CITY_MAX - altitude) / span;
  return 400 + t * 850;
}

export function filterCapitalsInGlobeRegion<T extends { lat: number; lng: number }>(
  capitals: T[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
): T[] {
  if (!isValidLatLng(centerLat, centerLng) || radiusKm <= 0) return [];
  return capitals.filter(
    (cap) => getDistanceKm(centerLat, centerLng, cap.lat, cap.lng) <= radiusKm
  );
}

export type MapMarkerDensity = 'full' | 'overview';

export interface MapMarkerVisibility {
  capitals: boolean;
  eventClusters: boolean;
  salons: boolean;
  lives: boolean;
  people: boolean;
  /** Filtre Lives seul : aucun pin salon (directs via `lives[]` uniquement). */
  livesPinsOnly: boolean;
  /** Filtre Salon seul : salons d’écoute hors direct (pas de pins / lignes live). */
  salonsPinsOnly: boolean;
  /** overview = simplified dots ; full = album-art markers. */
  density: MapMarkerDensity;
}

export interface MapMarkerVisibilityOptions {
  tier: MapDetailTier;
  /** Masque capitales (filtre Évènement seul). */
  eventsOnly: boolean;
  hasEventClusters: boolean;
  /**
   * Au zoom ville, afficher tous les salons passés (filtre Salon actif)
   * plutôt que les salons live uniquement.
   */
  showAllSalonsAtCityZoom?: boolean;
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
  eventsFilterOn?: boolean;
}

/** Salon filter ON → tous les salons dès le zoom ville (même si Lives est aussi actif). */
export function shouldShowAllSalonsAtCityZoom(salonFilterOn: boolean): boolean {
  return salonFilterOn;
}

export function getMapMarkerVisibility(opts: MapMarkerVisibilityOptions): MapMarkerVisibility {
  const {
    tier,
    eventsOnly,
    hasEventClusters,
    livesFilterOn = false,
    salonFilterOn = false,
    eventsFilterOn = false,
  } = opts;

  const capitals = !eventsOnly && tier !== 'overview';
  const anyContentFilter = livesFilterOn || salonFilterOn || eventsFilterOn;
  /** Pins événement : filtre Événement, ou ambiant si aucun filtre carte actif. */
  const eventClusters =
    eventsFilterOn || (!anyContentFilter && hasEventClusters);
  const livesPinsOnly = livesFilterOn && !salonFilterOn;
  const salonsPinsOnly = salonFilterOn && !livesFilterOn;

  switch (tier) {
    case 'overview':
      return {
        capitals,
        eventClusters,
        /** Salons visibles uniquement avec le filtre Salon actif. */
        salons: salonFilterOn,
        /** Lives masqués si filtre Salon seul ; sonars globe si aucun filtre Salon. */
        lives: !salonsPinsOnly,
        people: livesFilterOn && salonFilterOn,
        livesPinsOnly,
        salonsPinsOnly,
        density: 'overview',
      };
    case 'city':
    case 'street':
      return {
        capitals,
        eventClusters,
        salons: salonFilterOn,
        lives: !salonsPinsOnly,
        people: livesFilterOn && salonFilterOn,
        livesPinsOnly,
        salonsPinsOnly,
        density: 'full',
      };
  }
}

/**
 * Filtre salons : les salons live restent toujours visibles (plancher, indépendant des
 * filtres carte) ; les salons non-live ne s'affichent que si le filtre Salon (ou zoom rue
 * avec un filtre carte actif) demande le mode « tous les salons ».
 */
export function filterSalonsForZoom<T extends { isLive?: boolean }>(
  salons: T[],
  visibility: MapMarkerVisibility,
  showAllSalonsAtCityZoom: boolean,
  tier: MapDetailTier
): T[] {
  if (visibility.livesPinsOnly) return [];
  const pool = visibility.salonsPinsOnly ? salons.filter((s) => !s.isLive) : salons;
  const liveSalons = pool.filter((s) => s.isLive);
  if (tier === 'overview') {
    return showAllSalonsAtCityZoom ? pool : liveSalons;
  }
  if (tier === 'street') {
    return visibility.salons || showAllSalonsAtCityZoom ? pool : liveSalons;
  }
  // city
  return showAllSalonsAtCityZoom ? pool : liveSalons;
}

/** Filtre personnes : au zoom ville, live uniquement ; rue = actives (déjà filtrées en amont). */
export function filterPeopleForZoom<T extends { isLive?: boolean }>(
  people: T[],
  visibility: MapMarkerVisibility,
  tier: MapDetailTier
): T[] {
  if (!visibility.people) return [];
  if (tier === 'street') return people;
  return people.filter((p) => p.isLive);
}
