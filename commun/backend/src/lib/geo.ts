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
