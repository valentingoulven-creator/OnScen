import { describe, expect, it } from 'vitest';
import {
  filterLivesByContentCategory,
  normalizeLiveContentCategory,
} from './liveContentCategory';
import type { Live } from '../types';

function live(id: string, contentCategory?: Live['contentCategory']): Live {
  return {
    id,
    hostId: id,
    hostName: 'Host',
    title: 'Live',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: '',
      isPlaying: false,
      title: '',
      artist: '',
      albumArtUrl: '',
      progressMs: 0,
      updatedAt: 0,
    },
    latitude: 0,
    longitude: 0,
    viewersCount: 0,
    isActive: true,
    contentCategory,
  };
}

describe('filterLivesByContentCategory', () => {
  it('filters by normalized contentCategory', () => {
    const lives = [live('a', 'dance'), live('b', 'music'), live('c')];
    expect(filterLivesByContentCategory(lives, 'dance').map((l) => l.id)).toEqual(['a']);
    expect(filterLivesByContentCategory(lives, 'music').map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('normalizeLiveContentCategory defaults to music', () => {
    expect(normalizeLiveContentCategory(undefined)).toBe('music');
  });
});
