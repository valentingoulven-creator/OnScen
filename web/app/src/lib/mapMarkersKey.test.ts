import { describe, expect, it } from 'vitest';
import { buildEventClusterKey } from './mapMarkersKey';
import type { MapEventCityCluster } from '../types';

describe('buildEventClusterKey', () => {
  const cluster = (events: MapEventCityCluster['events']): MapEventCityCluster => ({
    cityKey: 'le-cres',
    cityLabel: 'Le Crès',
    latitude: 43.65,
    longitude: 3.94,
    events,
    count: events.length,
  });

  it('changes street-tier key when isSponsored is toggled', () => {
    const base = cluster([
      {
        id: 'evt-1',
        latitude: 43.651,
        longitude: 3.941,
        title: 'Solar Festival',
        eventType: 'autre',
      },
    ]);
    const sponsored = cluster([{ ...base.events[0]!, isSponsored: true }]);

    const before = buildEventClusterKey([base], 'city');
    const after = buildEventClusterKey([sponsored], 'city');

    expect(before).not.toBe(after);
  });

  it('changes overview key when cluster becomes fully sponsored', () => {
    const regular = cluster([
      { id: 'evt-1', latitude: 43.65, longitude: 3.94, title: 'A' },
    ]);
    const sponsored = cluster([
      { id: 'evt-1', latitude: 43.65, longitude: 3.94, title: 'A', isSponsored: true },
    ]);

    const before = buildEventClusterKey([regular], 'overview');
    const after = buildEventClusterKey([sponsored], 'overview');

    expect(before).not.toBe(after);
  });
});
