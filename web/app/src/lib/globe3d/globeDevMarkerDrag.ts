import { Raycaster, Sphere, Vector2, Vector3, type Camera } from 'three';
import { EARTH_RADIUS } from './constants';
import { vector3ToLonLat } from './geoMath';

const earthSphere = new Sphere(new Vector3(0, 0, 0), EARTH_RADIUS);
const pointer = new Vector2();
const hitPoint = new Vector3();

export function clientPointToGlobeLatLng(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: Camera
): { lat: number; lng: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new Raycaster();
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectSphere(earthSphere, hitPoint)) return null;
  const { lat, lon } = vector3ToLonLat(hitPoint, EARTH_RADIUS);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lng: lon };
}
