import type { Vector3 } from 'three';
import { EARTH_RADIUS } from './constants';
import { lonLatToVector3, vector3ToLonLat } from './geoMath';

export function altitudeToDistance(altitude: number, earthRadius = EARTH_RADIUS): number {
  return earthRadius * (1 + altitude);
}

export function distanceToAltitude(distance: number, earthRadius = EARTH_RADIUS): number {
  return distance / earthRadius - 1;
}

export function getPovFromCameraPosition(
  position: Vector3,
  earthRadius = EARTH_RADIUS
): { lat: number; lng: number; altitude: number } {
  const { lon, lat } = vector3ToLonLat(position, earthRadius);
  return {
    lat,
    lng: lon,
    altitude: distanceToAltitude(position.length(), earthRadius),
  };
}

export function cameraPositionForPov(
  lat: number,
  lng: number,
  altitude: number,
  earthRadius = EARTH_RADIUS
): Vector3 {
  return lonLatToVector3(lng, lat, altitudeToDistance(altitude, earthRadius));
}
