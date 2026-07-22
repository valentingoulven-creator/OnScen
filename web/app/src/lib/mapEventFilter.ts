import {
  getMapEventOccurrenceDates,
  getEventDates,
  getNextCalendarDayKeys,
  isMapEventOccurringToday,
  isMapEventVisibleAsSponsoPin,
  MAP_EVENTS_BROWSE_DAY_COUNT,
  MAP_EVENTS_BROWSE_MAX_DAY_COUNT,
} from './feedEvents';
import { normalizeCityLabel } from './eventLocationPresets';
import type { FeedEventType } from './eventType';
import { normalizeFeedEventType } from './eventType';
import { findNearestMajorCities, getLivesGeo, hasPersistedMapGeoPrefs, isFixedMapGeoSource } from './livesGeo';
import { extractCityFromLocation, getCityMapView } from './mapEventClusters';
import { isValidLatLng } from './mapCoords';
import { resolveEventCoordsSync, resolveEventCityCoordsSync } from './mapEventCoords';
import { getDistanceKm } from './mapMarkerVisibility';
import type { FeedPost, MapEventMarker } from '../types';

export const DEFAULT_EVENT_FILTER_RADIUS_KM = 30;

/** `all` = no type filter (tous). */
export type MapEventFilterEventType = 'all' | FeedEventType;

export interface MapEventFilterCriteria {
  dateFrom: string;
  dateTo: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  eventType: MapEventFilterEventType;
}

export const EMPTY_EVENT_FILTER: MapEventFilterCriteria = {
  dateFrom: '',
  dateTo: '',
  location: '',
  latitude: null,
  longitude: null,
  radiusKm: DEFAULT_EVENT_FILTER_RADIUS_KM,
  eventType: 'all',
};

/** Local calendar date as yyyy-MM-dd for HTML date inputs. */
export function getTodayDateInputValue(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Ville par défaut : profil utilisateur, sinon ville carte (getLivesGeo source city). */
const DEFAULT_EVENT_FILTER_GEO_LABEL_MAX_KM = 60;

function resolveMyPositionFilterLabel(lat: number, lon: number, storedLabel: string): string {
  const trimmed = storedLabel.trim();
  const nearest = findNearestMajorCities(lat, lon, 1)[0];
  if (nearest && nearest.distanceKm <= DEFAULT_EVENT_FILTER_GEO_LABEL_MAX_KM) {
    return nearest.label;
  }
  if (trimmed && trimmed !== 'Ma position') return trimmed;
  return trimmed || 'Ma position';
}

/** Lieu par défaut filtre événement : GPS actif → profil → ville/adresse carte. */
export function resolveDefaultEventFilterLocation(profileCity?: string): {
  location: string;
  latitude: number | null;
  longitude: number | null;
} {
  const geo = getLivesGeo();
  const geoSaved = hasPersistedMapGeoPrefs();

  if (
    geoSaved &&
    geo.source === 'my_position' &&
    isValidLatLng(geo.latitude, geo.longitude)
  ) {
    return {
      location: resolveMyPositionFilterLabel(geo.latitude, geo.longitude, geo.label),
      latitude: geo.latitude,
      longitude: geo.longitude,
    };
  }

  const profileLabel = normalizeCityLabel(profileCity ?? '');
  if (profileLabel) {
    const coords = resolveEventCoordsSync(profileLabel) ?? resolveEventCityCoordsSync(profileLabel);
    return {
      location: profileLabel,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };
  }

  if (
    geoSaved &&
    isFixedMapGeoSource(geo.source) &&
    geo.label.trim() &&
    isValidLatLng(geo.latitude, geo.longitude)
  ) {
    return {
      location: geo.label.trim(),
      latitude: geo.latitude,
      longitude: geo.longitude,
    };
  }

  return { location: '', latitude: null, longitude: null };
}

export function resolveDefaultUserCityLabel(profileCity?: string): string {
  return resolveDefaultEventFilterLocation(profileCity).location;
}

/** Default filter state: from today, geo or profile city when known. */
export function createDefaultEventFilter(profileCity?: string): MapEventFilterCriteria {
  const { location, latitude, longitude } = resolveDefaultEventFilterLocation(profileCity);
  return {
    ...EMPTY_EVENT_FILTER,
    dateFrom: getTodayDateInputValue(),
    location,
    latitude,
    longitude,
  };
}

/** Complète un brouillon (ouverture sheet) : date Du + lieu si vides. */
export function applyEventFilterDraftDefaults(
  criteria: MapEventFilterCriteria,
  profileCity?: string
): MapEventFilterCriteria {
  const defaults = resolveDefaultEventFilterLocation(profileCity);
  const hasExplicitLocation = Boolean(criteria.location.trim());
  const location = criteria.location.trim() || defaults.location;

  return {
    ...criteria,
    dateFrom: criteria.dateFrom.trim() || getTodayDateInputValue(),
    location,
    latitude: hasExplicitLocation ? criteria.latitude : defaults.latitude,
    longitude: hasExplicitLocation ? criteria.longitude : defaults.longitude,
    radiusKm: criteria.radiusKm || DEFAULT_EVENT_FILTER_RADIUS_KM,
  };
}

/** Rayon de cadrage carte pour une ville du filtre événement (pas le rayon de recherche). */
export function getEventFilterCityMapRadiusKm(locationLabel: string): number {
  const { key } = extractCityFromLocation(locationLabel);
  return getCityMapView(key).radiusKm;
}

export function hasEventFilterCityLocation(criteria: MapEventFilterCriteria): boolean {
  return Boolean(
    criteria.location.trim() &&
      criteria.latitude != null &&
      criteria.longitude != null &&
      isValidLatLng(criteria.latitude, criteria.longitude)
  );
}

export function hasActiveEventFilterCriteria(criteria: MapEventFilterCriteria): boolean {
  return Boolean(
    criteria.dateFrom.trim() ||
      criteria.dateTo.trim() ||
      criteria.location.trim() ||
      criteria.eventType !== 'all'
  );
}

export function isEventDateInRange(
  iso: string,
  dateFrom: string,
  dateTo: string
): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;

  if (dateFrom.trim()) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    if (t < from.getTime()) return false;
  }

  if (dateTo.trim()) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    if (t > to.getTime()) return false;
  }

  return true;
}

function enumerateCalendarDayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(12, 0, 0, 0);
  while (d.getTime() <= endAt.getTime()) {
    keys.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function parseCalendarDayInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Jours affichés dans le browse sheet : 3 jours par défaut ;
 * si le filtre définit une plage > 3 jours, toutes les dates de la plage (max 31).
 */
export function getBrowseSheetCalendarDayKeys(
  criteria: MapEventFilterCriteria | undefined,
  eventsFilterOn: boolean,
  now = new Date()
): string[] {
  if (!eventsFilterOn || !criteria) {
    return getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, now);
  }

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  const start = parseCalendarDayInput(criteria.dateFrom) ?? today;
  const end = parseCalendarDayInput(criteria.dateTo);

  if (!end) {
    return getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, start);
  }

  if (end.getTime() < start.getTime()) {
    return getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, start);
  }

  const spanDays =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (spanDays <= MAP_EVENTS_BROWSE_DAY_COUNT) {
    return enumerateCalendarDayKeys(start, end);
  }

  const cappedEnd = new Date(start);
  cappedEnd.setDate(cappedEnd.getDate() + MAP_EVENTS_BROWSE_MAX_DAY_COUNT - 1);
  const effectiveEnd = end.getTime() < cappedEnd.getTime() ? end : cappedEnd;
  return enumerateCalendarDayKeys(start, effectiveEnd);
}

export function filterMapEventsByCriteria(
  events: MapEventMarker[],
  criteria: MapEventFilterCriteria,
  opts?: { viewerId?: string }
): MapEventMarker[] {
  let result = events;

  if (criteria.eventType !== 'all') {
    result = result.filter(
      (event) => (event.eventType ?? 'autre') === criteria.eventType
    );
  }

  if (criteria.dateFrom.trim() || criteria.dateTo.trim()) {
    result = result.filter((event) => {
      const dates = getMapEventOccurrenceDates(event);
      if (!dates.length) return false;
      return dates.some((iso) =>
        isEventDateInRange(iso, criteria.dateFrom, criteria.dateTo)
      );
    });
  }

  const location = criteria.location.trim();
  if (
    location &&
    criteria.latitude != null &&
    criteria.longitude != null &&
    Number.isFinite(criteria.latitude) &&
    Number.isFinite(criteria.longitude)
  ) {
    const { latitude, longitude, radiusKm } = criteria;
    const viewerId = opts?.viewerId;
    result = result.filter(
      (event) =>
        (viewerId && event.authorId === viewerId) ||
        getDistanceKm(latitude, longitude, event.latitude, event.longitude) <= radiusKm
    );
  }

  return result;
}

/** Même logique que filterMapEventsByCriteria, appliquée aux publications fil. */
export function filterFeedPostsByEventCriteria(
  posts: FeedPost[],
  criteria: MapEventFilterCriteria,
  opts?: { viewerId?: string }
): FeedPost[] {
  let result = posts;

  if (criteria.eventType !== 'all') {
    result = result.filter((post) => (post.eventType ?? 'autre') === criteria.eventType);
  }

  if (criteria.dateFrom.trim() || criteria.dateTo.trim()) {
    result = result.filter((post) => {
      const dates = getEventDates(post);
      if (!dates.length) return false;
      return dates.some((iso) => isEventDateInRange(iso, criteria.dateFrom, criteria.dateTo));
    });
  }

  const location = criteria.location.trim();
  if (
    location &&
    criteria.latitude != null &&
    criteria.longitude != null &&
    Number.isFinite(criteria.latitude) &&
    Number.isFinite(criteria.longitude)
  ) {
    const { latitude, longitude, radiusKm } = criteria;
    const viewerId = opts?.viewerId;
    result = result.filter((post) => {
      if (viewerId && post.author.id === viewerId) return true;
      const label = post.eventLocation?.trim();
      if (!label) return false;
      const coords = resolveEventCoordsSync(label);
      if (!coords || !isValidLatLng(coords.latitude, coords.longitude)) return false;
      return getDistanceKm(latitude, longitude, coords.latitude, coords.longitude) <= radiusKm;
    });
  }

  return result;
}

/** Ne garde que les événements du type feed (dance · chant · autre). */
export function filterMapEventsByEventType(
  events: MapEventMarker[],
  eventType: FeedEventType
): MapEventMarker[] {
  return events.filter((event) => normalizeFeedEventType(event.eventType) === eventType);
}

/** Ne garde que les publications du type feed. */
export function filterFeedPostsByEventType(
  posts: FeedPost[],
  eventType: FeedEventType
): FeedPost[] {
  return posts.filter((post) => normalizeFeedEventType(post.eventType) === eventType);
}

/** Ne garde que les événements ayant au moins une occurrence le jour calendaire `dayKey` (yyyy-MM-dd). */
export function filterMapEventsOnCalendarDay(
  events: MapEventMarker[],
  dayKey: string
): MapEventMarker[] {
  const key = dayKey.trim();
  if (!key) return events;
  return events.filter((event) =>
    getMapEventOccurrenceDates(event).some(
      (iso) => new Date(iso).toLocaleDateString('en-CA') === key
    )
  );
}

/** Au moins une occurrence aujourd'hui (jour calendaire locale). */
export function filterMapEventsOccurringToday(
  events: MapEventMarker[],
  now = new Date()
): MapEventMarker[] {
  return events.filter((event) => isMapEventOccurringToday(event, now));
}

/** Aujourd'hui ou demain — vue globe overview (festivals multi-jours). */
export function filterMapEventsOccurringTodayOrTomorrow(
  events: MapEventMarker[],
  now = new Date()
): MapEventMarker[] {
  const today = now.toLocaleDateString('en-CA');
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
  return events.filter((event) =>
    getMapEventOccurrenceDates(event).some((iso) => {
      const day = new Date(iso).toLocaleDateString('en-CA');
      return day === today || day === tomorrowStr;
    })
  );
}

/**
 * Pins carte : événements classiques = aujourd'hui (ou demain en globe) ;
 * Sponso = toute date non passée (campagnes visibles jusqu'au jour J inclus).
 */
export function filterMapEventPinsForView(
  events: MapEventMarker[],
  opts: {
    eventsFilterOn: boolean;
    globeOverview: boolean;
    filteredWhenCriteria?: MapEventMarker[];
    merge: (regular: MapEventMarker[], sponsored: MapEventMarker[]) => MapEventMarker[];
  }
): MapEventMarker[] {
  if (opts.eventsFilterOn) {
    const pool = opts.filteredWhenCriteria ?? events;
    const regular = pool.filter((event) => !event.isSponsored);
    /** Sponso : hors critères filtre (toujours visible si date non passée). */
    const sponsored = events.filter((event) => isMapEventVisibleAsSponsoPin(event));
    return opts.merge(regular, sponsored);
  }

  const sponsored = events.filter((event) => isMapEventVisibleAsSponsoPin(event));
  const regular = events.filter((event) => !event.isSponsored);
  const filteredRegular = opts.globeOverview
    ? filterMapEventsOccurringTodayOrTomorrow(regular)
    : filterMapEventsOccurringToday(regular);
  return opts.merge(filteredRegular, sponsored);
}
