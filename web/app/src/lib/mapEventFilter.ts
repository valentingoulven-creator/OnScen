import {
  getMapEventOccurrenceDates,
  getEventDates,
  getNextCalendarDayKeys,
  isMapEventOccurringToday,
  MAP_EVENTS_BROWSE_DAY_COUNT,
  MAP_EVENTS_BROWSE_MAX_DAY_COUNT,
} from './feedEvents';
import { normalizeCityLabel } from './eventLocationPresets';
import type { FeedEventType } from './eventType';
import { normalizeFeedEventType } from './eventType';
import { getLivesGeo } from './livesGeo';
import { extractCityFromLocation, getCityMapView } from './mapEventClusters';
import { isValidLatLng } from './mapCoords';
import { resolveEventCoordsSync } from './mapEventCoords';
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
export function resolveDefaultUserCityLabel(profileCity?: string): string {
  const fromProfile = normalizeCityLabel(profileCity ?? '');
  if (fromProfile) return fromProfile;
  const geo = getLivesGeo();
  if (geo.source === 'city' && geo.label.trim()) {
    return geo.label.trim();
  }
  return '';
}

/** Default filter state: from today, user's city when known. */
export function createDefaultEventFilter(profileCity?: string): MapEventFilterCriteria {
  return {
    ...EMPTY_EVENT_FILTER,
    dateFrom: getTodayDateInputValue(),
    location: resolveDefaultUserCityLabel(profileCity),
  };
}

/** Complète un brouillon (ouverture sheet) : date Du + ville si vides. */
export function applyEventFilterDraftDefaults(
  criteria: MapEventFilterCriteria,
  profileCity?: string
): MapEventFilterCriteria {
  return {
    ...criteria,
    dateFrom: criteria.dateFrom.trim() || getTodayDateInputValue(),
    location: criteria.location.trim() || resolveDefaultUserCityLabel(profileCity),
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
 * Jours affichés dans le browse sheet : 4 jours par défaut ;
 * si le filtre définit une plage > 4 jours, toutes les dates de la plage (max 31).
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
