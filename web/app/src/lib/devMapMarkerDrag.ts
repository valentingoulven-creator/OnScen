import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';
import { isValidLatLng } from './mapCoords';
import { getStorageItem, setStorageItem } from './storageKeys';

export type DevMapMarkerKind = 'salon' | 'live' | 'person' | 'event';

/** Seuls les marqueurs événement individuels sont déplaçables en mode Dev. */
export function isDevDraggableMarkerKind(kind: DevMapMarkerKind): boolean {
  return kind === 'event';
}

export function filterDevDraggableOverrides(overrides: DevMapMarkerOverrides): DevMapMarkerOverrides {
  if (overrides.size === 0) return overrides;
  const next = new Map<string, DevMapMarkerPosition>();
  for (const [key, entry] of overrides) {
    if (isDevDraggableMarkerKind(entry.kind)) next.set(key, entry);
  }
  return next;
}

export interface DevMapMarkerRef {
  kind: DevMapMarkerKind;
  id: string;
}

export interface DevMapMarkerPosition extends DevMapMarkerRef {
  latitude: number;
  longitude: number;
}

export type DevMapMarkerOverrides = ReadonlyMap<string, DevMapMarkerPosition>;

const STORAGE_KEY = 'soundy_dev_map_marker_overrides';

export function devMapMarkerKey(kind: DevMapMarkerKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseDevMapMarkerKey(key: string): DevMapMarkerRef | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const kind = key.slice(0, idx) as DevMapMarkerKind;
  const id = key.slice(idx + 1);
  if (!id) return null;
  if (kind !== 'salon' && kind !== 'live' && kind !== 'person' && kind !== 'event') return null;
  return { kind, id };
}

export function readDevMapMarkerOverridesFromStorage(): DevMapMarkerOverrides {
  const raw = getStorageItem(STORAGE_KEY);
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw) as DevMapMarkerPosition[];
    const map = new Map<string, DevMapMarkerPosition>();
    for (const entry of parsed) {
      if (!entry?.id || !entry.kind) continue;
      if (!isValidLatLng(entry.latitude, entry.longitude)) continue;
      map.set(devMapMarkerKey(entry.kind, entry.id), {
        kind: entry.kind,
        id: entry.id,
        latitude: entry.latitude,
        longitude: entry.longitude,
      });
    }
    return filterDevDraggableOverrides(map);
  } catch {
    return new Map();
  }
}

export function writeDevMapMarkerOverridesToStorage(overrides: DevMapMarkerOverrides): void {
  setStorageItem(STORAGE_KEY, JSON.stringify(Array.from(overrides.values())));
}

export function mergeDevMapMarkerOverrides(
  base: DevMapMarkerOverrides,
  entries: DevMapMarkerPosition[]
): DevMapMarkerOverrides {
  const next = new Map(base);
  for (const entry of entries) {
    if (!isDevDraggableMarkerKind(entry.kind)) continue;
    if (!isValidLatLng(entry.latitude, entry.longitude)) continue;
    next.set(devMapMarkerKey(entry.kind, entry.id), entry);
  }
  return next;
}

function readOverrideCoords(
  overrides: DevMapMarkerOverrides,
  kind: DevMapMarkerKind,
  id: string
): { latitude: number; longitude: number } | null {
  const entry = overrides.get(devMapMarkerKey(kind, id));
  if (!entry || !isValidLatLng(entry.latitude, entry.longitude)) return null;
  return { latitude: entry.latitude, longitude: entry.longitude };
}

export function applyDevMarkerOverridesToSalons<T extends Pick<Salon, 'id' | 'latitude' | 'longitude'>>(
  salons: T[],
  overrides: DevMapMarkerOverrides
): T[] {
  if (overrides.size === 0) return salons;
  return salons.map((salon) => {
    const coords = readOverrideCoords(overrides, 'salon', salon.id);
    return coords ? { ...salon, latitude: coords.latitude, longitude: coords.longitude } : salon;
  });
}

export function applyDevMarkerOverridesToLives<T extends Pick<Live, 'id' | 'latitude' | 'longitude'>>(
  lives: T[],
  overrides: DevMapMarkerOverrides
): T[] {
  if (overrides.size === 0) return lives;
  return lives.map((live) => {
    const coords = readOverrideCoords(overrides, 'live', live.id);
    return coords ? { ...live, latitude: coords.latitude, longitude: coords.longitude } : live;
  });
}

export function applyDevMarkerOverridesToPeople<
  T extends Pick<NearbyPerson, 'id' | 'latitude' | 'longitude'>,
>(people: T[], overrides: DevMapMarkerOverrides): T[] {
  if (overrides.size === 0) return people;
  return people.map((person) => {
    const coords = readOverrideCoords(overrides, 'person', person.id);
    if (!coords) return person;
    return { ...person, latitude: coords.latitude, longitude: coords.longitude };
  });
}

export function applyDevMarkerOverridesToEvents(events: MapEventMarker[], overrides: DevMapMarkerOverrides) {
  if (overrides.size === 0) return events;
  return events.map((event) => {
    const coords = readOverrideCoords(overrides, 'event', event.id);
    return coords ? { ...event, latitude: coords.latitude, longitude: coords.longitude } : event;
  });
}

export function applyDevMarkerOverridesToEventClusters(
  clusters: MapEventCityCluster[],
  overrides: DevMapMarkerOverrides
): MapEventCityCluster[] {
  if (overrides.size === 0) return clusters;
  return clusters.map((cluster) => {
    const events = applyDevMarkerOverridesToEvents(cluster.events, overrides);
    if (events === cluster.events) return cluster;
    const first = events[0];
    const latitude = first?.latitude ?? cluster.latitude;
    const longitude = first?.longitude ?? cluster.longitude;
    return { ...cluster, events, latitude, longitude };
  });
}

export function devMarkerRefFromEntity(
  kind: DevMapMarkerKind,
  entity: { id: string } | undefined
): DevMapMarkerRef | null {
  if (!entity?.id) return null;
  return { kind, id: entity.id };
}

export function devMarkerRefFromEventEntity(
  entity: MapEventMarker | MapEventCityCluster | undefined
): DevMapMarkerRef | null {
  if (!entity) return null;
  if ('events' in entity) return null;
  return devMarkerRefFromEntity('event', entity);
}

/** Active le drag Leaflet + callback fin de déplacement (carte sombre, Dev). */
export function attachLeafletDevMarkerDrag(
  marker: {
    dragging?: { enable: () => void };
    on: (type: string, fn: () => void) => void;
    getLatLng: () => { lat: number; lng: number };
    getElement?: () => HTMLElement | null | undefined;
  },
  ref: DevMapMarkerRef,
  enabled: boolean,
  onDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void
): void {
  if (!enabled || !onDragEnd || !isDevDraggableMarkerKind(ref.kind)) return;
  marker.dragging?.enable();
  marker.on('dragend', () => {
    const ll = marker.getLatLng();
    onDragEnd(ref, ll.lat, ll.lng);
  });
  marker.getElement?.()?.classList.add('map-marker--dev-draggable');
}
