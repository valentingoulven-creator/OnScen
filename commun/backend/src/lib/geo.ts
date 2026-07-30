export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Random offset ~50m for privacy */
export function blurCoordinate(coord: number): number {
  const offset = (Math.random() - 0.5) * 2 * 0.00045;
  return coord + offset;
}

/** Point at distance/bearing from center (Haversine direct). */
export function destinationPointKm(
  lat: number,
  lon: number,
  distanceKm: number,
  bearingRad: number
): { lat: number; lon: number } {
  const R = 6371;
  const δ = distanceKm / R;
  const φ1 = deg2rad(lat);
  const λ1 = deg2rad(lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearingRad)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: (φ2 * 180) / Math.PI, lon: (λ2 * 180) / Math.PI };
}

export function isWithinRadiusKm(
  centerLat: number,
  centerLon: number,
  lat: number,
  lon: number,
  radiusKm: number
): boolean {
  return getDistanceKm(centerLat, centerLon, lat, lon) <= radiusKm;
}
