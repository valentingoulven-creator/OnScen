import { db } from '../models/schema';
import { blurCoordinate } from './geo';
import { refreshUserPublicCoords, resolveCityCoordinates } from './locationPrivacy';

export const DEFAULT_MAP_LAT = 48.8566;
export const DEFAULT_MAP_LON = 2.3522;

export function isValidCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function isValidLatLng(lat: unknown, lon: unknown): boolean {
  return (
    isValidCoord(lat) &&
    isValidCoord(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function sanitizeLatLng(
  lat: unknown,
  lon: unknown,
  fallback: { latitude: number; longitude: number } = {
    latitude: DEFAULT_MAP_LAT,
    longitude: DEFAULT_MAP_LON,
  }
): { latitude: number; longitude: number } {
  if (isValidLatLng(lat, lon)) {
    return { latitude: lat as number, longitude: lon as number };
  }
  return { ...fallback };
}

/** Corrige utilisateurs / salons / lives avec coords manquantes ou NaN (données persistées ou seed ancien). */
export function repairInvalidGeoInDb(): number {
  let fixed = 0;

  for (const user of db.users.values()) {
    let changed = false;
    if (!isValidLatLng(user.latitude, user.longitude)) {
      if (user.city?.trim()) {
        const [lat, lon] = resolveCityCoordinates(user.city);
        user.latitude = lat;
        user.longitude = lon;
      } else {
        user.latitude = DEFAULT_MAP_LAT;
        user.longitude = DEFAULT_MAP_LON;
      }
      changed = true;
    }
    if (
      changed ||
      !isValidLatLng(user.blurredLatitude, user.blurredLongitude)
    ) {
      refreshUserPublicCoords(user);
      changed = true;
    }
    if (changed) {
      db.users.set(user.id, user);
      fixed++;
    }
  }

  for (const salon of db.salons.values()) {
    let changed = false;
    if (!isValidLatLng(salon.latitude, salon.longitude)) {
      const host = db.users.get(salon.hostId);
      const hostCoords = host
        ? sanitizeLatLng(host.latitude, host.longitude)
        : { latitude: DEFAULT_MAP_LAT, longitude: DEFAULT_MAP_LON };
      salon.latitude = hostCoords.latitude;
      salon.longitude = hostCoords.longitude;
      changed = true;
    }
    if (!isValidLatLng(salon.blurredLatitude, salon.blurredLongitude)) {
      salon.blurredLatitude = blurCoordinate(salon.latitude);
      salon.blurredLongitude = blurCoordinate(salon.longitude);
      changed = true;
    }
    if (changed) {
      db.salons.set(salon.id, salon);
      fixed++;
    }
  }

  for (const live of db.lives.values()) {
    let changed = false;
    if (!isValidLatLng(live.latitude, live.longitude)) {
      if (live.salonId) {
        const salon = db.salons.get(live.salonId);
        if (salon && isValidLatLng(salon.latitude, salon.longitude)) {
          live.latitude = salon.latitude;
          live.longitude = salon.longitude;
          live.blurredLatitude = salon.blurredLatitude;
          live.blurredLongitude = salon.blurredLongitude;
          changed = true;
        }
      }
      if (!changed) {
        const host = db.users.get(live.hostId);
        const hostCoords = host
          ? sanitizeLatLng(host.latitude, host.longitude)
          : { latitude: DEFAULT_MAP_LAT, longitude: DEFAULT_MAP_LON };
        live.latitude = hostCoords.latitude;
        live.longitude = hostCoords.longitude;
        changed = true;
      }
    }
    if (!isValidLatLng(live.blurredLatitude, live.blurredLongitude)) {
      live.blurredLatitude = blurCoordinate(live.latitude);
      live.blurredLongitude = blurCoordinate(live.longitude);
      changed = true;
    }
    if (changed) {
      db.lives.set(live.id, live);
      fixed++;
    }
  }

  return fixed;
}
