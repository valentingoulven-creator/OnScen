import { describe, expect, it } from 'vitest';
import type { Salon, SalonQueueItem } from '../models/schema';
import {
  isYoutubeMetadataStale,
  purgeStaleYoutubeMetadataForStorage,
  YOUTUBE_METADATA_MAX_AGE_MS,
} from './youtubeMetadata';

function baseSalon(): Salon {
  return {
    id: 'salon_1',
    hostId: 'user_1',
    hostName: 'Host',
    title: 'Salon',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 'abc123',
      title: 'Real Title',
      artist: 'Artist',
      albumArtUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
      metadataFetchedAt: Date.now() - YOUTUBE_METADATA_MAX_AGE_MS - 1000,
    },
    latitude: 48.8,
    longitude: 2.3,
    blurredLatitude: 48.8,
    blurredLongitude: 2.3,
    listenersCount: 0,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [],
    allowQueue: true,
    createdAt: Date.now(),
  };
}

describe('youtubeMetadata', () => {
  it('detects stale metadata', () => {
    expect(isYoutubeMetadataStale(Date.now() - YOUTUBE_METADATA_MAX_AGE_MS - 1)).toBe(true);
    expect(isYoutubeMetadataStale(Date.now())).toBe(false);
  });

  it('purges stale youtube metadata before storage', () => {
    const salon = baseSalon();
    const queue: SalonQueueItem[] = [];
    purgeStaleYoutubeMetadataForStorage(salon, queue);
    expect(salon.playbackState.title).toBe('abc123');
    expect(salon.playbackState.artist).toBe('YouTube');
    expect(salon.playbackState.albumArtUrl).toBeUndefined();
    expect(salon.playbackState.metadataFetchedAt).toBeUndefined();
  });
});
