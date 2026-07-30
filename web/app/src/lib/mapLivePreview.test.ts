import { describe, expect, it } from 'vitest';
import type { Live, Salon } from '../types';
import {
  isTrueVideoLive,
  liveNeedsStreamFieldEnrichment,
  shouldOpenSalonPreviewForLive,
} from './mapLivePreview';

const baseLive = (over: Partial<Live> = {}): Live =>
  ({
    id: 'live-1',
    hostId: 'host-1',
    hostName: 'Host',
    title: 'Live',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: '',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
    },
    latitude: 43.6,
    longitude: 3.8,
    viewersCount: 10,
    isActive: true,
    ...over,
  }) as Live;

const baseSalon = (over: Partial<Salon> = {}): Salon =>
  ({
    id: 'salon-1',
    hostId: 'host-1',
    hostName: 'Host',
    title: 'Salon',
    latitude: 43.6,
    longitude: 3.8,
    playbackState: {
      platform: 'youtube',
      trackId: 'abc123',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
    },
    ...over,
  }) as Salon;

describe('mapLivePreview', () => {
  it('isTrueVideoLive : flux présentation HLS', () => {
    expect(
      isTrueVideoLive(
        baseLive({
          presentationDemoStream: true,
          streamMode: 'cloudflare',
          cloudflarePlaybackUrl: 'https://example.com/stream.m3u8',
        })
      )
    ).toBe(true);
  });

  it('shouldOpenSalonPreviewForLive : BeatCastel démo → live, pas salon', () => {
    const live = baseLive({
      presentationDemoStream: true,
      streamMode: 'cloudflare',
      cloudflarePlaybackUrl: 'https://example.com/stream.m3u8',
    });
    const salon = baseSalon();
    expect(shouldOpenSalonPreviewForLive(live, salon)).toBe(false);
  });

  it('shouldOpenSalonPreviewForLive : live YouTube sans flux vidéo → salon', () => {
    const live = baseLive({ streamMode: undefined });
    const salon = baseSalon();
    expect(shouldOpenSalonPreviewForLive(live, salon)).toBe(true);
  });

  it('liveNeedsStreamFieldEnrichment : payload nearby minimal (BeatCastel avant fix)', () => {
    const stripped = baseLive({ id: 'prod-seed-salon-beat-castel' });
    expect(liveNeedsStreamFieldEnrichment(stripped)).toBe(true);
    expect(shouldOpenSalonPreviewForLive(stripped, baseSalon())).toBe(true);
  });

  it('liveNeedsStreamFieldEnrichment : false quand champs stream présents', () => {
    const live = baseLive({
      presentationDemoStream: true,
      streamMode: 'cloudflare',
      cloudflarePlaybackUrl: 'https://example.com/stream.m3u8',
    });
    expect(liveNeedsStreamFieldEnrichment(live)).toBe(false);
    expect(shouldOpenSalonPreviewForLive(live, baseSalon())).toBe(false);
  });
});
