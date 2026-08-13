/** Rayon Terre aligné sur react-globe.gl / three-globe (altitude POV compatible). */
export const EARTH_RADIUS = 100;

export const BORDER_RADIUS = EARTH_RADIUS * 1.002;
export const HIGHLIGHT_RADIUS = EARTH_RADIUS * 1.003;
export const CLOUDS_RADIUS = EARTH_RADIUS * 1.015;
export const ATMOSPHERE_RADIUS = EARTH_RADIUS * 1.15;
export const MARKER_SURFACE_RADIUS = EARTH_RADIUS * 1.008;

/** Caméra : distance = EARTH_RADIUS * (1 + altitude). */
/** Dézoom max réel (vue par défaut) ≈ altitude 1.55 — slider globe à 0 %. */
export const CAMERA_MAX_DISTANCE = EARTH_RADIUS * 2.55;
/** Vue par défaut = dézoom max (même que OrbitControls maxDistance). */
export const CAMERA_DEFAULT_DISTANCE = CAMERA_MAX_DISTANCE;
export const CAMERA_MIN_DISTANCE = EARTH_RADIUS * 1.03;
/** Altitude POV par défaut (= dézoom max). distance/r - 1 → 1.55 */
export const CAMERA_DEFAULT_ALTITUDE = CAMERA_DEFAULT_DISTANCE / EARTH_RADIUS - 1;

/** Distance de référence pour normaliser la vitesse de rotation au zoom (altitude 1.0). */
export const GLOBE_ROTATION_REF_DISTANCE = CAMERA_DEFAULT_DISTANCE;

/**
 * OrbitControls autoRotateSpeed à la distance de référence (~100 s / tour complet).
 * Mis à l'échelle par REF_DISTANCE / distance caméra pour une vitesse visuelle constante.
 */
export const GLOBE_AUTO_ROTATE_BASE_SPEED = 0.5;

/** OrbitControls rotateSpeed (drag) à la distance de référence — même normalisation zoom. */
export const GLOBE_DRAG_ROTATE_BASE_SPEED = 0.55;

/** Parallaxe nuages (rad/s à la distance de référence), un peu plus lent que la Terre. */
export const GLOBE_CLOUDS_PARALLAX_SPEED = 0.004;

import { isAppTelBuild } from '../nativePlatform';

/** Préfixe assets globe — `/tel/` PWA, `./` Capacitor, `/` web. */
export function resolveGlobeAssetBase(): string {
  let base = import.meta.env.BASE_URL || '/';
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/tel/') || path === '/tel') {
      return '/tel/';
    }
  }
  if (isAppTelBuild() && (base === '/' || base === '')) {
    return '/tel/';
  }
  return base.endsWith('/') ? base : `${base}/`;
}

/** Préfixe BASE_URL (`/`, `/tel/`, `./`) → URL absolue (fetch + Three.js, web + apptel + Capacitor). */
export function globeAssetPath(relativePath: string): string {
  const clean = relativePath.replace(/^\//, '');
  const base = resolveGlobeAssetBase();
  if (typeof window !== 'undefined' && window.location?.href) {
    try {
      return new URL(clean, new URL(base, window.location.href)).href;
    } catch {
      /* fall through */
    }
  }
  return `${base}${clean}`;
}

/** Chemins textures — résolus au runtime via globeAssetPath (pas au chargement module). */
export function getGlobeTexturePaths() {
  return {
    day: globeAssetPath('globe/earth-blue-marble.jpg'),
    bump: globeAssetPath('globe/earth-topology.png'),
    specular: globeAssetPath('globe/earth-water.png'),
    clouds: globeAssetPath('globe/earth-clouds.png'),
    starfield: globeAssetPath('globe/stars-enhanced.jpg'),
    starfieldLow: globeAssetPath('globe/night-sky.png'),
  } as const;
}

/** @deprecated Préférer getGlobeTexturePaths() — conservé pour compat tests. */
export const TEXTURE_PATHS = getGlobeTexturePaths();
