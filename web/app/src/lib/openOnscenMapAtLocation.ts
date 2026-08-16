import { isValidLatLng } from './mapCoords';
import { resolveEventCityCoordsSync, resolveEventCoordsSync } from './mapEventCoords';
import { requestMapFlyToPlace } from './mapSearchIntent';
import { dispatchMapOpenTab } from './mapUiEvents';

/** Zoom lieu — aligné sur le fly sidebar événement (`MAP_SIDEBAR_EVENT_FLY_RADIUS_KM`). */
export const ONSCEN_MAP_VENUE_FLY_RADIUS_KM = 1.2;

export function resolveOpenLocationCoords(opts: {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
}): { latitude: number; longitude: number } | null {
  const lat = opts.latitude;
  const lon = opts.longitude;
  if (typeof lat === 'number' && typeof lon === 'number' && isValidLatLng(lat, lon)) {
    return { latitude: lat, longitude: lon };
  }
  const location = opts.label.trim();
  if (!location) return null;
  return resolveEventCoordsSync(location) ?? resolveEventCityCoordsSync(location);
}

/** Centre la carte in-app sur le lieu, puis ouvre l’onglet Carte. */
export function openOnscenMapAtLocation(opts: {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const coords = resolveOpenLocationCoords(opts);
  if (coords) {
    requestMapFlyToPlace({
      location: opts.label.trim() || 'Lieu',
      latitude: coords.latitude,
      longitude: coords.longitude,
      kind: 'city',
      nonce: Date.now(),
      radiusKm: ONSCEN_MAP_VENUE_FLY_RADIUS_KM,
    });
  }
  dispatchMapOpenTab();
  return coords != null;
}
