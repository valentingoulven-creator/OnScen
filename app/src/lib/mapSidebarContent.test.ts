import { describe, expect, it } from 'vitest';
import {
  buildMapSidebarContent,
  countLivesFilterBadge,
  countMapSidebarItems,
} from './mapSidebarContent';
import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';
import type { MapViewDetailState } from './mapMarkerVisibility';

const detail = (tier: MapViewDetailState['tier'], flatZoom = 14): MapViewDetailState => ({
  tier,
  flatZoom,
  globeAltitude: null,
  bounds: null,
  mapStyle: 'flat',
});

const salon = (id: string, isLive = false, isPublic = true): Salon => ({
  id,
  hostId: `host-${id}`,
  hostName: `Host ${id}`,
  title: `Salon ${id}`,
  platform: 'youtube',
  playbackState: {
    platform: 'youtube',
    trackId: '',
    title: 'Track',
    artist: 'Artist',
    isPlaying: true,
    progressMs: 0,
    updatedAt: 0,
  },
  latitude: 48.85,
  longitude: 2.35,
  listenersCount: 1,
  allowQueue: false,
  isLive,
  accessMode: isPublic ? 'public' : 'invite',
  isPublic,
});

const live = (id: string): Live => ({
  id,
  hostId: `live-host-${id}`,
  hostName: `Live ${id}`,
  title: `Live ${id}`,
  platform: 'youtube',
  playbackState: {
    platform: 'youtube',
    trackId: '',
    title: 'Track',
    artist: 'Artist',
    isPlaying: true,
    progressMs: 0,
    updatedAt: 0,
  },
  latitude: 48.86,
  longitude: 2.36,
  viewersCount: 3,
  isActive: true,
});

const eventMarker = (id: string): MapEventMarker => ({
  id,
  latitude: 48.87,
  longitude: 2.37,
  title: `Event ${id}`,
  eventDate: '2026-06-10',
  eventLocation: 'Paris',
  authorId: 'a1',
  authorUsername: 'author',
});

const eventCluster = (): MapEventCityCluster => ({
  cityKey: 'paris',
  cityLabel: 'Paris',
  latitude: 48.85,
  longitude: 2.35,
  count: 2,
  events: [eventMarker('e1'), eventMarker('e2')],
});

describe('buildMapSidebarContent', () => {
  it('returns empty sections when no map filter is active', () => {
    const content = buildMapSidebarContent({
      detail: detail('street'),
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [],
      eventClusters: [],
      lives: [],
      salons: [],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.noFilters).toBe(true);
    expect(countMapSidebarItems(content)).toBe(0);
  });

  it('unions Lives + Salon at street zoom', () => {
    const content = buildMapSidebarContent({
      detail: detail('street', 13),
      eventsFilterOn: false,
      livesFilterOn: true,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [live('l1')],
      salons: [salon('s-live', true), salon('s-off', false)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.lives).toHaveLength(1);
    expect(content.salons).toHaveLength(2);
  });

  it('unions Lives + Évènement at city zoom', () => {
    const content = buildMapSidebarContent({
      detail: detail('city', 10),
      eventsFilterOn: true,
      livesFilterOn: true,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [eventMarker('e1')],
      eventClusters: [eventCluster()],
      lives: [live('l1')],
      salons: [],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.events).toHaveLength(1);
    expect(content.lives).toHaveLength(1);
    expect(content.eventClusters).toHaveLength(0);
  });

  it('shows all salons at city zoom when Salon filter is on with Lives', () => {
    const content = buildMapSidebarContent({
      detail: detail('city', 10),
      eventsFilterOn: false,
      livesFilterOn: true,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [live('l1')],
      salons: [salon('s-live', true), salon('s-off', false)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.salons.map((s) => s.id).sort()).toEqual(['s-live', 's-off']);
    expect(content.lives).toHaveLength(1);
  });

  it('excludes invite-only salons when Salon filter is on', () => {
    const content = buildMapSidebarContent({
      detail: detail('street', 13),
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [],
      salons: [salon('pub', false, true), salon('priv', false, false)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.salons.map((s) => s.id)).toEqual(['pub']);
  });

  it('filters salons by visible map bounds when Salon filter is on', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.86, south: 48.84, east: 2.36, west: 2.34 },
        mapStyle: 'flat',
      },
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [],
      salons: [
        { ...salon('in'), latitude: 48.85, longitude: 2.35 },
        { ...salon('out'), latitude: 50.0, longitude: 3.0 },
      ],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.salons.map((s) => s.id)).toEqual(['in']);
  });

  it('clips lives to viewport bounds at street zoom', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: false,
      livesFilterOn: true,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [],
      eventClusters: [],
      lives: [
        live('in-view'),
        { ...live('out-view'), latitude: 50, longitude: 2.36 },
      ],
      salons: [],
      people: [],
      favoriteIds: new Set(),
      nearbyFetchCenter: [48.85, 2.35],
    });
    expect(content.lives.map((l) => l.id)).toEqual(['in-view']);
  });

  it('skips lives viewport clip when fetch anchor is outside bounds (flyTo)', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: false,
      livesFilterOn: true,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [],
      eventClusters: [],
      lives: [
        live('in-view'),
        { ...live('out-view'), latitude: 50, longitude: 2.36 },
      ],
      salons: [],
      people: [],
      favoriteIds: new Set(),
      nearbyFetchCenter: [45.76, 4.84],
    });
    expect(content.lives.map((l) => l.id)).toEqual(['in-view', 'out-view']);
  });

  it('counts lives badge with standalone lives and live salons in viewport', () => {
    const bounds = {
      tier: 'city' as const,
      flatZoom: 10,
      globeAltitude: null,
      bounds: { north: 49, south: 48, east: 3, west: 2 },
      mapStyle: 'flat' as const,
    };
    const content = buildMapSidebarContent({
      detail: bounds,
      eventsFilterOn: false,
      livesFilterOn: true,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [],
      eventClusters: [],
      lives: [live('l1')],
      salons: [salon('s-live', true)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(countLivesFilterBadge(true, false, content, 1)).toBe(2);
    expect(countLivesFilterBadge(true, true, content, 0)).toBe(1);
  });

  it('unions all three filters at street zoom', () => {
    const content = buildMapSidebarContent({
      detail: detail('street', 13),
      eventsFilterOn: true,
      livesFilterOn: true,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [eventMarker('e1')],
      eventClusters: [eventCluster()],
      lives: [live('l1')],
      salons: [salon('s1')],
      people: [] as NearbyPerson[],
      favoriteIds: new Set(),
    });
    expect(countMapSidebarItems(content)).toBe(3);
    expect(content.events).toHaveLength(1);
    expect(content.lives).toHaveLength(1);
    expect(content.salons).toHaveLength(1);
  });

  it('all three filters each viewport-clip independently at street zoom', () => {
    // bounds centred on Paris: salon(48.85/2.35), live(48.86/2.36), event(48.87/2.37) are inside
    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.83, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: true,
      livesFilterOn: true,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [
        eventMarker('e-in'),
        { ...eventMarker('e-out'), latitude: 51.5, longitude: -0.1 },
      ],
      eventClusters: [],
      lives: [
        live('l-in'),
        { ...live('l-out'), latitude: 51.5, longitude: -0.1 },
      ],
      salons: [
        salon('s-in'),
        { ...salon('s-out'), latitude: 51.5, longitude: -0.1 },
      ],
      people: [] as NearbyPerson[],
      favoriteIds: new Set(),
    });
    expect(content.events.map((e) => e.id)).toEqual(['e-in']);
    expect(content.lives.map((l) => l.id)).toEqual(['l-in']);
    expect(content.salons.map((s) => s.id)).toEqual(['s-in']);
  });

  it('shows public salons at overview when Salon filter is on', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'overview',
        flatZoom: 5,
        globeAltitude: null,
        bounds: { north: 50, south: 47, east: 4, west: 1 },
        mapStyle: 'flat',
      },
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [],
      salons: [salon('s-live', true), salon('s-off', false)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.zoomTooWide).toBe(false);
    expect(content.salons.map((s) => s.id).sort()).toEqual(['s-live', 's-off']);
  });

  it('skips salon viewport clip during flyTo when fetch anchor is outside bounds', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: true,
      eventsOnly: false,
      showAllSalonsAtCityZoom: true,
      mapEvents: [],
      eventClusters: [],
      lives: [],
      salons: [
        { ...salon('in-view'), latitude: 48.85, longitude: 2.35 },
        { ...salon('out-view'), latitude: 50, longitude: 2.36 },
      ],
      people: [],
      favoriteIds: new Set(),
      nearbyFetchCenter: [45.76, 4.84],
    });
    expect(content.salons.map((s) => s.id).sort()).toEqual(['in-view', 'out-view']);
  });

  it('event clusters viewport-clipped at overview tier independently of lives and salons', () => {
    // overview tier: only event clusters shown (lives/salons hidden by zoomTooWide)
    const content = buildMapSidebarContent({
      detail: {
        tier: 'overview',
        flatZoom: 5,
        globeAltitude: null,
        bounds: { north: 50, south: 47, east: 4, west: 1 },
        mapStyle: 'flat',
      },
      eventsFilterOn: true,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsOnly: true,
      showAllSalonsAtCityZoom: false,
      mapEvents: [eventMarker('e1')],
      eventClusters: [
        eventCluster(),                                         // paris (48.85/2.35) — inside
        { ...eventCluster(), cityKey: 'berlin', cityLabel: 'Berlin', latitude: 52.5, longitude: 13.4 }, // outside
      ],
      lives: [],
      salons: [],
      people: [] as NearbyPerson[],
      favoriteIds: new Set(),
    });
    expect(content.eventClusters).toHaveLength(1);
    expect(content.eventClusters[0]!.cityKey).toBe('paris');
    expect(content.zoomTooWide).toBe(false);
  });
});
