import { afterEach, describe, expect, it } from 'vitest';
import { takePendingMapFlyToPlace } from './mapSearchIntent';
import {
  ONSCEN_MAP_VENUE_FLY_RADIUS_KM,
  openOnscenMapAtLocation,
  resolveOpenLocationCoords,
} from './openOnscenMapAtLocation';

describe('resolveOpenLocationCoords', () => {
  it('prefers explicit coordinates', () => {
    expect(
      resolveOpenLocationCoords({
        label: 'Ignored',
        latitude: 43.608,
        longitude: 3.8778,
      })
    ).toEqual({ latitude: 43.608, longitude: 3.8778 });
  });

  it('resolves Place de la Comédie from the label', () => {
    const coords = resolveOpenLocationCoords({
      label: 'Place de la Comédie, Montpellier, France',
    });
    expect(coords).toEqual({ latitude: 43.608, longitude: 3.8778 });
  });
});

describe('openOnscenMapAtLocation', () => {
  afterEach(() => {
    takePendingMapFlyToPlace();
  });

  it('queues a venue fly for the in-app map', () => {
    const ok = openOnscenMapAtLocation({
      label: 'Place de la Comédie, Montpellier, France',
      latitude: 43.608,
      longitude: 3.8778,
    });

    expect(ok).toBe(true);
    const intent = takePendingMapFlyToPlace();
    expect(intent).toMatchObject({
      location: 'Place de la Comédie, Montpellier, France',
      latitude: 43.608,
      longitude: 3.8778,
      radiusKm: ONSCEN_MAP_VENUE_FLY_RADIUS_KM,
    });
  });
});
