import { describe, expect, it } from 'vitest';
import { pickFollowedActiveLives } from './followedLives';
import type { Live } from '../types';

function live(id: string, hostId: string, active = true): Live {
  return {
    id,
    hostId,
    hostName: hostId,
    title: 'Live',
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
    latitude: 48,
    longitude: 2,
    viewersCount: 1,
    isActive: active,
    cameraActive: false,
  } as Live;
}

describe('pickFollowedActiveLives', () => {
  it('retourne les lives actifs des hôtes suivis uniquement', () => {
    const following = new Set(['a', 'b']);
    const out = pickFollowedActiveLives(
      [live('l1', 'a'), live('l2', 'c'), live('l3', 'b', false)],
      following
    );
    expect(out.map((l) => l.id)).toEqual(['l1']);
  });

  it('retourne vide si aucun abonnement', () => {
    expect(pickFollowedActiveLives([live('l1', 'a')], new Set())).toEqual([]);
  });
});
