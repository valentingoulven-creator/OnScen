import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, type Salon } from '../models/schema';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../db/pool', () => ({
  isPostgresEnabled: () => true,
  getPool: () => ({ query: queryMock }),
}));

vi.mock('./salonPlaybackOps', () => ({
  ensureSalonQueue: vi.fn(),
  ensureSalonProposals: vi.fn(),
  clearSalonPlaybackData: vi.fn(),
}));

import { getSalonFromStore } from './pgSalonsLives';

describe('getSalonFromStore', () => {
  beforeEach(() => {
    db.salons.clear();
    db.salonChats.clear();
    queryMock.mockReset();
  });

  it('retire un salon fantôme RAM si PostgreSQL le marque inactif', async () => {
    const stale: Salon = {
      id: 'salon_stale',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Old',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'demo',
        title: 'T',
        artist: 'A',
        isPlaying: false,
        progressMs: 0,
        updatedAt: 1,
      },
      latitude: 48,
      longitude: 2,
      blurredLatitude: 48,
      blurredLongitude: 2,
      listenersCount: 0,
      accessMode: 'public',
      isPublic: true,
      allowedUserIds: ['host1'],
      allowQueue: true,
      createdAt: 1,
    };
    db.salons.set(stale.id, stale);
    queryMock.mockResolvedValueOnce({ rows: [{ payload: stale, is_active: false }] });

    const result = await getSalonFromStore('salon_stale');
    expect(result).toBeUndefined();
    expect(db.salons.has('salon_stale')).toBe(false);
  });

  it('hydrate un salon actif absent de la RAM', async () => {
    const salon: Salon = {
      id: 'salon_pg_only',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Live',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'demo',
        title: 'T',
        artist: 'A',
        isPlaying: true,
        progressMs: 0,
        updatedAt: 2,
        startedAt: 2,
      },
      latitude: 43.6,
      longitude: 3.9,
      blurredLatitude: 43.6,
      blurredLongitude: 3.9,
      listenersCount: 0,
      accessMode: 'public',
      isPublic: true,
      allowedUserIds: ['host1'],
      allowQueue: true,
      createdAt: 2,
    };
    queryMock.mockResolvedValueOnce({ rows: [{ payload: salon, is_active: true }] });

    const result = await getSalonFromStore('salon_pg_only');
    expect(result?.id).toBe('salon_pg_only');
    expect(db.salons.get('salon_pg_only')?.title).toBe('Live');
  });
});
