import type { CountryGeoFeature } from '../globeCountries';
import { unwrapRingLongitudes } from './pointInPolygon';
import type { LonLatPolygon, LonLatRing, PreparedCountry } from './types';

function toPolygons(feature: CountryGeoFeature): LonLatPolygon[] {
  const { geometry } = feature;
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    return [
      coords.map((ring) => ring.map(([lon, lat]) => [lon, lat] as [number, number])),
    ];
  }
  const coords = geometry.coordinates as number[][][][];
  return coords.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [lon, lat] as [number, number]))
  );
}

function computeCentroid(polygons: LonLatPolygon[]): { lon: number; lat: number } {
  let bestRing: LonLatRing | null = null;
  for (const polygon of polygons) {
    const exterior = polygon[0];
    if (exterior && (!bestRing || exterior.length > bestRing.length)) {
      bestRing = exterior;
    }
  }
  if (!bestRing || bestRing.length === 0) return { lon: 0, lat: 0 };

  const unwrapped = unwrapRingLongitudes(bestRing);
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of unwrapped) {
    sumLon += lon;
    sumLat += lat;
  }
  const lon = sumLon / unwrapped.length;
  const lat = sumLat / unwrapped.length;
  const normalizedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lon: normalizedLon, lat };
}

function prepareCountry(feature: CountryGeoFeature): PreparedCountry | null {
  const name = feature.properties?.ADMIN;
  if (!name) return null;
  const polygons = toPolygons(feature);
  if (polygons.length === 0) return null;
  return {
    name,
    isoA2: feature.properties?.ISO_A2,
    polygons,
    centroid: computeCentroid(polygons),
  };
}

export function prepareGlobeCountries(features: CountryGeoFeature[]): PreparedCountry[] {
  return features
    .map(prepareCountry)
    .filter((c): c is PreparedCountry => c !== null);
}
