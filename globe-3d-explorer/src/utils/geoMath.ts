import { Vector3 } from 'three';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Convertit une longitude/latitude en position 3D sur une sphère de rayon `radius`.
 *
 * Formule alignée sur le mapping UV par défaut de `THREE.SphereGeometry`
 * (u = longitude, v = latitude, texture équirectangulaire classique où le pôle
 * nord est en haut de l'image et le méridien de Greenwich au centre horizontal).
 */
export function lonLatToVector3(lon: number, lat: number, radius: number): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new Vector3(x, y, z);
}

/** Inverse de {@link lonLatToVector3} — retrouve lon/lat depuis un point 3D (ex: résultat d'un raycast). */
export function vector3ToLonLat(point: Vector3, radius: number): { lon: number; lat: number } {
  const nx = point.x / radius;
  const ny = Math.min(1, Math.max(-1, point.y / radius));
  const nz = point.z / radius;

  const phi = Math.acos(ny);
  const lat = 90 - phi * RAD2DEG;

  const thetaAtan = Math.atan2(nz, -nx) * RAD2DEG; // (-180, 180]
  const thetaForward = thetaAtan >= 0 ? thetaAtan : thetaAtan + 360; // [0, 360)
  const lon = thetaForward - 180;

  return { lon, lat };
}
