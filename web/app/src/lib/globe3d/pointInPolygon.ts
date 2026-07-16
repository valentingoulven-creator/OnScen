import type { LonLatPolygon, LonLatRing } from './types';

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

function normalizeLonNear(lon: number, reference: number): number {
  let l = lon;
  while (l - reference > 180) l -= 360;
  while (l - reference < -180) l += 360;
  return l;
}

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

export function isPointInAnyPolygon(lon: number, lat: number, polygons: LonLatPolygon[]): boolean {
  for (const polygon of polygons) {
    if (isPointInPolygon(lon, lat, polygon)) return true;
  }
  return false;
}
