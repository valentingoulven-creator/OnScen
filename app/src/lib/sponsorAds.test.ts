import { describe, it, expect, vi } from 'vitest';
import { MAP_ADS } from '../content/ads';
import {
  handleSponsorCta,
  mapApiAdToMapAd,
  resolveMapAds,
  resolvePlacementAds,
} from './sponsorAds';

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

  it('retombe sur MAP_ADS si la liste API est vide', () => {
    expect(resolveMapAds([])).toBe(MAP_ADS);
    expect(resolveMapAds(undefined)).toBe(MAP_ADS);
    const custom = [{ ...MAP_ADS[0], id: 'custom' }];
    expect(resolveMapAds(custom)[0].id).toBe('custom');
  });

  it('ne retombe pas sur MAP_ADS pour feed et stories', () => {
    expect(resolvePlacementAds('feed', [])).toEqual([]);
    expect(resolvePlacementAds('stories', undefined)).toEqual([]);
    expect(resolvePlacementAds('map', [])).toBe(MAP_ADS);
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
