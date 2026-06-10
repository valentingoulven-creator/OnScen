import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  combineAddressStreetNumber,
  extractQueryHouseNumber,
  formatAddressLabels,
  geocodeAddress,
  geocodeQuery,
  geocodeQueryBestEffort,
  getAddressPrecision,
  resetGeocodeRateLimitForTests,
  searchAddressSuggestions,
  splitAddressStreetNumber,
} from './geocodeAddress';

function mockHit(overrides: Record<string, unknown> = {}) {
  return {
    lat: '43.648',
    lon: '3.939',
    display_name: 'Rue François Mitterrand, Le Crès, Montpellier, Hérault, France',
    importance: 0.4,
    class: 'highway',
    type: 'residential',
    address: {
      road: 'Rue François Mitterrand',
      town: 'Le Crès',
      city: 'Montpellier',
      country: 'France',
    },
    ...overrides,
  };
}

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
            address: { house_number: '10', road: 'Rue de Rivoli', city: 'Paris' },
            class: 'building',
            type: 'house',
            importance: 0.7,
          },
        ],
      })
    );

    const r = await geocodeQuery('10 Rue de Rivoli, Paris');
    expect(r.latitude).toBeCloseTo(48.8566);
    expect(r.longitude).toBeCloseTo(2.3522);
    expect(r.label).toContain('Rivoli');
  });

  it('propose plusieurs adresses classées avec libellé court', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          mockHit({
            lat: '48.8566',
            lon: '2.3522',
            display_name: '10 Rue de Rivoli, Paris',
            address: { house_number: '10', road: 'Rue de Rivoli', city: 'Paris' },
            class: 'building',
            type: 'house',
          }),
          {
            lat: '45.764',
            lon: '4.8357',
            display_name: '10 Rue de Rivoli, Lyon',
            address: { house_number: '10', road: 'Rue de Rivoli', city: 'Lyon' },
            class: 'building',
            type: 'house',
          },
        ],
      })
    );

    const list = await searchAddressSuggestions('10 rue rivoli paris');
    expect(list).toHaveLength(2);
    expect(list[0].label).toContain('10');
    expect(list[0].label).toContain('Rivoli');
    expect(list[0].precision).toBe('exact');
    expect(list[0].latitude).toBeCloseTo(48.8566);
  });

  it('privilégie un résultat avec numéro quand la requête en contient un', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          mockHit({
            lat: '43.648',
            lon: '3.939',
            address: { road: 'Rue François Mitterrand', town: 'Le Crès', city: 'Montpellier' },
          }),
          mockHit({
            lat: '43.649',
            lon: '3.940',
            display_name: '2 Rue François Mitterrand, Le Crès, Montpellier, France',
            address: {
              house_number: '2',
              road: 'Rue François Mitterrand',
              town: 'Le Crès',
              city: 'Montpellier',
            },
            class: 'building',
            type: 'house',
          }),
        ],
      })
    );

    const list = await searchAddressSuggestions('2 rue francois mitterrand le cres');
    expect(list[0].precision).toBe('exact');
    expect(list[0].label).toMatch(/^2 /);
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

  it('geocodeQueryBestEffort retourne null si rien trouvé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    );

    const r = await geocodeQueryBestEffort('zzzz inexistant 99999');
    expect(r).toBeNull();
  });

  it('extractQueryHouseNumber détecte le numéro en tête', () => {
    expect(extractQueryHouseNumber('2 rue mitterrand')).toBe('2');
    expect(extractQueryHouseNumber('12 bis avenue')).toBe('12 bis');
    expect(extractQueryHouseNumber('rue sans numero')).toBeNull();
  });

  it('splitAddressStreetNumber et combineAddressStreetNumber sont réversibles', () => {
    const cases = [
      '2 rue francois mitterrand le cres',
      '12 bis avenue de la République, Lyon',
      'Salle Pleyel, Paris',
      '',
    ];
    for (const full of cases) {
      const { streetNumber, street } = splitAddressStreetNumber(full);
      expect(combineAddressStreetNumber(streetNumber, street)).toBe(full.trim());
    }
    expect(splitAddressStreetNumber('2 rue test').streetNumber).toBe('2');
    expect(splitAddressStreetNumber('2 rue test').street).toBe('rue test');
    expect(combineAddressStreetNumber('2', 'rue test')).toBe('2 rue test');
    expect(combineAddressStreetNumber('', 'rue test')).toBe('rue test');
  });

  it('formatAddressLabels produit un libellé court rue + ville', () => {
    const labels = formatAddressLabels(
      mockHit({
        address: {
          house_number: '2',
          road: 'Rue François Mitterrand',
          town: 'Le Crès',
          city: 'Montpellier',
        },
      })
    );
    expect(labels.short).toBe('2 Rue François Mitterrand, Montpellier');
  });

  it('getAddressPrecision distingue exact, rue et ville', () => {
    expect(
      getAddressPrecision(
        mockHit({ address: { house_number: '2', road: 'Rue Test', city: 'Paris' } })
      )
    ).toBe('exact');
    expect(getAddressPrecision(mockHit({ address: { road: 'Rue Test', city: 'Paris' } }))).toBe(
      'street'
    );
    expect(getAddressPrecision(mockHit({ address: { city: 'Paris' } }))).toBe('city');
  });
});
