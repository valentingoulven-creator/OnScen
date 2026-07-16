import type { LonLatPolygon, LonLatRing } from '../types';

/**
 * "Déplie" les longitudes d'un anneau pour qu'elles restent continues d'un point
 * au suivant (pas de saut de +/-360°). Nécessaire pour les pays qui traversent
 * l'antiméridien (Russie, Fidji, Alaska/Aléoutiennes…) : sans cela, un test
 * point-dans-polygone classique casse près de la ligne ±180°.
 */
export function unwrapRingLongitudes(ring: LonLatRing): LonLatRing {
  if (ring.length === 0) return ring;
  const out: LonLatRing = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const prevLon = out[i - 1][0];
    let lon = ring[i][0];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

/** Ramène `lon` dans la fenêtre continue la plus proche de `reference` (voir {@link unwrapRingLongitudes}). */
function normalizeLonNear(lon: number, reference: number): number {
  let l = lon;
  while (l - reference > 180) l -= 360;
  while (l - reference < -180) l += 360;
  return l;
}

/** Algorithme classique "ray casting" (even-odd) — anneau supposé déjà déplié. */
function isPointInRing(lon: number, lat: number, ring: LonLatRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi === yj) continue;
    const crosses = yi > lat !== yj > lat;
    if (!crosses) continue;
    const xAtLat = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lon < xAtLat) inside = !inside;
  }
  return inside;
}

/** Un point est dans le polygone s'il est dans l'anneau extérieur et hors de tous les trous. */
function isPointInPolygon(lon: number, lat: number, polygon: LonLatPolygon): boolean {
  const [exterior, ...holes] = polygon;
  if (!exterior || exterior.length < 3) return false;

  const lonNearExterior = normalizeLonNear(lon, exterior[0][0]);
  if (!isPointInRing(lonNearExterior, lat, exterior)) return false;

  for (const hole of holes) {
    if (hole.length < 3) continue;
    const lonNearHole = normalizeLonNear(lon, hole[0][0]);
    if (isPointInRing(lonNearHole, lat, hole)) return false;
  }
  return true;
}

/** Un pays (multi-polygone) contient le point si au moins l'un de ses polygones le contient. */
export function isPointInAnyPolygon(lon: number, lat: number, polygons: LonLatPolygon[]): boolean {
  for (const polygon of polygons) {
    if (isPointInPolygon(lon, lat, polygon)) return true;
  }
  return false;
}
