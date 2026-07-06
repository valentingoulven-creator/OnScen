import { describe, expect, it } from 'vitest';
import {
  buildActiveLiveByHost,
  isActiveMapLive,
  isGeolocatedMapLive,
  isStoryRingLive,
  purgeEndedLiveFromMapState,
} from './mapLiveEndSync';
import {
  purgeEndedLiveFromStoryEntries,
  resolveStoryEntryLive,
  type MapStoryEntry,
} from './mapStoriesFeed';
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

  it('isStoryRingLive exige géoloc et caméra ou stream CDN', () => {
    const base = {
      id: 'live-1',
      hostId: 'host-1',
      hostName: 'Host',
      title: 'T',
      platform: 'youtube' as const,
      playbackState: {
        platform: 'youtube' as const,
        trackId: '',
        title: 'T',
        artist: 'A',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
      },
      latitude: 48.85,
      longitude: 2.35,
      viewersCount: 1,
      isActive: true,
    };
    expect(isStoryRingLive(base as Live)).toBe(false);
    expect(isStoryRingLive({ ...base, cameraActive: true } as Live)).toBe(true);
    expect(isStoryRingLive({ ...base, streamMode: 'livekit' } as Live)).toBe(true);
    expect(isGeolocatedMapLive({ ...base, isActive: false } as Live)).toBe(false);
  });

  it('resolveStoryEntryLive retire isLive périmé', () => {
    const entry: MapStoryEntry = {
      userId: 'u1',
      username: 'Nova',
      isFavorite: true,
      isLive: true,
      liveId: 'stale',
      hasActiveStory: true,
      storyId: 's1',
    };
    const resolved = resolveStoryEntryLive(entry, new Map());
    expect(resolved.isLive).toBeUndefined();
    expect(resolved.liveId).toBeUndefined();
  });

  it('purgeEndedLiveFromStoryEntries retire le badge live', () => {
    const entries: MapStoryEntry[] = [
      {
        userId: 'host-1',
        username: 'Host',
        isFavorite: false,
        isLive: true,
        liveId: 'live-1',
      },
    ];
    const next = purgeEndedLiveFromStoryEntries(entries, 'live-1', 'host-1');
    expect(next[0]?.isLive).toBeUndefined();
    expect(next[0]?.liveId).toBeUndefined();
  });

  it('buildActiveLiveByHost indexe par hostId', () => {
    const map = buildActiveLiveByHost([
      {
        id: 'live-1',
        hostId: 'host-1',
        hostName: 'Host',
        title: 'T',
        platform: 'youtube',
        playbackState: {
          platform: 'youtube',
          trackId: '',
          title: 'T',
          artist: 'A',
          isPlaying: true,
          progressMs: 0,
          updatedAt: Date.now(),
        },
        latitude: 48.85,
        longitude: 2.35,
        viewersCount: 3,
        isActive: true,
        cameraActive: true,
      } as Live,
    ]);
    expect(map.get('host-1')).toEqual({ liveId: 'live-1', liveViewersCount: 3 });
  });
});
