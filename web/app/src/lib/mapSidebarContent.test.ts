import { describe, expect, it } from 'vitest';
import {
  buildMapSidebarContent,
  countLivesFilterBadge,
  countMapSidebarItems,
  followedOfflineSalonsForMap,
} from './mapSidebarContent';
import {
  filterSalonsForZoom,
  getMapMarkerVisibility,
  resolveMapViewMarkerFilterFlags,
  shouldSkipMapEventViewportClip,
} from './mapMarkerVisibility';
import { splitSalonsForMapMarkers } from './mapLiveSalonMarkers';
import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';
import type { MapViewDetailState } from './mapMarkerVisibility';

const detail = (tier: MapViewDetailState['tier'], flatZoom = 14): MapViewDetailState => ({
  tier,
  flatZoom,
  globeAltitude: null,
  bounds: null,
  mapStyle: 'flat',
});

const salon = (id: string, isLive = false, hostId = `host-${id}`, isPublic = true): Salon => ({
  id,
  hostId,
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

const live = (id: string, hostId = `live-host-${id}`): Live => ({
  id,
  hostId,
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

const eventMarker = (id: string, authorId = 'a1'): MapEventMarker => ({
  id,
  latitude: 48.87,
  longitude: 2.37,
  title: `Event ${id}`,
  eventDate: '2026-06-10',
  eventLocation: 'Paris',
  authorId,
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
  it('sans filtre carte : sections Suivi lives / salons / événements', () => {
    const following = new Set(['host-a', 'host-b']);
    const saved = new Set(['ev-saved']);
    const content = buildMapSidebarContent({
      detail: detail('street'),
      eventsFilterOn: false,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [],
      allMapEvents: [eventMarker('ev-saved', 'host-x'), eventMarker('ev-other', 'host-y')],
      eventClusters: [],
      lives: [live('l1', 'host-a'), live('l2', 'host-z')],
      salons: [salon('s1', false, 'host-b'), salon('s2', false, 'host-z')],
      people: [],
      favoriteIds: new Set(),
      followingIds: following,
      savedEventPostIds: saved,
    });
    expect(content.noFilters).toBe(true);
    expect(content.livesFollowing.map((l) => l.id)).toEqual(['l1']);
    expect(content.salonsFollowing.map((s) => s.id)).toEqual(['s1']);
    expect(content.eventsFollowing.map((e) => e.id)).toEqual(['ev-saved']);
    expect(countMapSidebarItems(content)).toBe(3);
  });

  it('sans filtre carte : Suivi salons via allSalons même si salons viewport vide', () => {
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
      allSalons: [salon('s-pip', false, 'host-pip')],
      people: [],
      favoriteIds: new Set(),
      followingIds: new Set(['host-pip']),
      savedEventPostIds: new Set(),
    });
    expect(content.salonsFollowing.map((s) => s.id)).toEqual(['s-pip']);
  });

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
    expect(content.salons).toHaveLength(1);
    expect(content.salons.map((s) => s.id)).toEqual(['s-off']);
  });

  it('excludes active live salons from Salon sidebar (live = Lives filter only)', () => {
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
      salons: [salon('s-live', true), salon('s-off', false)],
      people: [],
      favoriteIds: new Set(),
    });
    expect(content.salons.map((s) => s.id)).toEqual(['s-off']);
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
    expect(content.salons.map((s) => s.id).sort()).toEqual(['s-off']);
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
      salons: [salon('pub', false, 'host-pub', true), salon('priv', false, 'host-priv', false)],
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
    expect(content.salons.map((s) => s.id)).toEqual(['s-off']);
  });

  it('shows salons at overview even outside viewport bounds (no viewport clip)', () => {
    const content = buildMapSidebarContent({
      detail: {
        tier: 'overview',
        flatZoom: 5,
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
        { ...salon('out-view'), latitude: 43.61, longitude: 3.87 },
      ],
      people: [],
      favoriteIds: new Set(),
      nearbyFetchCenter: [48.85, 2.35],
    });
    expect(content.salons.map((s) => s.id).sort()).toEqual(['in-view', 'out-view']);
    expect(content.salonsSuggestions).toHaveLength(0);
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

  it('splits lives into following, viewport and suggestions', () => {
    const followed = live('l-follow');
    followed.hostId = 'host-followed';
    followed.viewersCount = 5;
    const inView = live('l-view');
    inView.hostId = 'host-view';
    inView.viewersCount = 38;
    const popular = live('l-pop');
    popular.hostId = 'host-pop';
    popular.viewersCount = 100;
    popular.latitude = 43.6;
    popular.longitude = 3.87;

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
      lives: [followed, inView, popular],
      salons: [],
      people: [],
      favoriteIds: new Set(),
      followingIds: new Set(['host-followed']),
      nearbyFetchCenter: [48.85, 2.35],
    });

    expect(content.livesFollowing.map((l) => l.id)).toEqual(['l-follow']);
    expect(content.lives.map((l) => l.id)).toContain('l-view');
    expect(content.livesSuggestions.map((l) => l.id)).toEqual(['l-pop']);
    expect(countMapSidebarItems(content)).toBe(3);
  });

  it('splits salons into following, viewport and suggestions', () => {
    const followed = salon('s-follow');
    followed.hostId = 'host-followed';
    followed.listenersCount = 5;
    const inView = salon('s-view');
    inView.hostId = 'host-view';
    inView.listenersCount = 12;
    const popular = salon('s-pop');
    popular.hostId = 'host-pop';
    popular.listenersCount = 40;
    popular.latitude = 43.6;
    popular.longitude = 3.87;

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
      salons: [followed, inView, popular],
      people: [],
      favoriteIds: new Set(),
      followingIds: new Set(['host-followed']),
      nearbyFetchCenter: [48.85, 2.35],
    });

    expect(content.salonsFollowing.map((s) => s.id)).toEqual(['s-follow']);
    expect(content.salons.map((s) => s.id)).toContain('s-view');
    expect(content.salonsSuggestions.map((s) => s.id)).toEqual(['s-pop']);
  });

  it('splits events into following, viewport and suggestions', () => {
    const followed = eventMarker('e-follow');
    followed.authorId = 'author-followed';
    const inView = eventMarker('e-view');
    inView.authorId = 'author-view';
    const other = eventMarker('e-other');
    other.authorId = 'author-other';
    other.latitude = 43.6;
    other.longitude = 3.87;

    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: true,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [followed, inView, other],
      eventClusters: [],
      lives: [],
      salons: [],
      people: [],
      favoriteIds: new Set(),
      followingIds: new Set(['author-followed']),
      nearbyFetchCenter: [48.85, 2.35],
    });

    expect(content.eventsFollowing.map((e) => e.id)).toEqual(['e-follow']);
    expect(content.events.map((e) => e.id)).toContain('e-view');
    expect(content.eventsSuggestions.map((e) => e.id)).toEqual(['e-other']);
  });

  it('includes saved (favorited) events in following section', () => {
    const saved = eventMarker('e-saved');
    saved.authorId = 'author-other';
    const inView = eventMarker('e-view');
    inView.authorId = 'author-view';
    const other = eventMarker('e-other');
    other.authorId = 'author-other';
    other.latitude = 43.6;
    other.longitude = 3.87;

    const content = buildMapSidebarContent({
      detail: {
        tier: 'street',
        flatZoom: 14,
        globeAltitude: null,
        bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
        mapStyle: 'flat',
      },
      eventsFilterOn: true,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsOnly: false,
      showAllSalonsAtCityZoom: false,
      mapEvents: [saved, inView, other],
      eventClusters: [],
      lives: [],
      salons: [],
      people: [],
      favoriteIds: new Set(),
      followingIds: new Set(),
      savedEventPostIds: new Set(['e-saved']),
      nearbyFetchCenter: [48.85, 2.35],
    });

    expect(content.eventsFollowing.map((e) => e.id)).toEqual(['e-saved']);
    expect(content.eventsSuggestions.map((e) => e.id)).toEqual(['e-other']);
  });
});

describe('followedOfflineSalonsForMap', () => {
  it('returns followed offline public salons with valid coordinates', () => {
    const following = new Set(['host-a', 'host-b']);
    const result = followedOfflineSalonsForMap(
      [
        salon('s-off', false, 'host-a'),
        salon('s-live', true, 'host-b'),
        salon('s-priv', false, 'host-a', false),
        { ...salon('s-bad', false, 'host-a'), latitude: null as unknown as number },
      ],
      following
    );
    expect(result.map((s) => s.id)).toEqual(['s-off']);
  });

  it('returns empty when no following ids', () => {
    expect(followedOfflineSalonsForMap([salon('s1')], new Set())).toEqual([]);
  });

  it('sidebar Salon chip shows at least followed offline salon pins on map', () => {
    const following = new Set(['host-a']);
    const salons = [
      salon('s-off', false, 'host-a'),
      salon('s-live', true, 'host-a'),
    ];
    const mapSalons = followedOfflineSalonsForMap(salons, following);
    expect(mapSalons.map((s) => s.id)).toEqual(['s-off']);

    const flags = resolveMapViewMarkerFilterFlags({
      livesFilterOn: false,
      salonFilterOn: false,
      eventsFilterOn: false,
      sidebarMapFilterLivesFollowing: false,
      sidebarMapFilterSalonsFollowing: true,
      sidebarMapFilterEventsFollowing: false,
      sidebarMapFilterSponso: false,
      followingMapAmbientOn: false,
    });
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: false,
      showAllSalonsAtCityZoom: flags.showAllSalonsAtCityZoom,
      livesFilterOn: flags.livesFilterOn,
      salonFilterOn: flags.salonFilterOn,
      eventsFilterOn: flags.eventsFilterOn,
    });
    const visible = filterSalonsForZoom(
      mapSalons,
      visibility,
      flags.showAllSalonsAtCityZoom,
      'city'
    );
    expect(visible.map((s) => s.id)).toEqual(['s-off']);
  });

  it('sidebar Salon chip feeds offline salons to globe overview marker pool', () => {
    const following = new Set(['host-a']);
    const salons = [
      salon('s-off', false, 'host-a'),
      salon('s-live', true, 'host-a'),
    ];
    const mapSalons = followedOfflineSalonsForMap(salons, following);
    expect(mapSalons.map((s) => s.id)).toEqual(['s-off']);

    const flags = resolveMapViewMarkerFilterFlags({
      livesFilterOn: false,
      salonFilterOn: false,
      eventsFilterOn: false,
      sidebarMapFilterLivesFollowing: false,
      sidebarMapFilterSalonsFollowing: true,
      sidebarMapFilterEventsFollowing: false,
      sidebarMapFilterSponso: false,
      followingMapAmbientOn: false,
    });
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      showAllSalonsAtCityZoom: flags.showAllSalonsAtCityZoom,
      livesFilterOn: flags.livesFilterOn,
      salonFilterOn: flags.salonFilterOn,
      eventsFilterOn: flags.eventsFilterOn,
    });
    const visible = filterSalonsForZoom(
      mapSalons,
      visibility,
      flags.showAllSalonsAtCityZoom,
      'overview'
    );
    const { offlineSalons } = splitSalonsForMapMarkers(visible);
    expect(offlineSalons.map((s) => s.id)).toEqual(['s-off']);
  });

  it('sidebar Événement chip skips viewport clip and shows followed event pins', () => {
    const following = new Set(['host-a']);
    const saved = new Set<string>();
    const events: MapEventMarker[] = [
      {
        id: 'ev-paris',
        authorId: 'host-a',
        latitude: 48.85,
        longitude: 2.35,
        location: 'Paris',
        title: 'Concert',
      } as MapEventMarker,
    ];
    const followed = events.filter(
      (e) => saved.has(e.id) || (e.authorId != null && following.has(e.authorId))
    );
    expect(followed.map((e) => e.id)).toEqual(['ev-paris']);

    expect(
      shouldSkipMapEventViewportClip({
        followingMapAmbientOn: false,
        effectiveEventsFilterOn: true,
        sidebarMapFilterEventsFollowing: true,
        mapEventDayPinFilter: null,
      })
    ).toBe(true);

    const flags = resolveMapViewMarkerFilterFlags({
      livesFilterOn: false,
      salonFilterOn: false,
      eventsFilterOn: false,
      sidebarMapFilterLivesFollowing: false,
      sidebarMapFilterSalonsFollowing: false,
      sidebarMapFilterEventsFollowing: true,
      sidebarMapFilterSponso: false,
      followingMapAmbientOn: false,
    });
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: true,
      hasEventClusters: followed.length > 0,
      showAllSalonsAtCityZoom: flags.showAllSalonsAtCityZoom,
      livesFilterOn: flags.livesFilterOn,
      salonFilterOn: flags.salonFilterOn,
      eventsFilterOn: flags.eventsFilterOn,
    });
    expect(visibility.eventClusters).toBe(true);
  });
});
