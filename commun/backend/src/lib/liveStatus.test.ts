import { beforeEach, describe, expect, it } from 'vitest';

import { db, type Live } from '../models/schema';
import {
  getActiveLiveForSalon,
  isSalonLiveActive,
} from './liveStatus';

function makeLive(overrides: Partial<Live> & Pick<Live, 'id' | 'hostId'>): Live {
  return {
    salonId: overrides.salonId,
    hostName: 'host',
    title: 'Live test',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 'demo',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
      startedAt: Date.now(),
    },
    latitude: 43.6,
    longitude: 3.8,
    blurredLatitude: 43.6,
    blurredLongitude: 3.8,
    viewersCount: 1,
    isActive: true,
    startedAt: Date.now(),
    ...overrides,
  };
}

describe('liveStatus salon linkage', () => {
  beforeEach(() => {
    db.lives.clear();
  });

  it('detects active live when live.id === salonId (modèle prod)', () => {
    db.lives.set('salon-1', makeLive({ id: 'salon-1', salonId: 'salon-1', hostId: 'host-1' }));
    expect(getActiveLiveForSalon('salon-1')?.id).toBe('salon-1');
    expect(isSalonLiveActive('salon-1')).toBe(true);
  });

  it('detects active live via legacy salonId (seed séparé)', () => {
    db.lives.set(
      'legacy-live',
      makeLive({ id: 'legacy-live', salonId: 'salon-2', hostId: 'host-2' })
    );
    expect(getActiveLiveForSalon('salon-2')?.id).toBe('legacy-live');
    expect(isSalonLiveActive('salon-2')).toBe(true);
  });

  it('returns undefined when live is inactive', () => {
    db.lives.set(
      'salon-3',
      makeLive({ id: 'salon-3', salonId: 'salon-3', hostId: 'host-3', isActive: false })
    );
    expect(getActiveLiveForSalon('salon-3')).toBeUndefined();
    expect(isSalonLiveActive('salon-3')).toBe(false);
  });
});
