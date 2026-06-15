import { describe, expect, it } from 'vitest';
import { resolveStoryLivePreviewCoverUrl } from './storyLivePreviewCover';
import type { Live } from '../types';

const baseLive = (albumArtUrl?: string): Live => ({
  id: 'live-1',
  hostId: 'u1',
  hostName: 'Alice',
  title: 'Mon live',
  platform: 'spotify',
  playbackState: {
    platform: 'spotify',
    trackId: 't1',
    title: 'Track',
    artist: 'Artist',
    albumArtUrl,
    isPlaying: true,
    progressMs: 0,
    updatedAt: Date.now(),
  },
  latitude: 0,
  longitude: 0,
  viewersCount: 3,
  isActive: true,
});

describe('resolveStoryLivePreviewCoverUrl', () => {
  it('prefers album art from live playback', () => {
    const url = resolveStoryLivePreviewCoverUrl(baseLive('https://cdn.example/album.jpg'), {
      userId: 'u1',
      avatarUrl: 'https://cdn.example/avatar.jpg',
    });
    expect(url).toBe('https://cdn.example/album.jpg');
  });

  it('falls back to entry avatar when no album art', () => {
    const url = resolveStoryLivePreviewCoverUrl(baseLive(), {
      userId: 'u1',
      avatarUrl: 'https://cdn.example/avatar.jpg',
    });
    expect(url).toBe('https://cdn.example/avatar.jpg');
  });

  it('falls back to dicebear when live and avatar are missing', () => {
    const url = resolveStoryLivePreviewCoverUrl(null, { userId: 'u1' });
    expect(url).toContain('u1');
  });
});
