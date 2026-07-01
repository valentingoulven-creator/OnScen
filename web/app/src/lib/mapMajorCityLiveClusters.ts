import { isValidLatLng } from './mapCoords';
import {
  haversineKm,
  matchesPresetCityCoords,
  presetCityMainLabel,
  PRESET_CITIES,
  type PresetCity,
} from './livesGeo';
import type { Live, Salon } from '../types';

/** ~2 km — création live/salon « grande ville » sans GPS (coords = centre métropole). */
export const CITY_ANCHOR_TOLERANCE_KM = 2;

/** ~40 km — périmètre métropolitain pour regrouper les lives géolocalisés. */
export const CITY_METRO_TOLERANCE_KM = 40;

export interface MapMajorCityLiveCluster {
  id: string;
  cityId: string;
  cityLabel: string;
  latitude: number;
  longitude: number;
  cityAnchoredSalons: Salon[];
  cityAnchoredLives: Live[];
  geolocatedSalons: Salon[];
  geolocatedLives: Live[];
  count: number;
  liveCount: number;
}

type MarkerKind = 'cityAnchored' | 'geolocatedInCity' | 'geolocatedRemote';

function nearestPresetCity(
  lat: number,
  lon: number,
  maxKm: number
): { city: PresetCity; distanceKm: number } | null {
  let best: PresetCity | null = null;
  let bestDist = Infinity;
  for (const city of PRESET_CITIES) {
    const d = haversineKm(lat, lon, city.latitude, city.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  if (!best || bestDist > maxKm) return null;
  return { city: best, distanceKm: bestDist };
}

export function classifyMapMarkerCoords(lat: number, lon: number): {
  kind: MarkerKind;
  city: PresetCity | null;
} {
  if (!isValidLatLng(lat, lon)) return { kind: 'geolocatedRemote', city: null };

  for (const city of PRESET_CITIES) {
    if (matchesPresetCityCoords(lat, lon, city, CITY_ANCHOR_TOLERANCE_KM)) {
      return { kind: 'cityAnchored', city };
    }
  }

  const metro = nearestPresetCity(lat, lon, CITY_METRO_TOLERANCE_KM);
  if (metro) return { kind: 'geolocatedInCity', city: metro.city };

  return { kind: 'geolocatedRemote', city: null };
}

function isLiveSalon(s: Salon): boolean {
  return s.isLive === true;
}

function countLiveInCluster(c: MapMajorCityLiveCluster): number {
  let n = 0;
  for (const s of c.cityAnchoredSalons) if (isLiveSalon(s)) n++;
  n += c.cityAnchoredLives.length;
  for (const s of c.geolocatedSalons) if (isLiveSalon(s)) n++;
  n += c.geolocatedLives.length;
  return n;
}

function finalizeCluster(c: MapMajorCityLiveCluster): MapMajorCityLiveCluster {
  const count =
    c.cityAnchoredSalons.length +
    c.cityAnchoredLives.length +
    c.geolocatedSalons.length +
    c.geolocatedLives.length;
  return { ...c, count, liveCount: countLiveInCluster(c) };
}

/** Regroupe salons/lives par grande ville (vue overview carte plate). */
export function clusterSalonsLivesByMajorCity(
  salons: Salon[],
  lives: Live[],
  linkedSalonIds: Set<string>
): {
  cityClusters: MapMajorCityLiveCluster[];
  geolocatedRemoteSalons: Salon[];
  geolocatedRemoteLives: Live[];
} {
  const buckets = new Map<string, MapMajorCityLiveCluster>();
  const geolocatedRemoteSalons: Salon[] = [];
  const geolocatedRemoteLives: Live[] = [];

  const ensureBucket = (city: PresetCity): MapMajorCityLiveCluster => {
    let bucket = buckets.get(city.id);
    if (!bucket) {
      bucket = {
        id: city.id,
        cityId: city.id,
        cityLabel: presetCityMainLabel(city),
        latitude: city.latitude,
        longitude: city.longitude,
        cityAnchoredSalons: [],
        cityAnchoredLives: [],
        geolocatedSalons: [],
        geolocatedLives: [],
        count: 0,
        liveCount: 0,
      };
      buckets.set(city.id, bucket);
    }
    return bucket;
  };

  for (const salon of salons) {
    const lat = Number(salon.latitude);
    const lon = Number(salon.longitude);
    if (!isValidLatLng(lat, lon)) continue;

    const { kind, city } = classifyMapMarkerCoords(lat, lon);
    if (kind === 'cityAnchored' && city) {
      ensureBucket(city).cityAnchoredSalons.push(salon);
    } else if (kind === 'geolocatedInCity' && city) {
      ensureBucket(city).geolocatedSalons.push(salon);
    } else {
      geolocatedRemoteSalons.push(salon);
    }
  }

  for (const live of lives) {
    if (linkedSalonIds.has(live.id)) continue;
    const lat = Number(live.latitude);
    const lon = Number(live.longitude);
    if (!isValidLatLng(lat, lon)) continue;

    const { kind, city } = classifyMapMarkerCoords(lat, lon);
    if (kind === 'cityAnchored' && city) {
      ensureBucket(city).cityAnchoredLives.push(live);
    } else if (kind === 'geolocatedInCity' && city) {
      ensureBucket(city).geolocatedLives.push(live);
    } else {
      geolocatedRemoteLives.push(live);
    }
  }

  const cityClusters = [...buckets.values()]
    .map(finalizeCluster)
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return { cityClusters, geolocatedRemoteSalons, geolocatedRemoteLives };
}

/** Salons/lives affichés individuellement en overview (géolocalisés, hors ville ancrée). */
export function filterOverviewIndividualMarkers(
  salons: Salon[],
  lives: Live[],
  linkedSalonIds: Set<string>
): { salons: Salon[]; lives: Live[] } {
  const outSalons: Salon[] = [];
  const outLives: Live[] = [];

  for (const salon of salons) {
    const lat = Number(salon.latitude);
    const lon = Number(salon.longitude);
    if (!isValidLatLng(lat, lon)) continue;
    const { kind } = classifyMapMarkerCoords(lat, lon);
    if (kind !== 'cityAnchored') outSalons.push(salon);
  }

  for (const live of lives) {
    if (linkedSalonIds.has(live.id)) continue;
    const lat = Number(live.latitude);
    const lon = Number(live.longitude);
    if (!isValidLatLng(lat, lon)) continue;
    const { kind } = classifyMapMarkerCoords(lat, lon);
    if (kind !== 'cityAnchored') outLives.push(live);
  }

  return { salons: outSalons, lives: outLives };
}
