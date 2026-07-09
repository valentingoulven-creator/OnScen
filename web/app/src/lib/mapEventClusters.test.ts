import { describe, expect, it } from 'vitest';
import {
  buildEventLocationKey,
  clusterMapEventsByCity,
  clusterMapEventsByLocation,
  extractCityFromLocation,
  getCityMapView,
  getCityMapZoom,
  sortMapEventsForPanel,
} from './mapEventClusters';
import type { MapEventMarker } from '../types';

describe('extractCityFromLocation', () => {
  it('recognizes known cities in venue strings', () => {
    expect(extractCityFromLocation('Zénith Sud, Montpellier')).toEqual({
      key: 'montpellier',
      label: 'Montpellier',
    });
    expect(extractCityFromLocation('Olympia, Paris')).toEqual({
      key: 'paris',
      label: 'Paris',
    });
  });

  it('falls back to last comma segment', () => {
    const r = extractCityFromLocation('Salle X, Toulouse');
    expect(r.label).toBe('Toulouse');
    expect(r.key).toBe('toulouse');
  });
});

describe('getCityMapView', () => {
  it('returns city-specific zoom and radius', () => {
    expect(getCityMapZoom('paris')).toBe(11);
    expect(getCityMapView('paris')).toEqual({ zoom: 11, radiusKm: 18 });
    expect(getCityMapView('montpellier')).toEqual({ zoom: 12, radiusKm: 12 });
  });

  it('falls back for unknown cities', () => {
    expect(getCityMapView('toulouse')).toEqual({ zoom: 11, radiusKm: 20 });
  });
});

describe('clusterMapEventsByLocation', () => {
  it('groups events at the same coordinates into one cluster', () => {
    const markers: MapEventMarker[] = [
      {
        id: 'a',
        latitude: 43.6108,
        longitude: 3.8767,
        title: 'Soirée A',
        eventLocation: 'Zénith Sud, Montpellier',
      },
      {
        id: 'b',
        latitude: 43.6108,
        longitude: 3.8767,
        title: 'Soirée B',
        eventLocation: 'Zénith Sud, Montpellier',
      },
    ];
    const clusters = clusterMapEventsByLocation(markers);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(2);
    expect(clusters[0]!.cityKey).toBe(buildEventLocationKey(43.6108, 3.8767));
  });

  it('keeps distinct venues in separate clusters', () => {
    const markers: MapEventMarker[] = [
      {
        id: 'a',
        latitude: 48.88,
        longitude: 2.3,
        title: 'Concert A',
        eventLocation: 'Olympia, Paris',
      },
      {
        id: 'b',
        latitude: 48.84,
        longitude: 2.38,
        title: 'Concert B',
        eventLocation: 'Accor Arena, Paris',
      },
    ];
    const clusters = clusterMapEventsByLocation(markers);
    expect(clusters).toHaveLength(2);
  });
});

describe('clusterMapEventsByCity', () => {
  it('groups events in the same city into one cluster', () => {
    const markers: MapEventMarker[] = [
      {
        id: 'a',
        latitude: 48.88,
        longitude: 2.3,
        title: 'Concert A',
        eventLocation: 'Olympia, Paris',
      },
      {
        id: 'b',
        latitude: 48.84,
        longitude: 2.38,
        title: 'Concert B',
        eventLocation: 'Accor Arena, Paris',
      },
    ];
    const clusters = clusterMapEventsByCity(markers);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.cityLabel).toBe('Paris');
    expect(clusters[0]!.count).toBe(2);
    expect(clusters[0]!.events.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('places cluster pin at centroid of event coords, not city center', () => {
    const markers: MapEventMarker[] = [
      {
        id: 'a',
        latitude: 48.88,
        longitude: 2.3,
        title: 'Concert A',
        eventLocation: 'Olympia, Paris',
      },
      {
        id: 'b',
        latitude: 48.84,
        longitude: 2.38,
        title: 'Concert B',
        eventLocation: 'Accor Arena, Paris',
      },
    ];
    const clusters = clusterMapEventsByCity(markers);
    expect(clusters[0]!.latitude).toBeCloseTo((48.88 + 48.84) / 2, 5);
    expect(clusters[0]!.longitude).toBeCloseTo((2.3 + 2.38) / 2, 5);
    // Not generic Paris center (48.8566, 2.3522)
    expect(clusters[0]!.latitude).not.toBeCloseTo(48.8566, 3);
  });
});

describe('sortMapEventsForPanel', () => {
  it('puts followed authors first then by date', () => {
    const events: MapEventMarker[] = [
      {
        id: 'later',
        latitude: 0,
        longitude: 0,
        title: 'Later',
        eventDate: '2030-06-10T20:00:00.000Z',
        authorId: 'other',
      },
      {
        id: 'earlier-fav',
        latitude: 0,
        longitude: 0,
        title: 'Earlier fav',
        eventDate: '2030-06-01T20:00:00.000Z',
        authorId: 'fav',
      },
      {
        id: 'earlier',
        latitude: 0,
        longitude: 0,
        title: 'Earlier',
        eventDate: '2030-06-01T18:00:00.000Z',
        authorId: 'other2',
      },
    ];
    const sorted = sortMapEventsForPanel(events, new Set(['fav']));
    expect(sorted.map((e) => e.id)).toEqual(['earlier-fav', 'earlier', 'later']);
  });
});
