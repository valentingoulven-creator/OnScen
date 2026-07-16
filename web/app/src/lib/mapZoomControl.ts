import { CAMERA_DEFAULT_ALTITUDE } from './globe3d/constants';

/** Plage zoom carte plate (Leaflet) contrôlée par le slider. */
export const MAP_FLAT_ZOOM_MIN = 3;
export const MAP_FLAT_ZOOM_MAX = 19;

/** Plage altitude globe (pointOfView) — bas = proche, haut = vue globale. */
export const MAP_GLOBE_ALT_MIN = 0.03;
export const MAP_GLOBE_ALT_MAX = CAMERA_DEFAULT_ALTITUDE;

export type MapZoomMode = 'flat' | 'globe';

export interface MapZoomControlSnapshot {
  /** 0 = dézoom max, 1 = zoom max (haut du slider). */
  norm: number;
  mode: MapZoomMode;
}

export function flatZoomToNorm(zoom: number): number {
  const clamped = Math.max(MAP_FLAT_ZOOM_MIN, Math.min(MAP_FLAT_ZOOM_MAX, zoom));
  return (clamped - MAP_FLAT_ZOOM_MIN) / (MAP_FLAT_ZOOM_MAX - MAP_FLAT_ZOOM_MIN);
}

export function normToFlatZoom(norm: number): number {
  const n = Math.max(0, Math.min(1, norm));
  return MAP_FLAT_ZOOM_MIN + n * (MAP_FLAT_ZOOM_MAX - MAP_FLAT_ZOOM_MIN);
}

/** Haut du slider = altitude basse (zoom avant). */
export function globeAltToNorm(altitude: number): number {
  const clamped = Math.max(MAP_GLOBE_ALT_MIN, Math.min(MAP_GLOBE_ALT_MAX, altitude));
  const logMin = Math.log(MAP_GLOBE_ALT_MIN);
  const logMax = Math.log(MAP_GLOBE_ALT_MAX);
  return 1 - (Math.log(clamped) - logMin) / (logMax - logMin);
}

export function normToGlobeAlt(norm: number): number {
  const n = Math.max(0, Math.min(1, norm));
  const logMin = Math.log(MAP_GLOBE_ALT_MIN);
  const logMax = Math.log(MAP_GLOBE_ALT_MAX);
  const inv = 1 - n;
  return Math.exp(logMin + inv * (logMax - logMin));
}
