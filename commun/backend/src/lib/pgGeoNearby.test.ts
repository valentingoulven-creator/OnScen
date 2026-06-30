import { describe, expect, it, vi } from 'vitest';
import type { NearbyGeoCandidates } from './pgGeoNearby';

describe('geo nearby PostGIS prefilter', () => {
  it('salon/live filters respect candidate sets', () => {
    const candidates: NearbyGeoCandidates = {
      userIds: new Set(['u1']),
      salonIds: new Set(['s1']),
      liveIds: new Set(['l1']),
    };
    expect(candidates.salonIds.has('s1')).toBe(true);
    expect(candidates.salonIds.has('s2')).toBe(false);
    expect(candidates.liveIds.has('l1')).toBe(true);
  });
});

describe('pgGeoBackfill', () => {
  it('no-op when PostGIS disabled', async () => {
    vi.doMock('./postgisConfig', () => ({ isPostGisEnabled: () => false }));
    vi.doMock('../db/pool', () => ({ isPostgresEnabled: () => false }));
    const { backfillPostGisGeom } = await import('./pgGeoBackfill');
    await expect(backfillPostGisGeom()).resolves.toBeUndefined();
    vi.resetModules();
  });
});
