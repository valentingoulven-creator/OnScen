export interface PresetCity {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  /** Code postal principal (affichage + recherche). */
  postalCode?: string;
}

export type LivesGeoSource = 'my_position' | 'city' | 'address';

export interface LivesGeoPrefs {
  latitude: number;
  longitude: number;
  radiusKm: number;
  label: string;
  source: LivesGeoSource;
  /** Adresse saisie manuellement (source address). */
  addressLine?: string;
}

/** Centre carte fixe (ville prédéfinie ou adresse géocodée), sans GPS en direct. */
export function isFixedMapGeoSource(source: LivesGeoSource): boolean {
  return source === 'city' || source === 'address';
}

import { normalizeCityLabel } from './eventLocationPresets';
import { resolveEventCityCoordsSync, resolveEventCoordsSync } from './mapEventCoords';
import { clampNearbyRadiusKm, getNearbyRadiusKm, setNearbyRadiusKm } from './settings';

/** Point de référence carte / requêtes nearby (source GPS, ville ou adresse). */
export const LIVES_GEO_STORAGE_KEY = 'onscen_lives_geo';
const STORAGE_KEY = LIVES_GEO_STORAGE_KEY;

export const MAP_GEO_CHANGED_EVENT = 'onscen-map-geo-changed';

export const PRESET_CITIES: PresetCity[] = [
  { id: 'paris', label: 'Paris, France', latitude: 48.8566, longitude: 2.3522, postalCode: '75001' },
  { id: 'lyon', label: 'Lyon, France', latitude: 45.764, longitude: 4.8357, postalCode: '69001' },
  { id: 'marseille', label: 'Marseille, France', latitude: 43.2965, longitude: 5.3698, postalCode: '13001' },
  { id: 'montpellier', label: 'Montpellier, France', latitude: 43.6108, longitude: 3.8767, postalCode: '34000' },
  { id: 'toulouse', label: 'Toulouse, France', latitude: 43.6047, longitude: 1.4442, postalCode: '31000' },
  { id: 'bordeaux', label: 'Bordeaux, France', latitude: 44.8378, longitude: -0.5792, postalCode: '33000' },
  { id: 'nice', label: 'Nice, France', latitude: 43.7102, longitude: 7.262, postalCode: '06000' },
  { id: 'london', label: 'London, UK', latitude: 51.5074, longitude: -0.1278, postalCode: 'SW1A' },
  { id: 'berlin', label: 'Berlin, Germany', latitude: 52.52, longitude: 13.405, postalCode: '10115' },
  { id: 'madrid', label: 'Madrid, Spain', latitude: 40.4168, longitude: -3.7038, postalCode: '28001' },
  { id: 'rome', label: 'Rome, Italy', latitude: 41.9028, longitude: 12.4964, postalCode: '00100' },
  { id: 'amsterdam', label: 'Amsterdam, Netherlands', latitude: 52.3676, longitude: 4.9041, postalCode: '1012' },
  { id: 'brussels', label: 'Brussels, Belgium', latitude: 50.8503, longitude: 4.3517, postalCode: '1000' },
  { id: 'nyc', label: 'New York, USA', latitude: 40.7128, longitude: -74.006, postalCode: '10001' },
  { id: 'la', label: 'Los Angeles, USA', latitude: 34.0522, longitude: -118.2437, postalCode: '90001' },
  { id: 'montreal', label: 'Montréal, Canada', latitude: 45.5017, longitude: -73.5673, postalCode: 'H2X' },
  { id: 'tokyo', label: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503, postalCode: '100-0001' },
  { id: 'seoul', label: 'Seoul, South Korea', latitude: 37.5665, longitude: 126.978, postalCode: '04524' },
  { id: 'sydney', label: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, postalCode: '2000' },
  { id: 'dubai', label: 'Dubai, UAE', latitude: 25.2048, longitude: 55.2708 },
  { id: 'mumbai', label: 'Mumbai, India', latitude: 19.076, longitude: 72.8777, postalCode: '400001' },
  { id: 'sao-paulo', label: 'São Paulo, Brazil', latitude: -23.5505, longitude: -46.6333, postalCode: '01310' },
];

/** Centre carte par défaut (Paris) — repli si coords invalides ou géoloc indisponible. */
export const DEFAULT_CENTER: [number, number] = [
  PRESET_CITIES[0].latitude,
  PRESET_CITIES[0].longitude,
];

/** Point de référence par défaut : géolocalisation utilisateur (repli Paris si GPS indisponible). */
const DEFAULT_PREFS: Omit<LivesGeoPrefs, 'radiusKm'> = {
  latitude: DEFAULT_CENTER[0],
  longitude: DEFAULT_CENTER[1],
  label: 'Ma position',
  source: 'my_position',
};

function coordsFinite(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Distance approximative en km (haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearestMajorCity extends PresetCity {
  distanceKm: number;
}

/** Les N grandes villes prédéfinies les plus proches d'un point (live / salon sans GPS). */
export function findNearestMajorCities(
  lat: number,
  lon: number,
  limit = 3
): NearestMajorCity[] {
  const anchorLat = coordsFinite(lat, lon) ? lat : DEFAULT_CENTER[0];
  const anchorLon = coordsFinite(lat, lon) ? lon : DEFAULT_CENTER[1];
  return PRESET_CITIES.map((city) => ({
    ...city,
    distanceKm: haversineKm(anchorLat, anchorLon, city.latitude, city.longitude),
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export function presetCityMainLabel(c: PresetCity): string {
  return c.label.split(',')[0].trim();
}

function lookupPresetCityByName(name: string): PresetCity | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return PRESET_CITIES.find((c) => {
    const main = presetCityMainLabel(c).toLowerCase();
    return main === q || c.label.toLowerCase().includes(q) || c.id.replace(/-/g, ' ') === q;
  });
}

/** Point d'ancrage pour proposer les 3 métropoles les plus proches. */
export function resolveLocationAnchorCoords(opts: {
  profileCity?: string;
  anchorLatitude?: number;
  anchorLongitude?: number;
}): { latitude: number; longitude: number } {
  const anchorLat = opts.anchorLatitude;
  const anchorLon = opts.anchorLongitude;
  if (coordsFinite(anchorLat ?? NaN, anchorLon ?? NaN)) {
    return { latitude: anchorLat!, longitude: anchorLon! };
  }
  const geo = getLivesGeo();
  if (coordsFinite(geo.latitude, geo.longitude)) {
    return { latitude: geo.latitude, longitude: geo.longitude };
  }
  const fromProfile = lookupPresetCityByName(opts.profileCity ?? '');
  if (fromProfile) {
    return { latitude: fromProfile.latitude, longitude: fromProfile.longitude };
  }
  return { latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1] };
}

/** Ville prédéfinie correspondant aux coords (tolérance ~8 km). */
export function matchesPresetCityCoords(
  lat: number,
  lon: number,
  city: PresetCity,
  toleranceKm = 8
): boolean {
  return haversineKm(lat, lon, city.latitude, city.longitude) <= toleranceKm;
}

/** Centre pour appels nearby / geo : ville, position GPS, centre carte, puis Paris. */
export function getNearbyQueryCenter(
  userPosition: [number, number] | null | undefined,
  mapCenter: [number, number]
): [number, number] {
  const geo = getLivesGeo();
  if (isFixedMapGeoSource(geo.source) && coordsFinite(geo.latitude, geo.longitude)) {
    return [geo.latitude, geo.longitude];
  }
  if (userPosition && coordsFinite(userPosition[0], userPosition[1])) {
    return [userPosition[0], userPosition[1]];
  }
  if (coordsFinite(mapCenter[0], mapCenter[1])) {
    return [mapCenter[0], mapCenter[1]];
  }
  if (coordsFinite(geo.latitude, geo.longitude)) {
    return [geo.latitude, geo.longitude];
  }
  return [...DEFAULT_CENTER];
}

export function hasPersistedMapGeoPrefs(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Lieu par défaut browse lives : ville profil → GPS live navigateur ; ignore my_position persisté sans GPS. */
export function resolveDefaultLivesGeoPrefs(
  profileCity?: string,
  userPosition?: [number, number] | null
): LivesGeoPrefs {
  const radiusKm = getNearbyRadiusKm();
  const geo = getLivesGeo();

  if (
    hasPersistedMapGeoPrefs() &&
    isFixedMapGeoSource(geo.source) &&
    geo.label.trim()
  ) {
    return { ...geo, radiusKm };
  }

  if (userPosition && coordsFinite(userPosition[0], userPosition[1])) {
    return {
      latitude: userPosition[0],
      longitude: userPosition[1],
      radiusKm,
      label: 'Ma position',
      source: 'my_position',
    };
  }

  const profileLabel = normalizeCityLabel(profileCity ?? '');
  if (profileLabel) {
    const coords = resolveEventCoordsSync(profileLabel) ?? resolveEventCityCoordsSync(profileLabel);
    if (coords && coordsFinite(coords.latitude, coords.longitude)) {
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusKm,
        label: profileLabel,
        source: 'city',
      };
    }
    const preset = coordsForCityName(profileLabel);
    if (coordsFinite(preset.latitude, preset.longitude)) {
      return {
        latitude: preset.latitude,
        longitude: preset.longitude,
        radiusKm,
        label: preset.label,
        source: 'city',
      };
    }
  }

  return {
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    radiusKm,
    label: '',
    source: 'city',
  };
}

export function getLivesGeo(): LivesGeoPrefs {
  const radiusKm = getNearbyRadiusKm();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, radiusKm };
    const parsed = JSON.parse(raw) as Partial<LivesGeoPrefs>;
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ...DEFAULT_PREFS, radiusKm };
    return {
      latitude,
      longitude,
      radiusKm,
      label: typeof parsed.label === 'string' ? parsed.label : DEFAULT_PREFS.label,
      source:
        parsed.source === 'my_position'
          ? 'my_position'
          : parsed.source === 'address'
            ? 'address'
            : 'city',
      addressLine: typeof parsed.addressLine === 'string' ? parsed.addressLine : undefined,
    };
  } catch {
    return { ...DEFAULT_PREFS, radiusKm };
  }
}

export function setLivesGeo(prefs: LivesGeoPrefs): void {
  const latitude = Number(prefs.latitude);
  const longitude = Number(prefs.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }
  const v = {
    latitude,
    longitude,
    label: prefs.label,
    source: prefs.source,
    addressLine: prefs.addressLine,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(MAP_GEO_CHANGED_EVENT));
}

/** Met à jour le rayon d'affichage via les préférences "à proximité" (source unique de vérité). */
export function setLivesGeoRadiusKm(km: number): void {
  const radiusKm = clampNearbyRadiusKm(km);
  if (!Number.isFinite(radiusKm)) return;
  setNearbyRadiusKm(radiusKm);
}

/** Coordonnées pour une ville saisie (preset ou estimation stable). */
export function coordsForCityName(cityName: string): { latitude: number; longitude: number; label: string } {
  const q = cityName.trim().toLowerCase();
  const qDigits = cityName.trim();
  if (!q) return { ...DEFAULT_PREFS, label: DEFAULT_PREFS.label };
  const preset = PRESET_CITIES.find((c) => {
    const main = c.label.split(',')[0].trim().toLowerCase();
    const cp = c.postalCode?.trim();
    return (
      c.label.toLowerCase() === q ||
      main === q ||
      c.label.toLowerCase().includes(q) ||
      c.id.replace(/-/g, ' ') === q ||
      (cp != null && (cp === qDigits || cp.startsWith(qDigits)))
    );
  });
  if (preset) {
    return presetCityToSuggestion(preset);
  }
  return {
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    label: cityName.trim() || DEFAULT_PREFS.label,
  };
}

/** Suggestions locales à partir des villes prédéfinies (≥ 2 caractères). */
export function filterPresetCitySuggestions(query: string, limit = 6): PresetCity[] {
  const q = query.trim().toLowerCase();
  const qDigits = query.trim();
  if (q.length < 2 && qDigits.length < 2) return [];
  return PRESET_CITIES.filter((c) => {
    const main = c.label.split(',')[0].trim().toLowerCase();
    const cp = c.postalCode?.trim();
    return (
      main.startsWith(q) ||
      c.label.toLowerCase().includes(q) ||
      c.id.replace(/-/g, ' ').includes(q) ||
      (cp != null && /^\d{2,5}$/.test(qDigits) && cp.startsWith(qDigits))
    );
  }).slice(0, limit);
}

export function presetCityToSuggestion(c: PresetCity): {
  label: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
} {
  const city = c.label.split(',')[0].trim();
  const country = c.label.includes(',') ? c.label.split(',').slice(1).join(',').trim() : '';
  const label = c.postalCode
    ? `${city} (${c.postalCode})${country ? `, ${country}` : ''}`
    : c.label;
  return {
    label,
    postalCode: c.postalCode,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}
