import { describe, expect, it } from 'vitest';
import type { MapEventCityCluster } from '../types';
import {
  areBoundsStableForViewportClip,
  clipLivesForMapView,
  clipSalonsForMapView,
  filterEventClustersInViewport,
  filterMapEventMarkersInMapView,
  filterLivesInViewport,
  filterPeopleInViewport,
  filterSalonsForSalonMapFilter,
  filterSalonsForZoom,
  filterCapitalsInGlobeRegion,
  getGlobeDetailTier,
  getMapBoundsCenter,
  getMapMarkerVisibility,
  GLOBE_ALTITUDE_CITY_MAX,
  GLOBE_ALTITUDE_STREET_MAX,
  isPublicSalon,
  mapBoundsEqual,
  mapSidebarDetailEqual,
  shouldClipMapMarkersToViewport,
  resolveMapViewMarkerFilterFlags,
  shouldShowAllSalonsAtCityZoom,
  shouldSkipMapEventViewportClip,
  type MapViewDetailState,
} from './mapMarkerVisibility';

describe('viewport stability helpers', () => {
  const parisBounds = { north: 48.9, south: 48.8, east: 2.4, west: 2.3 };

  it('getMapBoundsCenter returns bbox midpoint', () => {
    const [lat, lon] = getMapBoundsCenter(parisBounds);
    expect(lat).toBeCloseTo(48.85);
    expect(lon).toBeCloseTo(2.35);
  });

  it('areBoundsStableForViewportClip is true when anchor is inside bounds', () => {
    expect(areBoundsStableForViewportClip(parisBounds, 48.85, 2.35)).toBe(true);
    expect(areBoundsStableForViewportClip(parisBounds, 50, 2.35)).toBe(false);
  });

  it('shouldClipMapMarkersToViewport requires flat map and stable anchor', () => {
    const detail: MapViewDetailState = {
      tier: 'street',
      flatZoom: 14,
      globeAltitude: null,
      bounds: parisBounds,
      mapStyle: 'flat',
    };
    expect(shouldClipMapMarkersToViewport(detail, [48.85, 2.35])).toBe(true);
    expect(shouldClipMapMarkersToViewport(detail, [53.35, -6.26])).toBe(false);
    expect(
      shouldClipMapMarkersToViewport({ ...detail, mapStyle: 'globe' }, [48.85, 2.35])
    ).toBe(false);
  });
});

describe('mapBoundsEqual', () => {
  it('treats nearly identical bounds as equal', () => {
    const a = { north: 49, south: 48, east: 3, west: 2 };
    const b = { north: 49.0001, south: 48.0001, east: 3.0001, west: 2.0001 };
    expect(mapBoundsEqual(a, b)).toBe(true);
  });
});

describe('mapSidebarDetailEqual', () => {
  const base = (tier: MapViewDetailState['tier']): MapViewDetailState => ({
    tier,
    flatZoom: tier === 'overview' ? 5 : tier === 'city' ? 10 : 14,
    globeAltitude: null,
    bounds: { north: 49, south: 48, east: 3, west: 2 },
    mapStyle: 'flat',
  });

  it('ignores flatZoom within the same tier', () => {
    const a = base('city');
    const b = { ...a, flatZoom: 11 };
    expect(mapSidebarDetailEqual(a, b)).toBe(true);
  });

  it('detects tier changes', () => {
    expect(mapSidebarDetailEqual(base('city'), base('street'))).toBe(false);
  });
});

describe('shouldShowAllSalonsAtCityZoom', () => {
  it('is true whenever Salon filter is on', () => {
    expect(shouldShowAllSalonsAtCityZoom(true)).toBe(true);
    expect(shouldShowAllSalonsAtCityZoom(false)).toBe(false);
  });
});

describe('resolveMapViewMarkerFilterFlags', () => {
  const baseInput = {
    livesFilterOn: false,
    salonFilterOn: false,
    eventsFilterOn: false,
    sidebarMapFilterLivesFollowing: false,
    sidebarMapFilterSalonsFollowing: false,
    sidebarMapFilterEventsFollowing: false,
    sidebarMapFilterSponso: false,
    followingMapAmbientOn: false,
  };

  it('activates salon map visibility for sidebar Salon suivi chip', () => {
    const flags = resolveMapViewMarkerFilterFlags({
      ...baseInput,
      sidebarMapFilterSalonsFollowing: true,
    });
    expect(flags.salonFilterOn).toBe(true);
    expect(flags.showAllSalonsAtCityZoom).toBe(true);
    expect(flags.livesFilterOn).toBe(false);
  });

  it('keeps lives off when only sidebar salon following is active', () => {
    const flags = resolveMapViewMarkerFilterFlags({
      ...baseInput,
      sidebarMapFilterSalonsFollowing: true,
    });
    expect(flags.livesFilterOn).toBe(false);
  });

  it('activates events map visibility for sidebar Événement suivi chip', () => {
    const flags = resolveMapViewMarkerFilterFlags({
      ...baseInput,
      sidebarMapFilterEventsFollowing: true,
    });
    expect(flags.eventsFilterOn).toBe(true);
    expect(flags.livesFilterOn).toBe(false);
    expect(flags.salonFilterOn).toBe(false);
  });
});

describe('shouldSkipMapEventViewportClip', () => {
  it('skips viewport clip for sidebar Événement suivi chip (global pins)', () => {
    expect(
      shouldSkipMapEventViewportClip({
        followingMapAmbientOn: false,
        effectiveEventsFilterOn: true,
        sidebarMapFilterEventsFollowing: true,
        mapEventDayPinFilter: null,
      })
    ).toBe(true);
  });

  it('clips when day pin filter is active on sidebar events chip', () => {
    expect(
      shouldSkipMapEventViewportClip({
        followingMapAmbientOn: false,
        effectiveEventsFilterOn: true,
        sidebarMapFilterEventsFollowing: true,
        mapEventDayPinFilter: '2026-07-28',
      })
    ).toBe(false);
  });

  it('skips clip for following ambient mode without explicit events filter', () => {
    expect(
      shouldSkipMapEventViewportClip({
        followingMapAmbientOn: true,
        effectiveEventsFilterOn: false,
        sidebarMapFilterEventsFollowing: false,
        mapEventDayPinFilter: null,
      })
    ).toBe(true);
  });
});

describe('sidebar events following map pins', () => {
  it('shows event clusters when sidebar chip uses effective events filter', () => {
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
      hasEventClusters: true,
      showAllSalonsAtCityZoom: flags.showAllSalonsAtCityZoom,
      livesFilterOn: flags.livesFilterOn,
      salonFilterOn: flags.salonFilterOn,
      eventsFilterOn: flags.eventsFilterOn,
    });
    expect(visibility.eventClusters).toBe(true);
    expect(visibility.salons).toBe(false);
    expect(visibility.lives).toBe(true);
  });

  it('hides event clusters without effective events filter (regression)', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: false,
      showAllSalonsAtCityZoom: false,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsFilterOn: false,
    });
    expect(visibility.eventClusters).toBe(false);
  });
});

describe('sidebar salon following map pins', () => {
  it('renders followed offline salon pins when sidebar chip uses effective salon filter', () => {
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
    const mapSalons = [{ id: 's-off', isLive: false as const }];
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      showAllSalonsAtCityZoom: flags.showAllSalonsAtCityZoom,
      livesFilterOn: flags.livesFilterOn,
      salonFilterOn: flags.salonFilterOn,
      eventsFilterOn: flags.eventsFilterOn,
    });
    expect(visibility.salons).toBe(true);
    expect(visibility.salonsPinsOnly).toBe(true);
    expect(
      filterSalonsForZoom(mapSalons, visibility, flags.showAllSalonsAtCityZoom, 'overview')
    ).toEqual(mapSalons);
  });

  it('hides offline salon pins without effective salon filter (regression)', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      showAllSalonsAtCityZoom: false,
      livesFilterOn: false,
      salonFilterOn: false,
      eventsFilterOn: false,
    });
    const mapSalons = [{ id: 's-off', isLive: false as const }];
    expect(
      filterSalonsForZoom(mapSalons, visibility, false, 'overview')
    ).toEqual([]);
  });
});

describe('isPublicSalon', () => {
  it('detects public vs invite salons', () => {
    expect(isPublicSalon({ accessMode: 'public' })).toBe(true);
    expect(isPublicSalon({ accessMode: 'invite' })).toBe(false);
    expect(isPublicSalon({ isPublic: true })).toBe(true);
    expect(isPublicSalon({ isPublic: false })).toBe(false);
    expect(isPublicSalon({})).toBe(false);
  });
});

describe('filterSalonsForSalonMapFilter', () => {
  const bounds = { north: 49, south: 48, east: 3, west: 2 };

  it('keeps public salons in viewport only', () => {
    const result = filterSalonsForSalonMapFilter(
      [
        { id: 'a', latitude: 48.5, longitude: 2.5, accessMode: 'public' as const },
        { id: 'b', latitude: 48.5, longitude: 2.5, accessMode: 'invite' as const },
        { id: 'c', latitude: 55, longitude: 2.5, accessMode: 'public' as const },
      ],
      bounds
    );
    expect(result.map((s) => s.id)).toEqual(['a']);
  });
});

describe('viewport filters for lives and people', () => {
  const bounds = { north: 49, south: 48, east: 3, west: 2 };

  it('keeps lives inside bounds only', () => {
    const lives = [
      { id: 'in', latitude: 48.5, longitude: 2.5 },
      { id: 'out', latitude: 50, longitude: 2.5 },
    ];
    expect(filterLivesInViewport(lives, bounds).map((l) => l.id)).toEqual(['in']);
  });

  it('keeps people with valid coords inside bounds only', () => {
    const people = [
      { id: 'in', latitude: 48.5, longitude: 2.5 },
      { id: 'out', latitude: 50, longitude: 2.5 },
      { id: 'no-coords', latitude: null, longitude: null },
    ];
    expect(filterPeopleInViewport(people, bounds).map((p) => p.id)).toEqual(['in']);
  });

  it('returns all items when bounds are null (globe)', () => {
    const lives = [{ id: 'a', latitude: 48.5, longitude: 2.5 }];
    expect(filterLivesInViewport(lives, null)).toHaveLength(1);
  });
});

describe('filterEventClustersInViewport', () => {
  const bounds = { north: 48.84, south: 48.83, east: 2.38, west: 2.37 };

  const parisCluster = (): MapEventCityCluster => ({
    cityKey: 'paris',
    cityLabel: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    count: 2,
    events: [
      {
        id: 'arena',
        latitude: 48.8387,
        longitude: 2.3786,
        title: 'Accor Arena',
        eventLocation: 'Accor Arena, Paris',
      },
      {
        id: 'olympia',
        latitude: 48.8699,
        longitude: 2.3282,
        title: 'Olympia',
        eventLocation: 'Olympia, Paris',
      },
    ],
  });

  it('at overview keeps all clusters (no viewport clip when dezoomed)', () => {
    const clusters = [parisCluster()];
    expect(filterEventClustersInViewport(clusters, bounds, 'overview')).toHaveLength(1);
  });

  it('at street zoom keeps cluster when a venue is in bounds even if centroid is out', () => {
    const clusters = [parisCluster()];
    const result = filterEventClustersInViewport(clusters, bounds, 'street');
    expect(result).toHaveLength(1);
    expect(result[0]!.events.map((e) => e.id)).toEqual(['arena']);
    expect(result[0]!.count).toBe(1);
  });

  it('returns all clusters when bounds are null', () => {
    expect(filterEventClustersInViewport([parisCluster()], null, 'street')).toHaveLength(1);
  });
});

describe('getMapMarkerVisibility lives at globe tiers', () => {
  it('shows live sonars at globe overview even when Lives filter is off', () => {
    const tier = getGlobeDetailTier(1.0);
    expect(tier).toBe('overview');
    const visibility = getMapMarkerVisibility({
      tier,
      eventsOnly: false,
      hasEventClusters: false,
      livesFilterOn: false,
    });
    expect(visibility.lives).toBe(true);
    expect(visibility.salons).toBe(false);
    expect(visibility.people).toBe(false);
    expect(visibility.livesPinsOnly).toBe(false);
    expect(visibility.capitals).toBe(false);
    expect(visibility.density).toBe('overview');
  });

  it('shows simplified lives only at globe overview when Lives filter is on (no salon/person pins)', () => {
    const tier = getGlobeDetailTier(1.0);
    const visibility = getMapMarkerVisibility({
      tier,
      eventsOnly: false,
      hasEventClusters: false,
      livesFilterOn: true,
    });
    expect(visibility.lives).toBe(true);
    expect(visibility.salons).toBe(false);
    expect(visibility.people).toBe(false);
    expect(visibility.livesPinsOnly).toBe(true);
    expect(visibility.density).toBe('overview');
  });

  it('shows salons at overview when Salon filter is on', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      salonFilterOn: true,
    });
    expect(visibility.salons).toBe(true);
    expect(visibility.density).toBe('overview');
  });

  it('always shows event clusters at overview when Events filter is on', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: true,
      hasEventClusters: false,
      eventsFilterOn: true,
    });
    expect(visibility.eventClusters).toBe(true);
    expect(visibility.capitals).toBe(false);
  });

  it('hides ambient event clusters when Salon filter is on without Events', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: true,
      salonFilterOn: true,
      eventsFilterOn: false,
    });
    expect(visibility.eventClusters).toBe(false);
  });

  it('shows ambient event clusters when no map content filter is active', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: true,
    });
    expect(visibility.eventClusters).toBe(true);
  });

  it('shows lives at globe city and street altitude when Lives filter is on', () => {
    const cityAlt = GLOBE_ALTITUDE_CITY_MAX - 0.1;
    const streetAlt = GLOBE_ALTITUDE_STREET_MAX - 0.05;
    for (const altitude of [cityAlt, streetAlt]) {
      const tier = getGlobeDetailTier(altitude);
      const visibility = getMapMarkerVisibility({
        tier,
        eventsOnly: false,
        hasEventClusters: false,
        livesFilterOn: true,
      });
      expect(visibility.lives).toBe(true);
      expect(visibility.density).toBe('full');
    }
  });

  it('always shows lives at city zoom even when no map filter is on', () => {
    for (const tier of ['city', 'street'] as const) {
      const visibility = getMapMarkerVisibility({
        tier,
        eventsOnly: false,
        hasEventClusters: false,
      });
      expect(visibility.salons).toBe(false);
      expect(visibility.lives).toBe(true);
      expect(visibility.people).toBe(false);
    }
  });

  it('always keeps live salons visible at city/street zoom even without a map filter', () => {
    const salons = [
      { id: 'live', isLive: true },
      { id: 'off', isLive: false },
    ];
    for (const tier of ['city', 'street'] as const) {
      const visibility = getMapMarkerVisibility({
        tier,
        eventsOnly: false,
        hasEventClusters: false,
      });
      const visible = filterSalonsForZoom(salons, visibility, false, tier);
      expect(visible.map((s) => s.id)).toEqual(['live']);
    }
  });
});

describe('clipLivesForMapView anti-blackout', () => {
  const detail: MapViewDetailState = {
    tier: 'street',
    flatZoom: 14,
    globeAltitude: null,
    bounds: { north: 48.9, south: 48.8, east: 2.4, west: 2.3 },
    mapStyle: 'flat',
  };

  it('returns unclipped lives when viewport clip would empty a non-empty list', () => {
    const lives = [
      { id: 'far', latitude: 43.61, longitude: 3.87 },
      { id: 'also-far', latitude: 45.76, longitude: 4.84 },
    ];
    const clipped = clipLivesForMapView(lives, detail, [48.85, 2.35]);
    expect(clipped).toHaveLength(2);
  });

  it('still clips lives inside viewport when some match', () => {
    const lives = [
      { id: 'in', latitude: 48.85, longitude: 2.35 },
      { id: 'out', latitude: 43.61, longitude: 3.87 },
    ];
    const clipped = clipLivesForMapView(lives, detail, [48.85, 2.35]);
    expect(clipped.map((l) => l.id)).toEqual(['in']);
  });

  it('clipSalonsForMapView uses the same anti-blackout guard', () => {
    const salons = [{ id: 's1', latitude: 43.61, longitude: 3.87, isLive: true }];
    expect(clipSalonsForMapView(salons, detail, [48.85, 2.35])).toHaveLength(1);
  });
});

describe('filterSalonsForZoom at overview', () => {
  const salons = [
    { id: 'live', isLive: true },
    { id: 'off', isLive: false },
  ];

  it('keeps offline salons as overview dots when Salon filter is on', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      salonFilterOn: true,
    });
    const visible = filterSalonsForZoom(salons, visibility, true, 'overview');
    expect(visible.map((s) => s.id)).toEqual(['off']);
  });
});

describe('filterSalonsForZoom with combined filters', () => {
  const salons = [
    { id: 'live', isLive: true },
    { id: 'off', isLive: false },
  ];

  it('keeps offline salons only at city zoom when Salon filter is on (no live salons)', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: false,
      salonFilterOn: true,
    });
    expect(visibility.salonsPinsOnly).toBe(true);
    expect(visibility.lives).toBe(false);
    const visible = filterSalonsForZoom(salons, visibility, true, 'city');
    expect(visible.map((s) => s.id)).toEqual(['off']);
  });

  it('keeps live salons for MapView merge when only Lives is on (no offline salons)', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'city',
      eventsOnly: false,
      hasEventClusters: false,
      livesFilterOn: true,
    });
    expect(visibility.livesPinsOnly).toBe(true);
    const visible = filterSalonsForZoom(salons, visibility, false, 'city');
    expect(visible.map((s) => s.id)).toEqual(['live']);
  });

  it('keeps offline salons at overview when Salon filter is on', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      salonFilterOn: true,
    });
    const visible = filterSalonsForZoom(salons, visibility, true, 'overview');
    expect(visible.map((s) => s.id)).toEqual(['off']);
  });

  it('shows live salon floor at overview only without Salon filter', () => {
    const visibility = getMapMarkerVisibility({
      tier: 'overview',
      eventsOnly: false,
      hasEventClusters: false,
      salonFilterOn: true,
    });
    const visible = filterSalonsForZoom(salons, visibility, false, 'overview');
    expect(visible).toEqual([]);
  });
});

describe('capitals progressive disclosure', () => {
  it('hides capitals at overview tier on flat and globe', () => {
    expect(
      getMapMarkerVisibility({
        tier: 'overview',
        eventsOnly: false,
        hasEventClusters: false,
      }).capitals
    ).toBe(false);
  });

  it('shows capitals at city tier when not events-only', () => {
    expect(
      getMapMarkerVisibility({
        tier: 'city',
        eventsOnly: false,
        hasEventClusters: false,
      }).capitals
    ).toBe(true);
  });

  it('filters globe capitals by distance from center', () => {
    const caps = [
      { lat: 48.8566, lng: 2.3522, name: 'Paris' },
      { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    ];
    const nearParis = filterCapitalsInGlobeRegion(caps, 48.85, 2.35, 600);
    expect(nearParis.map((c) => c.name)).toContain('Paris');
    expect(nearParis.map((c) => c.name)).not.toContain('Tokyo');
  });
});

describe('filterMapEventMarkersInMapView', () => {
  const franceMarker = {
    id: 'sponso-fr',
    latitude: 43.6405,
    longitude: 3.9395,
    title: 'Solar Festival',
  };
  const italyMarker = {
    id: 'sponso-it',
    latitude: 41.9028,
    longitude: 12.4964,
    title: 'Roma Sponso',
  };

  it('flat map with events filter keeps sponso in bounds only', () => {
    const bounds = { north: 46, south: 41, east: 14, west: 2 };
    const visible = filterMapEventMarkersInMapView(
      [franceMarker, italyMarker],
      {
        mapStyle: 'flat',
        bounds,
        tier: 'overview',
        centerLat: 43,
        centerLng: 6,
        globeAltitude: null,
      },
      { eventsFilterOn: true }
    );
    expect(visible.map((m) => m.id)).toEqual(['sponso-fr', 'sponso-it']);
  });

  it('flat map with events filter excludes sponso outside bounds', () => {
    const bounds = { north: 42.5, south: 41.5, east: 13, west: 11.5 };
    const visible = filterMapEventMarkersInMapView(
      [franceMarker, italyMarker],
      {
        mapStyle: 'flat',
        bounds,
        tier: 'city',
        centerLat: 42,
        centerLng: 12.2,
        globeAltitude: null,
      },
      { eventsFilterOn: true }
    );
    expect(visible.map((m) => m.id)).toEqual(['sponso-it']);
  });
});
