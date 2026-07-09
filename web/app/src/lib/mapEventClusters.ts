import { isValidLatLng } from './mapCoords';
import { applyFavoritesFirst } from './nearbyPanelSettings';
import type { MapEventCityCluster, MapEventMarker } from '../types';

const KNOWN_CITIES: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'montpellier', label: 'Montpellier', match: /montpellier/i },
  { key: 'le-cres', label: 'Le Crès', match: /le cr[eè]s/i },
  { key: 'paris', label: 'Paris', match: /paris/i },
  { key: 'lyon', label: 'Lyon', match: /lyon/i },
  { key: 'bordeaux', label: 'Bordeaux', match: /bordeaux/i },
];

/** Zoom Leaflet + rayon (km) pour cadrer une ville entière sur la carte plate. */
const CITY_MAP_VIEW: Record<string, { zoom: number; radiusKm: number }> = {
  paris: { zoom: 11, radiusKm: 18 },
  lyon: { zoom: 11, radiusKm: 16 },
  montpellier: { zoom: 12, radiusKm: 12 },
  'le-cres': { zoom: 13, radiusKm: 8 },
  bordeaux: { zoom: 11, radiusKm: 15 },
};

const DEFAULT_CITY_MAP_VIEW = { zoom: 11, radiusKm: 20 };

/** Vue carte pour une ville connue (zoom + fitBounds radius). */
export function getCityMapView(cityKey: string): { zoom: number; radiusKm: number } {
  return CITY_MAP_VIEW[cityKey.toLowerCase()] ?? DEFAULT_CITY_MAP_VIEW;
}

export function getCityMapZoom(cityKey: string): number {
  return getCityMapView(cityKey).zoom;
}

/** Extrait une clé ville stable depuis un libellé de lieu (venue, ville, adresse). */
export function extractCityFromLocation(location: string): { key: string; label: string } {
  const loc = location.trim();
  if (!loc) return { key: '_unknown', label: 'Autre' };

  for (const c of KNOWN_CITIES) {
    if (c.match.test(loc)) return { key: c.key, label: c.label };
  }

  const parts = loc.split(',').map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? loc;
  const key = last
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-');
  const label = last.charAt(0).toUpperCase() + last.slice(1);
  return { key, label };
}

/** Centroïde des coords événement (lieu réel), pas le centre-ville fixe. */
function clusterCenter(events: MapEventMarker[]): { latitude: number; longitude: number } {
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const e of events) {
    if (isValidLatLng(e.latitude, e.longitude)) {
      sumLat += e.latitude;
      sumLng += e.longitude;
      n++;
    }
  }
  if (n > 0) return { latitude: sumLat / n, longitude: sumLng / n };
  return { latitude: events[0]!.latitude, longitude: events[0]!.longitude };
}

/** Événements d'une ville : abonnements en tête, puis date croissante. */
export function sortMapEventsForPanel(
  events: MapEventMarker[],
  favoriteIds: Set<string>
): MapEventMarker[] {
  const byDate = [...events].sort((a, b) => {
    const ta = a.eventDate ? new Date(a.eventDate).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.eventDate ? new Date(b.eventDate).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
  return applyFavoritesFirst(byDate, (e) => e.authorId ?? '', favoriteIds, true);
}

/** Précision regroupement lieu (~11 m). */
export const EVENT_LOCATION_CLUSTER_DECIMALS = 4;

/** Clé stable pour regrouper les événements au même endroit. */
export function buildEventLocationKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(EVENT_LOCATION_CLUSTER_DECIMALS)},${longitude.toFixed(EVENT_LOCATION_CLUSTER_DECIMALS)}`;
}

function locationClusterLabel(events: MapEventMarker[]): string {
  const fromLocation = events
    .map((e) => e.eventLocation?.trim())
    .find((loc) => loc && loc.length > 0);
  if (fromLocation) return fromLocation;
  const title = events[0]?.title?.trim();
  return title || 'Événement';
}

/** Regroupe les marqueurs au même lieu (coords arrondies) — un pin par venue. */
export function clusterMapEventsByLocation(markers: MapEventMarker[]): MapEventCityCluster[] {
  const groups = new Map<string, MapEventMarker[]>();

  for (const m of markers) {
    if (!isValidLatLng(m.latitude, m.longitude)) continue;
    const key = buildEventLocationKey(m.latitude, m.longitude);
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }

  const clusters: MapEventCityCluster[] = [];
  for (const [locationKey, events] of groups) {
    const sorted = sortMapEventsForPanel(events, new Set());
    const center = clusterCenter(sorted);
    clusters.push({
      cityKey: locationKey,
      cityLabel: locationClusterLabel(sorted),
      latitude: center.latitude,
      longitude: center.longitude,
      events: sorted,
      count: sorted.length,
    });
  }

  return clusters.sort((a, b) => a.cityLabel.localeCompare(b.cityLabel, 'fr'));
}

/** Regroupe les marqueurs événement par ville — un pin par ville sur la carte. */
export function clusterMapEventsByCity(markers: MapEventMarker[]): MapEventCityCluster[] {
  const groups = new Map<string, { label: string; events: MapEventMarker[] }>();

  for (const m of markers) {
    const { key, label } = extractCityFromLocation(m.eventLocation?.trim() ?? '');
    const g = groups.get(key);
    if (g) {
      g.events.push(m);
    } else {
      groups.set(key, { label, events: [m] });
    }
  }

  const clusters: MapEventCityCluster[] = [];
  for (const [cityKey, { label, events }] of groups) {
    const sorted = sortMapEventsForPanel(events, new Set());
    const center = clusterCenter(sorted);
    clusters.push({
      cityKey,
      cityLabel: label,
      latitude: center.latitude,
      longitude: center.longitude,
      events: sorted,
      count: sorted.length,
    });
  }

  return clusters.sort((a, b) => a.cityLabel.localeCompare(b.cityLabel, 'fr'));
}
