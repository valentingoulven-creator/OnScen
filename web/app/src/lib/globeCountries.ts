/** GeoJSON Natural Earth 110m — frontières pays sur le globe (polygons layer). */
export type CountryGeoGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

export type CountryGeoFeature = {
  type: 'Feature';
  properties?: { ISO_A2?: string; ADMIN?: string };
  geometry: CountryGeoGeometry;
};

let loadPromise: Promise<CountryGeoFeature[]> | null = null;

/** Charge une fois le GeoJSON pays (sans Antarctique). */
export function loadGlobeCountryFeatures(): Promise<CountryGeoFeature[]> {
  if (!loadPromise) {
    loadPromise = fetch('/globe/countries-110m.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ features?: CountryGeoFeature[] }>;
      })
      .then((data) =>
        (data.features ?? []).filter((f) => f.properties?.ISO_A2 !== 'AQ')
      )
      .catch((err) => {
        console.warn('[globeCountries] Échec chargement frontières:', err);
        loadPromise = null;
        return [];
      });
  }
  return loadPromise;
}
