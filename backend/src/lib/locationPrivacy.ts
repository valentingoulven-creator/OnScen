import { User } from '../models/schema';
import { blurCoordinate } from './geo';
import { isValidLatLng, sanitizeLatLng } from './mapCoords';

export type LocationPrecision = 'precise' | 'city';

const CITY_LOOKUP: { match: (c: string) => boolean; lat: number; lon: number }[] = [
  { match: (c) => c.includes('paris'), lat: 48.8566, lon: 2.3522 },
  { match: (c) => c.includes('lyon'), lat: 45.764, lon: 4.8357 },
  { match: (c) => c.includes('marseille'), lat: 43.2965, lon: 5.3698 },
  { match: (c) => c.includes('london') || c.includes('londres'), lat: 51.5074, lon: -0.1278 },
  { match: (c) => c.includes('berlin'), lat: 52.52, lon: 13.405 },
  { match: (c) => c.includes('madrid'), lat: 40.4168, lon: -3.7038 },
  { match: (c) => c.includes('rome') || c.includes('roma'), lat: 41.9028, lon: 12.4964 },
  { match: (c) => c.includes('amsterdam'), lat: 52.3676, lon: 4.9041 },
  { match: (c) => c.includes('bruxelles') || c.includes('brussels'), lat: 50.8503, lon: 4.3517 },
  { match: (c) => c.includes('montreal') || c.includes('montréal'), lat: 45.5017, lon: -73.5673 },
  { match: (c) => c.includes('new york') || c.includes('nyc'), lat: 40.7128, lon: -74.006 },
  { match: (c) => c.includes('los angeles'), lat: 34.0522, lon: -118.2437 },
  { match: (c) => c.includes('tokyo'), lat: 35.6762, lon: 139.6503 },
  { match: (c) => c.includes('seoul'), lat: 37.5665, lon: 126.978 },
  { match: (c) => c.includes('sydney'), lat: -33.8688, lon: 151.2093 },
  { match: (c) => c.includes('dubai'), lat: 25.2048, lon: 55.2708 },
  { match: (c) => c.includes('mumbai'), lat: 19.076, lon: 72.8777 },
  { match: (c) => c.includes('são paulo') || c.includes('sao paulo'), lat: -23.5505, lon: -46.6333 },
];

export function userSharesDistance(user: User): boolean {
  return user.shareDistance !== false;
}

export function userCityOnlyLocation(user: User): boolean {
  return user.locationPrecision === 'city';
}

export function resolveCityCoordinates(city: string): [number, number] {
  const normalized = city.trim().toLowerCase();
  for (const entry of CITY_LOOKUP) {
    if (entry.match(normalized)) return [entry.lat, entry.lon];
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  const lat = 48.8566 + ((hash % 1000) / 1000 - 0.5) * 0.08;
  const lon = 2.3522 + (((hash >> 10) % 1000) / 1000 - 0.5) * 0.12;
  return [lat, lon];
}

/** Met à jour blurredLatitude/blurredLongitude selon les préférences de confidentialité. */
export function refreshUserPublicCoords(user: User): void {
  if (user.latitude == null || user.longitude == null) return;
  if (userCityOnlyLocation(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    user.blurredLatitude = lat;
    user.blurredLongitude = lon;
    return;
  }
  user.blurredLatitude = blurCoordinate(user.latitude);
  user.blurredLongitude = blurCoordinate(user.longitude);
}

export function getPublicMapCoords(
  user: User,
  preciseLat: number,
  preciseLon: number,
  blurredLat: number,
  blurredLon: number,
  viewerId?: string
): { latitude: number; longitude: number } {
  const precise = sanitizeLatLng(preciseLat, preciseLon);
  const blurred = sanitizeLatLng(blurredLat, blurredLon, precise);
  if (viewerId === user.id) {
    return precise;
  }
  if (userCityOnlyLocation(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    return { latitude: lat, longitude: lon };
  }
  return blurred;
}

export function getUserPublicCoords(user: User, viewerId?: string): { lat: number; lon: number } | null {
  if (user.latitude == null || user.longitude == null) return null;
  if (viewerId === user.id) {
    return { lat: user.latitude, lon: user.longitude };
  }
  if (userCityOnlyLocation(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    return { lat, lon };
  }
  if (!isValidLatLng(user.blurredLatitude, user.blurredLongitude)) return null;
  return { lat: user.blurredLatitude!, lon: user.blurredLongitude! };
}

export function applyPrivacySettings(
  user: User,
  body: { shareDistance?: boolean; locationPrecision?: string }
): void {
  if (body.shareDistance !== undefined) {
    user.shareDistance = Boolean(body.shareDistance);
  }
  if (body.locationPrecision === 'precise' || body.locationPrecision === 'city') {
    user.locationPrecision = body.locationPrecision;
  }
  refreshUserPublicCoords(user);
}
