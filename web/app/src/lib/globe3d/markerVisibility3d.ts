import type { Vector3 } from 'three';
import { EARTH_RADIUS, MARKER_SURFACE_RADIUS } from './constants';

const _markerNormal = { x: 0, y: 0, z: 0 };
const _cameraDir = { x: 0, y: 0, z: 0 };

/**
 * True when the marker sits on the hemisphere facing the camera.
 * Replaces drei `<Html occlude>` raycasts, which falsely hide pins when the
 * camera is very close to the surface (high zoom on the globe).
 */
export function isGlobePointFacingCamera(
  markerPosition: Vector3,
  cameraPosition: Vector3,
  threshold = 0.05
): boolean {
  const mx = markerPosition.x;
  const my = markerPosition.y;
  const mz = markerPosition.z;
  const mLen = Math.hypot(mx, my, mz) || 1;
  _markerNormal.x = mx / mLen;
  _markerNormal.y = my / mLen;
  _markerNormal.z = mz / mLen;

  const cx = cameraPosition.x;
  const cy = cameraPosition.y;
  const cz = cameraPosition.z;
  const cLen = Math.hypot(cx, cy, cz) || 1;
  _cameraDir.x = cx / cLen;
  _cameraDir.y = cy / cLen;
  _cameraDir.z = cz / cLen;

  return (
    _markerNormal.x * _cameraDir.x +
      _markerNormal.y * _cameraDir.y +
      _markerNormal.z * _cameraDir.z >
    threshold
  );
}

/** Rayon surface HTML — collé à la mesh Terre (MARKER_SURFACE_RADIUS), sans surélévation au zoom. */
export function htmlMarkerSurfaceRadius(
  _cameraDistance: number,
  _earthRadius = EARTH_RADIUS,
  baseRadius = MARKER_SURFACE_RADIUS
): number {
  return baseRadius;
}
