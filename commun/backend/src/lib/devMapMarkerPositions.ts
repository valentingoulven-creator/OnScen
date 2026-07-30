import { isValidLatLng } from './mapCoords';

export type DevMapMarkerKind = 'salon' | 'live' | 'person' | 'event';

export interface DevMapMarkerPositionEntry {
  kind: DevMapMarkerKind;
  id: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
}

const overrides = new Map<string, DevMapMarkerPositionEntry>();

function key(kind: DevMapMarkerKind, id: string): string {
  return `${kind}:${id}`;
}

function isDevDraggableMarkerKind(kind: DevMapMarkerKind): boolean {
  return kind === 'event';
}

export function snapshotDevMapMarkerPositions(): DevMapMarkerPositionEntry[] {
  return Array.from(overrides.values()).filter((entry) => isDevDraggableMarkerKind(entry.kind));
}

export function restoreDevMapMarkerPositions(entries: DevMapMarkerPositionEntry[] | undefined): void {
  overrides.clear();
  for (const entry of entries ?? []) {
    if (!entry?.id || !entry.kind) continue;
    if (!isDevDraggableMarkerKind(entry.kind)) continue;
    if (!isValidLatLng(entry.latitude, entry.longitude)) continue;
    overrides.set(key(entry.kind, entry.id), entry);
  }
}

export function listDevMapMarkerPositions(): DevMapMarkerPositionEntry[] {
  return snapshotDevMapMarkerPositions();
}

export function setDevMapMarkerPosition(
  kind: DevMapMarkerKind,
  id: string,
  latitude: number,
  longitude: number
): DevMapMarkerPositionEntry {
  const trimmedId = String(id || '').trim();
  if (!trimmedId) throw new Error('Identifiant marqueur requis');
  if (!isValidLatLng(latitude, longitude)) throw new Error('Coordonnées invalides');
  if (kind !== 'event') {
    throw new Error('Seuls les marqueurs événement peuvent être déplacés');
  }

  const entry: DevMapMarkerPositionEntry = {
    kind,
    id: trimmedId,
    latitude,
    longitude,
    updatedAt: Date.now(),
  };
  overrides.set(key(kind, trimmedId), entry);

  return entry;
}
