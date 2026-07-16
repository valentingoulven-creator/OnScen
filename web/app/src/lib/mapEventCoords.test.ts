import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cacheEventCoords,
  clearEventCoordsCacheForTests,
  resolveEventCityCoordsSync,
  resolveEventCoords,
  resolveEventCoordsSync,
  resolveEventVenueCoordsSync,
  resolveManyEventCoordsRemaining,
  resolveManyEventCoordsSync,
} from './mapEventCoords';
import * as geocodeAddress from './geocodeAddress';

vi.mock('./geocodeAddress', async (importOriginal) => {
  const actual = await importOriginal<typeof geocodeAddress>();
  return { ...actual, geocodeQuery: vi.fn() };
});

const geocodeQuery = vi.mocked(geocodeAddress.geocodeQuery);

afterEach(() => {
  clearEventCoordsCacheForTests();
  geocodeQuery.mockReset();
});

describe('resolveEventVenueCoordsSync', () => {
  it('returns venue coords for known seeds', () => {
    const accor = resolveEventVenueCoordsSync('Accor Arena, Paris, France');
    expect(accor).toEqual({ latitude: 48.8387, longitude: 2.3786 });

    const zenith = resolveEventVenueCoordsSync('Zénith Sud, Montpellier, France');
    expect(zenith).toEqual({ latitude: 43.5848, longitude: 3.8803 });
  });

  it('does not fall back to city center', () => {
    expect(resolveEventVenueCoordsSync('Quelque part, Paris')).toBeNull();
  });
});

describe('resolveEventCoordsSync', () => {
  it('reads from cache after cacheEventCoords', () => {
    cacheEventCoords('Studio XYZ, Toulouse', { latitude: 43.6, longitude: 1.44 });
    expect(resolveEventCoordsSync('Studio XYZ, Toulouse')).toEqual({
      latitude: 43.6,
      longitude: 1.44,
    });
  });
});

describe('resolveEventCoords', () => {
  it('geocodes before city fallback', async () => {
    geocodeQuery.mockResolvedValue({
      latitude: 48.87,
      longitude: 2.33,
      label: 'Lieu inconnu, Paris',
    });

    const coords = await resolveEventCoords('Lieu inconnu, Paris');
    expect(coords).toEqual({ latitude: 48.87, longitude: 2.33 });
    expect(geocodeQuery).toHaveBeenCalledWith('Lieu inconnu, Paris');
  });

  it('falls back to city center when geocode fails', async () => {
    geocodeQuery.mockRejectedValue(new Error('not found'));

    const coords = await resolveEventCoords('Lieu inconnu, Paris');
    expect(coords).toEqual(resolveEventCityCoordsSync('Paris'));
  });

  it('falls back to city segment from full address', async () => {
    geocodeQuery.mockRejectedValue(new Error('not found'));

    const coords = await resolveEventCoords('2 Rue François Mitterrand, Le Crès');
    expect(coords).toEqual({ latitude: 43.6489, longitude: 3.9394 });
  });

  it('uses venue lookup without network', async () => {
    const coords = await resolveEventCoords('Salle Pleyel, Paris, France');
    expect(coords).toEqual({ latitude: 48.8802, longitude: 2.3007 });
    expect(geocodeQuery).not.toHaveBeenCalled();
  });
});

describe('resolveManyEventCoords', () => {
  it('resolveManyEventCoordsSync deduplicates and uses venue lookup', () => {
    const map = resolveManyEventCoordsSync([
      'Accor Arena, Paris, France',
      'Accor Arena, Paris, France',
      'Lyon, France',
    ]);
    expect(map.size).toBe(2);
    expect(map.get('Accor Arena, Paris, France')).toEqual({
      latitude: 48.8387,
      longitude: 2.3786,
    });
  });

  it('resolves world festival city seeds without network', () => {
    const locations = [
      'Boom, Belgium',
      'Pilton, Somerset, United Kingdom',
      'Indio, California, USA',
      'Niigata, Japan',
      'Rio de Janeiro, Brazil',
      'Miami, Florida, USA',
      'Amsterdam, Netherlands',
      'Barcelona, Spain',
      'Rabat, Morocco',
      'Goa, India',
    ];
    const map = resolveManyEventCoordsSync(locations);
    expect(map.size).toBe(10);
    for (const loc of locations) {
      expect(map.get(loc)).toBeTruthy();
    }
  });

  it('resolveManyEventCoordsRemaining geocodes each unique location once', async () => {
    geocodeQuery.mockResolvedValue({
      latitude: 10,
      longitude: 20,
      label: 'Unknown',
    });

    const sync = resolveManyEventCoordsSync(['Lieu X', 'Lieu X']);
    expect(sync.size).toBe(0);

    const full = await resolveManyEventCoordsRemaining(['Lieu X', 'Lieu X'], sync);
    expect(full.size).toBe(1);
    expect(geocodeQuery).toHaveBeenCalledTimes(1);
  });
});
