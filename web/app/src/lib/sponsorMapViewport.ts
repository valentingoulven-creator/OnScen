import type { MapSponsorViewport } from './sponsorAds';

/** ~1,1 km — évite un refetch sponsor à chaque frame de pan carte / globe. */
const SPONSOR_VIEWPORT_COORD_DECIMALS = 1;

/**
 * Clé stable pour charger les sponsors carte (debounce + rotation).
 * Les bounds restent envoyées à l’API au moment du fetch, sans déclencher un refetch à chaque pixel.
 */
export function buildMapSponsorViewportFetchKey(viewport?: MapSponsorViewport | null): string {
  if (!viewport) return '';
  const parts: string[] = [];
  if (viewport.lat != null && Number.isFinite(viewport.lat)) {
    parts.push(`lat:${viewport.lat.toFixed(SPONSOR_VIEWPORT_COORD_DECIMALS)}`);
  }
  if (viewport.lng != null && Number.isFinite(viewport.lng)) {
    parts.push(`lng:${viewport.lng.toFixed(SPONSOR_VIEWPORT_COORD_DECIMALS)}`);
  }
  if (viewport.zoom != null && Number.isFinite(viewport.zoom)) {
    parts.push(`zoom:${Math.floor(viewport.zoom)}`);
  }
  return parts.join('|');
}

export function areMapSponsorAdListsEqual(
  a: ReadonlyArray<{ id: string }>,
  b: ReadonlyArray<{ id: string }>
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}
