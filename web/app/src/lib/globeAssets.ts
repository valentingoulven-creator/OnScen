import { getGlobeTexturePaths, globeAssetPath } from './globe3d/constants';

async function probeGlobeAssetUrl(url: string): Promise<boolean> {
  try {
    const get = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (get.ok) return true;
  } catch {
    /* GET peut échouer offline — essai HEAD */
  }
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return head.ok;
  } catch {
    return false;
  }
}

/**
 * Probe léger (texture jour + GeoJSON) — ne bloque pas le rendu globe ;
 * évite les faux négatifs HEAD/Range sur mobile WebView.
 */
export async function verifyGlobeAssetsReachable(): Promise<boolean> {
  const textures = getGlobeTexturePaths();
  const urls = [textures.day, globeAssetPath('globe/countries-110m.geojson')];
  try {
    const checks = await Promise.all(urls.map(probeGlobeAssetUrl));
    const ok = checks.every(Boolean);
    if (!ok) {
      console.warn('[globeAssets] probe failed for:', urls.filter((_, i) => !checks[i]));
    }
    return ok;
  } catch (err) {
    console.warn('[globeAssets] verifyGlobeAssetsReachable failed:', err);
    return false;
  }
}
