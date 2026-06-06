import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  geocodeAddress,
  geocodeQuery,
  resetGeocodeRateLimitForTests,
  searchAddressSuggestions,
} from './geocodeAddress';

describe('geocodeAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetGeocodeRateLimitForTests();
  });

  it('rejette une adresse trop courte', async () => {
    await expect(geocodeAddress({ street: '1', city: 'x' })).rejects.toThrow(/minimum/i);
  });

  it('géocode une requête valide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: '48.8566',
            lon: '2.3522',
            display_name: '10 Rue de Rivoli, Paris, France',
          },
        ],
      })
    );

    const r = await geocodeQuery('10 Rue de Rivoli, Paris');
    expect(r.latitude).toBeCloseTo(48.8566);
    expect(r.longitude).toBeCloseTo(2.3522);
    expect(r.label).toContain('Rivoli');
  });

  it('propose plusieurs adresses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: '48.8566',
            lon: '2.3522',
            display_name: '10 Rue de Rivoli, Paris',
          },
          {
            lat: '45.764',
            lon: '4.8357',
            display_name: '10 Rue de Rivoli, Lyon',
          },
        ],
      })
    );

    const list = await searchAddressSuggestions('10 rue rivoli');
    expect(list).toHaveLength(2);
    expect(list[0].label).toContain('Rivoli');
    expect(list[0].latitude).toBeCloseTo(48.8566);
  });

  it('retourne une liste vide si requête trop courte', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const list = await searchAddressSuggestions('ab');
    expect(list).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signale une adresse introuvable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    );

    await expect(geocodeQuery('zzzz inexistant 99999')).rejects.toThrow(/introuvable/i);
  });
});
