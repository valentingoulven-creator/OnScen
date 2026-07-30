import { describe, expect, it } from 'vitest';
import type { Live, Salon } from '../types';
import {
  filterSalonsForZoom,
  getMapMarkerVisibility,
} from './mapMarkerVisibility';
import {
  linkedSalonIdsForLiveDedup,
  mergeLivesWithLiveSalons,
  salonToMapLive,
  splitSalonsForMapMarkers,
} from './mapLiveSalonMarkers';

const salon = (id: string, isLive = false): Salon => ({
  id,
  hostId: `host-${id}`,
  hostName: `Host ${id}`,
  title: `Salon ${id}`,
  platform: 'youtube',
  playbackState: {
    platform: 'youtube',
    trackId: 'x',
    title: 'Track',
    artist: 'Artist',
    isPlaying: true,
    progressMs: 0,
    updatedAt: 0,
  },
  latitude: 43.6,
  longitude: 3.9,
  listenersCount: 5,
  allowQueue: false,
  isLive,
});

const live = (id: string): Live => ({
  id,
  hostId: 'host-standalone',
  hostName: 'Standalone',
  title: 'Live solo',
  platform: 'youtube',
  playbackState: salon('x').playbackState,
  latitude: 43.61,
  longitude: 3.91,
  viewersCount: 2,
  isActive: true,
});

describe('splitSalonsForMapMarkers', () => {
  it('sépare salons offline et live', () => {
    const { offlineSalons, liveSalons } = splitSalonsForMapMarkers([
      salon('offline-a'),
      salon('live-b', true),
    ]);
    expect(offlineSalons.map((s) => s.id)).toEqual(['offline-a']);
    expect(liveSalons.map((s) => s.id)).toEqual(['live-b']);
  });
});

describe('linkedSalonIdsForLiveDedup', () => {
  it('ignore les salons live (BeatCastel = pin LIVE, pas masqué)', () => {
    const ids = linkedSalonIdsForLiveDedup([
      salon('offline-a'),
      salon('beat-castel', true),
    ]);
    expect(ids.has('offline-a')).toBe(true);
    expect(ids.has('beat-castel')).toBe(false);
  });
});

describe('mergeLivesWithLiveSalons', () => {
  it('ajoute un salon live absent du slice lives', () => {
    const beatCastel = salon('salon-beat-castel', true);
    const merged = mergeLivesWithLiveSalons([live('other-live')], [beatCastel]);
    expect(merged.map((l) => l.id).sort()).toEqual(['other-live', 'salon-beat-castel']);
    const fromSalon = merged.find((l) => l.id === 'salon-beat-castel');
    expect(fromSalon?.salonId).toBe('salon-beat-castel');
    expect(fromSalon?.hostId).toBe('host-salon-beat-castel');
  });

  it('salonToMapLive conserve id partagé salon/live', () => {
    const s = salon('shared-id', true);
    const l = salonToMapLive(s);
    expect(l.id).toBe('shared-id');
    expect(l.salonId).toBe('shared-id');
  });
});

describe('Lives filter map pipeline', () => {
  it('livesPinsOnly : salon live BeatCastel → pin LIVE via merge MapView', () => {
    const beatCastel = salon('prod-seed-salon-beat-castel', true);
    const offline = salon('offline-nearby', false);
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: false,
      livesFilterOn: true,
    });
    const visibleSalons = filterSalonsForZoom(
      [beatCastel, offline],
      visibility,
      false,
      'city'
    );
    expect(visibleSalons.map((s) => s.id)).toEqual(['prod-seed-salon-beat-castel']);

    const { liveSalons } = splitSalonsForMapMarkers(visibleSalons);
    const merged = mergeLivesWithLiveSalons([], liveSalons);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('prod-seed-salon-beat-castel');
    expect(merged[0]?.hostId).toBe('host-prod-seed-salon-beat-castel');
  });
});
