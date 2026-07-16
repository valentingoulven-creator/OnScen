/**
 * Constantes géométriques et visuelles du globe.
 * Le globe est un rayon unitaire (1) — toutes les couches (nuages, atmosphère,
 * frontières, surbrillance pays, capitales) sont exprimées en multiples de ce rayon
 * pour rester cohérentes entre elles, quelle que soit l'échelle finale de la scène.
 */
export const EARTH_RADIUS = 1;

/** Légère surélévation de chaque couche pour éviter le z-fighting avec la sphère Terre. */
export const BORDER_RADIUS = EARTH_RADIUS * 1.002;
export const HIGHLIGHT_RADIUS = EARTH_RADIUS * 1.003;
export const CAPITAL_RADIUS = EARTH_RADIUS * 1.006;
export const CLOUDS_RADIUS = EARTH_RADIUS * 1.015;
export const ATMOSPHERE_RADIUS = EARTH_RADIUS * 1.15;

/** Caméra : distances min/max (zoom) et distance par défaut. */
export const CAMERA_DEFAULT_DISTANCE = 2.6;
export const CAMERA_MIN_DISTANCE = 1.25;
export const CAMERA_MAX_DISTANCE = 6;

/** Distance caméra utilisée lors d'un recentrage automatique (recherche / clic pays). */
export const CAMERA_FOCUS_DISTANCE = 1.9;

/** Couleurs de surbrillance des pays. */
export const COUNTRY_HOVER_COLOR = '#ffd166';
export const COUNTRY_SELECTED_COLOR = '#ff6b6b';

/** Chemins des textures (servies depuis /public). */
export const TEXTURE_PATHS = {
  day: '/textures/earth-day.jpg',
  bump: '/textures/earth-bump.png',
  specular: '/textures/earth-specular.png',
  clouds: '/textures/earth-clouds.png',
  starfield: '/textures/starfield.jpg',
} as const;

export const COUNTRIES_GEOJSON_URL = '/data/countries-110m.geojson';
