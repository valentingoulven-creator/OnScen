import { describe, expect, it } from 'vitest';
import {
  classifyMapMarkerCoords,
  clusterSalonsLivesByMajorCity,
} from './mapMajorCityLiveClusters';
import type { Live, Salon } from '../types';

const parisCenter = { lat: 48.8566, lon: 2.3522 };
const parisGeo = { lat: 48.87, lon: 2.38 };

const baseSalon = (id: string, lat: number, lng: number, isLive = true): Salon =>
  ({
    id,
    hostId: `h-${id}`,
    hostName: `Host ${id}`,
    title: `Salon ${id}`,
    latitude: lat,
    longitude: lng,
    isLive,
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

describe('classifyMapMarkerCoords', () => {
  it('treats exact preset city coords as city-anchored', () => {
    const r = classifyMapMarkerCoords(parisCenter.lat, parisCenter.lon);
    expect(r.kind).toBe('cityAnchored');
    expect(r.city?.id).toBe('paris');
  });

  it('treats offset coords within metro as geolocated in city', () => {
    const r = classifyMapMarkerCoords(parisGeo.lat, parisGeo.lon);
    expect(r.kind).toBe('geolocatedInCity');
    expect(r.city?.id).toBe('paris');
  });
});

describe('clusterSalonsLivesByMajorCity', () => {
  it('groups city-anchored and geolocated markers under the same city cluster', () => {
    const salons = [baseSalon('anchored', parisCenter.lat, parisCenter.lon)];
    const lives = [baseLive('geo', parisGeo.lat, parisGeo.lon)];
    const { cityClusters, geolocatedRemoteLives } = clusterSalonsLivesByMajorCity(
      salons,
      lives,
      new Set()
    );
    expect(cityClusters).toHaveLength(1);
    expect(cityClusters[0]!.cityId).toBe('paris');
    expect(cityClusters[0]!.cityAnchoredSalons).toHaveLength(1);
    expect(cityClusters[0]!.geolocatedLives).toHaveLength(1);
    expect(geolocatedRemoteLives).toHaveLength(0);
  });

  it('keeps remote geolocated markers outside city clusters', () => {
    const lives = [baseLive('remote', 46.2, -2.1)];
    const { cityClusters, geolocatedRemoteLives } = clusterSalonsLivesByMajorCity([], lives, new Set());
    expect(cityClusters).toHaveLength(0);
    expect(geolocatedRemoteLives).toHaveLength(1);
  });
});
