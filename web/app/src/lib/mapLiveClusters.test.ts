import { describe, it, expect } from 'vitest';
import { clusterLiveMapMarkers } from './mapLiveClusters';
import type { Live, Salon } from '../types';

const baseSalon = (id: string, lat: number, lng: number): Salon =>
  ({
    id,
    hostId: `h-${id}`,
    hostName: `Host ${id}`,
    title: `Salon ${id}`,
    latitude: lat,
    longitude: lng,
    isLive: true,
  }) as Salon;

const baseLive = (id: string, lat: number, lng: number): Live =>
  ({
    id,
    hostId: `h-${id}`,
    hostName: `Live ${id}`,
    title: `Live ${id}`,
    latitude: lat,
    longitude: lng,
    viewersCount: 1,
    playbackState: { title: 'Track', artist: 'Artist', isPlaying: true, platform: 'youtube' },
  }) as Live;

describe('clusterLiveMapMarkers', () => {
  it('groups markers at the same location into one cluster', () => {
    const salons = [baseSalon('s1', 48.8566, 2.3522), baseSalon('s2', 48.8566, 2.3522)];
    const clusters = clusterLiveMapMarkers(salons, [], new Set());
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(2);
    expect(clusters[0]!.salons).toHaveLength(2);
  });

  it('keeps distant markers in separate clusters', () => {
    const salons = [baseSalon('paris', 48.856, 2.352), baseSalon('lyon', 45.764, 4.835)];
    const clusters = clusterLiveMapMarkers(salons, [], new Set());
    expect(clusters).toHaveLength(2);
  });

  it('skips lives already represented as salon id', () => {
    const lives = [baseLive('salon-a', 48.856, 2.352)];
    const clusters = clusterLiveMapMarkers([], lives, new Set(['salon-a']));
    expect(clusters).toHaveLength(0);
  });

  it('mixes salons and standalone lives at the same coordinates', () => {
    const salons = [baseSalon('s1', 48.8566, 2.3522)];
    const lives = [baseLive('l1', 48.8566, 2.3522)];
    const clusters = clusterLiveMapMarkers(salons, lives, new Set());
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.count).toBe(2);
  });
});
