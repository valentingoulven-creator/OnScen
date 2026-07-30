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
  SOLAR_FESTIVAL_VENUE,
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

    const solar = resolveEventVenueCoordsSync('Solar Festival, Le Crès, France');
    expect(solar).toEqual(SOLAR_FESTIVAL_VENUE);

    const primavera = resolveEventVenueCoordsSync('Parc del Fòrum, Barcelona, Spain');
    expect(primavera).toEqual({ latitude: 41.4115, longitude: 2.2263 });

    const berghain = resolveEventVenueCoordsSync('Berghain, Berlin, Germany');
    expect(berghain).toEqual({ latitude: 52.5112, longitude: 13.4431 });
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

  it('places Solar Festival at Lac du Crès, not Montpellier center', async () => {
    const coords = await resolveEventCoords('Solar Festival, Le Crès, France');
    expect(coords).toEqual(SOLAR_FESTIVAL_VENUE);
    expect(geocodeQuery).not.toHaveBeenCalled();

    const montpellierCenter = resolveEventCityCoordsSync('Montpellier');
    expect(montpellierCenter).toBeTruthy();
    const latDelta = Math.abs(coords!.latitude - montpellierCenter!.latitude);
    const lonDelta = Math.abs(coords!.longitude - montpellierCenter!.longitude);
    expect(latDelta + lonDelta).toBeGreaterThan(0.04);
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

  it('resolves feed-world-event seed locations without network', () => {
    const locations = [
      'Music Hall, Kuala Lumpur',
      'Open Air Stage, Singapore',
      'Jazz Club, Hanoi',
      'Arena, Tokyo',
      'Concert Hall, Berlin',
    ];
    const map = resolveManyEventCoordsSync(locations);
    expect(map.size).toBe(locations.length);
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

  it('resolves msdev showcase host event venues to precise coords', () => {
    const locations = [
      'Place de la Comédie, Montpellier, France',
      'Le Rockstore, Montpellier, France',
      'Place du Peyrou, Montpellier, France',
      'Odysseum, Montpellier, France',
      'Zénith Sud, Montpellier, France',
      'Solar Festival, Le Crès, France',
    ];
    const map = resolveManyEventCoordsSync(locations);
    expect(map.size).toBe(locations.length);
    for (const loc of locations) {
      const coords = map.get(loc);
      expect(coords).toBeTruthy();
      expect(resolveEventVenueCoordsSync(loc)).toEqual(coords);
    }
    expect(map.get('Solar Festival, Le Crès, France')).toEqual(SOLAR_FESTIVAL_VENUE);
  });
});
