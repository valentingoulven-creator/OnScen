import { normalizeCityLabel } from './eventLocationPresets';
import { getLivesGeo } from './livesGeo';
import { getDistanceKm } from './mapMarkerVisibility';
import type { MapEventMarker } from '../types';

export const DEFAULT_EVENT_FILTER_RADIUS_KM = 30;

export interface MapEventFilterCriteria {
  dateFrom: string;
  dateTo: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
}

export const EMPTY_EVENT_FILTER: MapEventFilterCriteria = {
  dateFrom: '',
  dateTo: '',
  location: '',
  latitude: null,
  longitude: null,
  radiusKm: DEFAULT_EVENT_FILTER_RADIUS_KM,
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

export function hasActiveEventFilterCriteria(criteria: MapEventFilterCriteria): boolean {
  return Boolean(
    criteria.dateFrom.trim() ||
      criteria.dateTo.trim() ||
      criteria.location.trim()
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

export function filterMapEventsByCriteria(
  events: MapEventMarker[],
  criteria: MapEventFilterCriteria,
  opts?: { viewerId?: string }
): MapEventMarker[] {
  let result = events;

  if (criteria.dateFrom.trim() || criteria.dateTo.trim()) {
    result = result.filter((event) =>
      event.eventDate
        ? isEventDateInRange(event.eventDate, criteria.dateFrom, criteria.dateTo)
        : false
    );
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
