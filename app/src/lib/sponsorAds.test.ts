import { describe, it, expect, vi, afterEach } from 'vitest';
import { MAP_ADS } from '../content/ads';
import {
  filterMapAdsByViewport,
  handleSponsorCta,
  mapApiAdToMapAd,
  MAP_REGION_MIN_ZOOM,
  resolveMapAds,
  resolvePlacementAds,
  type MapSponsorViewport,
} from './sponsorAds';

/** Viewport Montpellier / Le Crès (inclut Solar, exclut Argelès). */
const cresViewport: MapSponsorViewport = {
  lat: 43.65,
  lng: 3.86,
  zoom: MAP_REGION_MIN_ZOOM,
  north: 43.8,
  south: 43.5,
  east: 4.0,
  west: 3.7,
};

/** Viewport Paris (aucun sponsor régional de démo). */
const parisViewport: MapSponsorViewport = {
  lat: 48.85,
  lng: 2.35,
  zoom: 10,
  north: 49.0,
  south: 48.5,
  east: 2.6,
  west: 2.1,
};

/** Viewport Argelès-sur-Mer (inclut Les Déferlantes). */
const argelesViewport: MapSponsorViewport = {
  lat: 42.55,
  lng: 3.02,
  zoom: MAP_REGION_MIN_ZOOM,
  north: 42.7,
  south: 42.4,
  east: 3.2,
  west: 2.8,
};

describe('sponsorAds', () => {
  it('mappe un item API vers MapAd', () => {
    const ad = mapApiAdToMapAd({
      id: 'x',
      title: 'Titre',
      subtitle: 'Sous-titre',
      cta: 'Go',
      accent: 'purple',
      sponsor: 'Test',
      kind: 'sponsored',
      href: 'https://example.com',
      actionId: 'salon',
    });
    expect(ad.id).toBe('x');
    expect(ad.actionId).toBe('salon');
    expect(ad.href).toBe('https://example.com');
  });

  it('mappe displayDurationSec depuis l API', () => {
    const ad = mapApiAdToMapAd({
      id: 'x',
      title: 'Titre',
      subtitle: 'Sous-titre',
      cta: 'Go',
      accent: 'purple',
      displayDurationSec: 12,
    });
    expect(ad.displayDurationSec).toBe(12);
  });

  it('ne retombe pas sur MAP_ADS quand l API renvoie une liste vide', () => {
    expect(resolveMapAds([])).toEqual([]);
    expect(resolveMapAds([], cresViewport)).toEqual([]);
  });

  it('retombe sur MAP_ADS filtrés si la liste API est absente (erreur réseau, msdev/dev)', () => {
    const franceOverview = resolveMapAds(undefined, { lat: 46.6, lng: 2.4, zoom: 6 });
    expect(franceOverview.some((ad) => ad.id === 'solar-festival-cres')).toBe(false);
    expect(franceOverview.some((ad) => ad.id === 'premium')).toBe(true);

    const nearCres = resolveMapAds(null, cresViewport);
    expect(nearCres.some((ad) => ad.id === 'solar-festival-cres')).toBe(true);
    expect(nearCres.some((ad) => ad.id === 'premium')).toBe(true);
    expect(nearCres.some((ad) => ad.id === 'les-deferlantes-2026')).toBe(false);
  });

  it('affiche Solar au zoom ville quand Le Crès est dans le viewport', () => {
    const nearCres = filterMapAdsByViewport(MAP_ADS, cresViewport);
    expect(nearCres.map((ad) => ad.id)).toEqual(
      expect.arrayContaining(['premium', 'solar-festival-cres'])
    );
    expect(nearCres.some((ad) => ad.id === 'les-deferlantes-2026')).toBe(false);
  });

  it('masque les bandeaux régionaux hors viewport (Paris) et sans bounds', () => {
    const filtered = filterMapAdsByViewport(MAP_ADS, parisViewport);
    expect(filtered.some((ad) => ad.id === 'solar-festival-cres')).toBe(false);
    expect(filtered.some((ad) => ad.id === 'les-deferlantes-2026')).toBe(false);
    expect(filtered.some((ad) => ad.id === 'premium')).toBe(true);

    const noBounds = filterMapAdsByViewport(MAP_ADS, {
      lat: 43.65,
      lng: 3.86,
      zoom: MAP_REGION_MIN_ZOOM,
    });
    expect(noBounds.some((ad) => ad.id === 'solar-festival-cres')).toBe(false);
  });

  it('affiche Les Déferlantes quand Argelès est dans le viewport', () => {
    const filtered = filterMapAdsByViewport(MAP_ADS, argelesViewport);
    expect(filtered.some((ad) => ad.id === 'les-deferlantes-2026')).toBe(true);
    expect(filtered.some((ad) => ad.id === 'solar-festival-cres')).toBe(false);
  });

  it('utilise les items API quand la liste est non vide', () => {
    const custom = [{ ...MAP_ADS[0], id: 'custom' }];
    expect(resolveMapAds(custom)[0].id).toBe('custom');
  });

  it('ne retombe pas sur MAP_ADS pour feed et stories', () => {
    expect(resolvePlacementAds('feed', [])).toEqual([]);
    expect(resolvePlacementAds('stories', undefined)).toEqual([]);
    expect(resolvePlacementAds('map', []).some((ad) => ad.id === 'solar-festival-cres')).toBe(false);
  });

  it('ne retombe pas sur MAP_ADS en build production', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_APP_ENV', 'production');
    vi.resetModules();
    const { resolveMapAds: resolveProd } = await import('./sponsorAds');
    expect(resolveProd(null, cresViewport)).toEqual([]);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('déclenche les handlers CTA internes ou le lien externe', () => {
    let salon = false;
    let live = false;
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    handleSponsorCta(
      { id: 'x', title: 't', subtitle: 's', cta: 'c', accent: 'purple', actionId: 'salon' },
      { onCtaSalon: () => { salon = true; } }
    );
    expect(salon).toBe(true);
    handleSponsorCta(
      { id: 'x', title: 't', subtitle: 's', cta: 'c', accent: 'purple', actionId: 'live' },
      { onCtaLive: () => { live = true; } }
    );
    expect(live).toBe(true);
    handleSponsorCta(
      { id: 'x', title: 't', subtitle: 's', cta: 'c', accent: 'purple', href: 'https://example.com' }
    );
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    vi.unstubAllGlobals();
  });
});
