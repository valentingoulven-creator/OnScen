const EARTH_RADIUS_KM = 6371;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Point destination depuis (lat, lon) — bearing °, distance km (grand cercle). */
export function destinationPointKm(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lon: number } {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = bearingDeg * DEG2RAD;
  const φ1 = lat * DEG2RAD;
  const λ1 = lon * DEG2RAD;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return { lat: φ2 * RAD2DEG, lon: ((λ2 * RAD2DEG + 540) % 360) - 180 };
}

/** Anneau lat/lng (fermé) pour tracé carte / globe. */
export function circleLatLngRing(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  segments = 72
): Array<{ lat: number; lon: number }> {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return [];
  const pts: Array<{ lat: number; lon: number }> = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 360;
    pts.push(destinationPointKm(centerLat, centerLng, bearing, radiusKm));
  }
  return pts;
}
