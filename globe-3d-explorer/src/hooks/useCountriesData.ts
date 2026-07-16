import { useEffect, useState } from 'react';
import { COUNTRIES_GEOJSON_URL } from '../constants';
import { unwrapRingLongitudes } from '../utils/pointInPolygon';
import type { CountryGeoFeature, CountryGeoJson, LonLatPolygon, LonLatRing, PreparedCountry } from '../types';

function toPolygons(feature: CountryGeoFeature): LonLatPolygon[] {
  const { geometry } = feature;
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates.map((ring) => ring.map(([lon, lat]) => [lon, lat] as [number, number]))];
  }
  // MultiPolygon
  return geometry.coordinates.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [lon, lat] as [number, number]))
  );
}

/** Centroïde approximatif : moyenne des points de l'anneau extérieur le plus détaillé (souvent le "continent" principal). */
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
  // Ramène la longitude moyenne (potentiellement "dépliée" au-delà de ±180°) dans la plage standard.
  const normalizedLon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lon: normalizedLon, lat };
}

function prepareCountry(feature: CountryGeoFeature): PreparedCountry | null {
  const name = feature.properties?.ADMIN ?? feature.properties?.NAME;
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

interface UseCountriesDataResult {
  countries: PreparedCountry[];
  loading: boolean;
  error: string | null;
}

/** Charge et prépare une seule fois le GeoJSON mondial des frontières (Natural Earth 110m). */
export function useCountriesData(): UseCountriesDataResult {
  const [countries, setCountries] = useState<PreparedCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(COUNTRIES_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CountryGeoJson>;
      })
      .then((data) => {
        if (cancelled) return;
        const prepared = data.features
          .filter((f) => f.properties?.ISO_A2 !== 'AQ') // Antarctique exclue (pas de frontières politiques)
          .map(prepareCountry)
          .filter((c): c is PreparedCountry => c !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(prepared);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[useCountriesData] Échec chargement frontières:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { countries, loading, error };
}
