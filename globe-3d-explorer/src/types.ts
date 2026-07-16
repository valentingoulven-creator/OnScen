/** Anneau GeoJSON simplifié : liste de points [longitude, latitude]. */
export type LonLatRing = [number, number][];

/** Un polygone = un anneau extérieur + éventuels anneaux intérieurs (trous). */
export type LonLatPolygon = LonLatRing[];

export type CountryGeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface CountryGeoFeature {
  type: 'Feature';
  properties?: { ISO_A2?: string; ADMIN?: string; NAME?: string };
  geometry: CountryGeoGeometry;
}

export interface CountryGeoJson {
  type: 'FeatureCollection';
  features: CountryGeoFeature[];
}

/**
 * Pays préparé pour le rendu / la recherche / le survol :
 * coordonnées normalisées en polygones [ [ring, ring...], ... ], longitudes
 * "dépliées" (continues) pour gérer proprement l'antiméridien (Russie, Fidji…).
 */
export interface PreparedCountry {
  name: string;
  isoA2?: string;
  polygons: LonLatPolygon[];
  /** Centre approximatif (pour recentrage caméra / recherche). */
  centroid: { lon: number; lat: number };
}

export interface WorldCapital {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** Cible de recentrage caméra (recherche ou clic sur un pays). */
export interface FocusTarget {
  lon: number;
  lat: number;
  /** Incrémenté à chaque nouvelle demande — permet de re-cibler le même pays. */
  requestId: number;
}
