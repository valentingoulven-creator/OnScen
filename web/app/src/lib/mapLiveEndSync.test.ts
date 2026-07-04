import { describe, expect, it } from 'vitest';
import { isActiveMapLive, purgeEndedLiveFromMapState } from './mapLiveEndSync';
import type { Live, NearbyPerson, Salon } from '../types';

describe('mapLiveEndSync', () => {
  it('retire le live, désactive le salon et la personne associée', () => {
    const lives = [{ id: 'live-1', hostId: 'host-1', isActive: true }] as Live[];
    const salons = [{ id: 'salon-1', hostId: 'host-1', isLive: true }] as Salon[];
    const people = [
      { id: 'host-1', isLive: true, liveId: 'live-1', liveViewersCount: 3 },
    ] as NearbyPerson[];

    const result = purgeEndedLiveFromMapState('live-1', 'host-1', salons, lives, people);
    expect(result.lives).toHaveLength(0);
    expect(result.salons[0]?.isLive).toBe(false);
    expect(result.people[0]?.isLive).toBe(false);
    expect(result.people[0]?.liveId).toBeUndefined();
  });

  it('ignore les lives déjà inactifs', () => {
    expect(isActiveMapLive({ id: 'x', isActive: false } as Live)).toBe(false);
  });
});
