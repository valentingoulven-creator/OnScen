import { Vector3 } from 'three';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function lonLatToVector3(lon: number, lat: number, radius: number): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new Vector3(x, y, z);
}

export function vector3ToLonLat(point: Vector3, radius: number): { lon: number; lat: number } {
  const ny = Math.min(1, Math.max(-1, point.y / radius));

  const phi = Math.acos(ny);
  const lat = 90 - phi * RAD2DEG;

  const thetaAtan = Math.atan2(point.z / radius, -point.x / radius) * RAD2DEG;
  const thetaForward = thetaAtan >= 0 ? thetaAtan : thetaAtan + 360;
  const lon = thetaForward - 180;

  return { lon, lat };
}
