import { forwardRef, lazy, memo, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { GlobeViewProps } from './GlobeView';
import { formatCompactCount } from '../lib/formatCount';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { formatEventDateShort } from '../lib/feedEvents';
import { getEventTypeIcon } from '../lib/eventType';
import type { Salon, Live, NearbyPerson, MapEventCityCluster, MapEventMarker } from '../types';
import { buildEventClusterKey, buildSalonLivePeopleKey } from '../lib/mapMarkersKey';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import { DEFAULT_CENTER } from '../lib/livesGeo';
import { WORLD_CAPITALS } from '../lib/worldCapitals';
import { getUsernameStyle, usernameMapLabelHtml } from '../lib/usernameColor';
import {
  filterPeopleForZoom,
  filterSalonsForZoom,
  getFlatMapDetailTier,
  getGlobeDetailTier,
  getMapMarkerVisibility,
  type MapBounds,
  type MapViewDetailState,
} from '../lib/mapMarkerVisibility';
import { canUseGlobeView } from '../lib/webglSupport';
import { isTouchCoarseViewport } from '../lib/phoneViewport';
import { GlobeErrorBoundary } from './GlobeErrorBoundary';

// Lazy-load the 3D globe (large Three.js bundle) only when needed.
const LazyGlobeView = lazy<React.ComponentType<GlobeViewProps>>(
  () => import('./GlobeView').then((m) => ({ default: m.GlobeView }))
);

export type MapStyle = 'flat' | 'globe';

/** Handle impératif exposé par MapView via forwardRef. */
export interface MapViewHandle {
  /** Repositionne la carte Leaflet instantanément (sans animation). */
  jumpTo: (lat: number, lng: number, zoom?: number) => void;
  /** Anime en douceur la carte vers les coordonnées et le zoom donnés. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  /** Cadre instantanément une zone urbaine (rayon km autour du centre). */
  jumpToCityBounds: (lat: number, lng: number, radiusKm: number) => void;
  /** Anime vers le cadrage d'une ville entière. */
  flyToCityBounds: (
    lat: number,
    lng: number,
    radiusKm: number,
    opts?: { durationSec?: number }
  ) => void;
  /** Pré-positionne la carte plate (cachée) et lance le chargement tuiles avant le crossfade. */
  prepareFlatAt: (lat: number, lng: number, zoom?: number, radiusKm?: number) => void;
}

/** Globe ↔ flat crossfade duration (ms) — keep in sync with CSS transition. */
const MAP_CROSSFADE_MS = 300;

/** Vol carte vers une ville (filtre événement, etc.) — plus lisible que le crossfade. */
export const MAP_CITY_FLY_DURATION_S = 1.15;

/** Min wait before crossfade (ms) — laisse le globe amorcer le zoom. */
const TILE_WARMUP_MIN_MS = 60;

/** Max wait for first Carto tiles before crossfade anyway (ms). */
const TILE_WARMUP_MAX_MS = 380;

/** Zoom level at which capital names become permanently visible on the flat map. */
const CAPITAL_LABEL_MIN_ZOOM = 5;

/** Only bump React zoom state when marker tier or capital labels would change. */
function shouldCommitFlatMapZoom(prevZoom: number, nextZoom: number): boolean {
  if (getFlatMapDetailTier(prevZoom) !== getFlatMapDetailTier(nextZoom)) return true;
  const prevCapitals = prevZoom >= CAPITAL_LABEL_MIN_ZOOM;
  const nextCapitals = nextZoom >= CAPITAL_LABEL_MIN_ZOOM;
  return prevCapitals !== nextCapitals;
}

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxZoom: number }> = {
  flat: {
    // Local tile proxy — backend fetches from CARTO and caches tiles on disk.
    // Falls back gracefully (502) when the upstream is unreachable.
    url: '/tiles/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  globe: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 19,
  },
};

interface MapViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  eventClusters?: MapEventCityCluster[];
  /** True when events exist before viewport clip (keeps layer visible while panning). */
  hasEventClusters?: boolean;
  /** Masque salons, lives, personnes et capitales — ne laisse que les pins événement. */
  eventsOnly?: boolean;
  /** Au zoom ville, afficher tous les salons (filtre Salon sans Lives). */
  showAllSalonsAtCityZoom?: boolean;
  center: [number, number];
  /** Incrémenté uniquement sur recentrage explicite — évite flyTo après pan utilisateur. */
  recenterToken?: number;
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
  onSelectEventCluster?: (cluster: MapEventCityCluster) => void;
  onSelectLiveCluster?: (cluster: import('../lib/mapLiveClusters').MapLiveLocationCluster) => void;
  /** Clic sur le fond de carte (pas un marqueur) — Leaflet n'émet pas click après un drag. */
  onMapBackgroundClick?: () => void;
  /** Style du fond de carte : 'flat' = carte sombre (défaut), 'globe' = satellite. */
  mapStyle?: MapStyle;
  /**
   * Appelé par GlobeView après l'animation de zoom sur un marqueur ou lors
   * d'un zoom manuel sous le seuil d'altitude. `zoom` est le niveau Leaflet cible.
   */
  onGlobeZoomToFlat?: (
    lat: number,
    lng: number,
    doSelect: () => void,
    zoom?: number,
    radiusKm?: number,
    animated?: boolean
  ) => void;
  /** Appelé quand le zoom descend à ≤ 2 sur la carte plate → bascule automatiquement vers le globe. */
  onAutoSwitchToGlobe?: () => void;
  /** WebGL indisponible ou échec du globe 3D — repasser en carte plate. */
  onGlobeUnavailable?: () => void;
  /** Zoom / altitude / bounds pour le panneau latéral (filtres carte). */
  onMapDetailStateChange?: (state: MapViewDetailState) => void;
  /** POV globe (centre visible + altitude) — rechargement nearby. */
  onGlobePovChange?: (lat: number, lng: number, altitude: number) => void;
  /** Pré-charge tuiles carte plate pendant zoom globe. */
  onPrepareFlatMap?: (lat: number, lng: number, zoom?: number, radiusKm?: number) => void;
  /** Centre viewport carte plate après pan/zoom utilisateur (sans recentrage). */
  onFlatMapViewportCenter?: (lat: number, lng: number) => void;
  /** L'utilisateur a commencé à déplacer la carte plate. */
  onMapExplored?: () => void;
  /** Filtre Lives actif — marqueurs live (points simplifiés en vue globale). */
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
  eventsFilterOn?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Retourne des coords toujours valides — jamais NaN. */
function safeCenter(center: [number, number]): [number, number] {
  return isValidLatLng(center[0], center[1])
    ? [center[0], center[1]]
    : [...DEFAULT_CENTER];
}

export const MapView = memo(forwardRef<MapViewHandle, MapViewProps>(function MapView({
  salons,
  lives,
  people = [],
  eventClusters = [],
  hasEventClusters,
  eventsOnly = false,
  showAllSalonsAtCityZoom = false,
  center,
  recenterToken = 0,
  userPosition,
  onSelectSalon,
  onSelectLive,
  onSelectPerson,
  onSelectEventCluster,
  onSelectLiveCluster,
  onMapBackgroundClick,
  mapStyle = 'flat',
  onGlobeZoomToFlat,
  onAutoSwitchToGlobe,
  onGlobeUnavailable,
  onMapDetailStateChange,
  onGlobePovChange,
  onPrepareFlatMap,
  onFlatMapViewportCenter,
  onMapExplored,
  livesFilterOn = false,
  salonFilterOn = false,
  eventsFilterOn = false,
}: MapViewProps, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  // Separate layer for salons + lives (always visible, small count).
  const salonLiveLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  // Cluster group for person markers.
  const personClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const capitalsLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Crossfade: flatReveal 0 = globe only, 1 = flat map fully visible
  const [showGlobe, setShowGlobe] = useState(mapStyle === 'globe');
  const [flatReveal, setFlatReveal] = useState(mapStyle !== 'globe' ? 1 : 0);
  const [flatMapZoom, setFlatMapZoom] = useState(14);
  const [globeAltitude, setGlobeAltitude] = useState(1.0);
  const globeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossfadeRafRef = useRef<number | null>(null);
  const skipCenterFlyRef = useRef(false);
  const onMapDetailStateChangeRef = useRef(onMapDetailStateChange);
  onMapDetailStateChangeRef.current = onMapDetailStateChange;

  // Stable refs for callbacks — prevents markers useEffect from re-running on every parent render.
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  onMapBackgroundClickRef.current = onMapBackgroundClick;
  const onSelectSalonRef = useRef(onSelectSalon);
  onSelectSalonRef.current = onSelectSalon;
  const onSelectLiveRef = useRef(onSelectLive);
  onSelectLiveRef.current = onSelectLive;
  const onSelectPersonRef = useRef(onSelectPerson);
  onSelectPersonRef.current = onSelectPerson;
  const onSelectEventClusterRef = useRef(onSelectEventCluster);
  onSelectEventClusterRef.current = onSelectEventCluster;
  const onAutoSwitchToGlobeRef = useRef(onAutoSwitchToGlobe);
  onAutoSwitchToGlobeRef.current = onAutoSwitchToGlobe;
  const onGlobeUnavailableRef = useRef(onGlobeUnavailable);
  onGlobeUnavailableRef.current = onGlobeUnavailable;
  const webglSupportedRef = useRef(canUseGlobeView());
  // Track current mapStyle in a ref so the zoomend handler (created once) can read it.
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  const flatMapZoomRef = useRef(flatMapZoom);
  flatMapZoomRef.current = flatMapZoom;
  const globeAltitudeRef = useRef(globeAltitude);
  globeAltitudeRef.current = globeAltitude;
  const lastGlobeTierRef = useRef(getGlobeDetailTier(globeAltitude));
  const lastFlatZoomRef = useRef(14);
  const detailEmitRafRef = useRef<number | null>(null);
  const salonLivePeopleKeyRef = useRef<string | null>(null);
  const eventClusterKeyRef = useRef<string | null>(null);
  const lastRecenterTokenRef = useRef(recenterToken);
  const onFlatMapViewportCenterRef = useRef(onFlatMapViewportCenter);
  onFlatMapViewportCenterRef.current = onFlatMapViewportCenter;
  const onMapExploredRef = useRef(onMapExplored);
  onMapExploredRef.current = onMapExplored;
  const userMapPanRef = useRef(false);

  const flatDetailTier = useMemo(() => getFlatMapDetailTier(flatMapZoom), [flatMapZoom]);
  const eventClustersActive = hasEventClusters ?? eventClusters.length > 0;
  const markerVisibility = useMemo(
    () =>
      getMapMarkerVisibility({
        tier: flatDetailTier,
        eventsOnly,
        hasEventClusters: eventClustersActive,
        showAllSalonsAtCityZoom,
        livesFilterOn,
        salonFilterOn,
        eventsFilterOn,
      }),
    [
      flatDetailTier,
      eventsOnly,
      eventClustersActive,
      showAllSalonsAtCityZoom,
      livesFilterOn,
      salonFilterOn,
      eventsFilterOn,
    ]
  );

  const visibleSalons = useMemo(
    () => filterSalonsForZoom(salons, markerVisibility, showAllSalonsAtCityZoom, flatDetailTier),
    [salons, markerVisibility, showAllSalonsAtCityZoom, flatDetailTier]
  );
  const visibleLives = useMemo(
    () => (markerVisibility.lives ? lives : []),
    [lives, markerVisibility.lives]
  );
  const visiblePeople = useMemo(
    () => filterPeopleForZoom(people, markerVisibility, flatDetailTier),
    [people, markerVisibility, flatDetailTier]
  );
  const visibleEventClusters = useMemo(
    () => (markerVisibility.eventClusters ? eventClusters : []),
    [eventClusters, markerVisibility.eventClusters]
  );

  /**
   * Stable data refs for marker effects.
   *
   * Problem: with a filter active, `mapSalonsForView` in HomePage creates a new
   * array reference on every debounced bounds update (250 ms while panning).
   * This propagates through the useMemo chain:
   *   mapSalonsForView → salons prop → visibleSalons useMemo → salonLivePeopleKey useMemo
   *
   * Even though `salonLivePeopleKey` ends up as the same string value, the
   * `visibleSalons` dep change makes React re-run the marker effect, which then
   * exits early after the key check — wasted work, especially at 60 fps.
   *
   * Solution: read these arrays from refs inside the effects and remove them
   * from the dependency arrays.  The effects are still correctly triggered by
   * `salonLivePeopleKey` / `eventClusterKey`, which encode all meaningful
   * content changes.  Refs are updated synchronously during render, so by the
   * time an effect runs they already hold the current-render values.
   */
  const markerVisibilityRef = useRef(markerVisibility);
  markerVisibilityRef.current = markerVisibility;
  const visibleSalonsRef = useRef(visibleSalons);
  visibleSalonsRef.current = visibleSalons;
  const visibleLivesRef = useRef(visibleLives);
  visibleLivesRef.current = visibleLives;
  const visiblePeopleRef = useRef(visiblePeople);
  visiblePeopleRef.current = visiblePeople;
  const visibleEventClustersRef = useRef(visibleEventClusters);
  visibleEventClustersRef.current = visibleEventClusters;

  const readFlatMapBounds = useCallback((): MapBounds | null => {
    if (!mapInstance.current) return null;
    try {
      const b = mapInstance.current.getBounds();
      return {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      };
    } catch {
      return null;
    }
  }, []);

  const emitMapDetailState = useCallback(() => {
    const cb = onMapDetailStateChangeRef.current;
    if (!cb) return;
    if (mapStyleRef.current === 'globe') {
      const alt = globeAltitudeRef.current;
      cb({
        tier: getGlobeDetailTier(alt),
        flatZoom: flatMapZoomRef.current,
        globeAltitude: alt,
        bounds: null,
        mapStyle: 'globe',
      });
      return;
    }
    const zoom = flatMapZoomRef.current;
    cb({
      tier: getFlatMapDetailTier(zoom),
      flatZoom: zoom,
      globeAltitude: null,
      bounds: readFlatMapBounds(),
      mapStyle: 'flat',
    });
  }, [readFlatMapBounds]);

  const emitMapDetailStateFnRef = useRef(emitMapDetailState);
  emitMapDetailStateFnRef.current = emitMapDetailState;

  /** Force le chargement tuiles à la vue courante (carte cachée sous le globe). */
  const refreshFlatTileLayer = useCallback(() => {
    const map = mapInstance.current;
    const layer = tileLayerRef.current;
    if (!map || !layer) return;
    try {
      layer.redraw();
      map.once('moveend', () => {
        try {
          layer.redraw();
        } catch {
          /* layer may be removed */
        }
      });
    } catch {
      /* map may not be ready */
    }
  }, []);

  const scheduleDetailEmit = useCallback(() => {
    if (detailEmitRafRef.current !== null) return;
    detailEmitRafRef.current = requestAnimationFrame(() => {
      detailEmitRafRef.current = null;
      emitMapDetailStateFnRef.current();
    });
  }, []);

  /** GlobeView n'émet l'altitude qu'au changement de tier — évite re-renders MapView/HomePage. */
  const handleGlobeAltitudeChange = useCallback((altitude: number) => {
    const tier = getGlobeDetailTier(altitude);
    if (tier === lastGlobeTierRef.current) return;
    lastGlobeTierRef.current = tier;
    setGlobeAltitude(altitude);
  }, []);

  const requestGlobeFallback = useCallback(() => {
    webglSupportedRef.current = false;
    setShowGlobe(false);
    setFlatReveal(1);
    onGlobeUnavailableRef.current?.();
  }, []);

  useEffect(() => {
    scheduleDetailEmit();
  }, [flatMapZoom, globeAltitude, mapStyle, scheduleDetailEmit]);

  useImperativeHandle(ref, () => ({
    prepareFlatAt(lat: number, lng: number, zoom = 14, radiusKm?: number) {
      if (!mapInstance.current || !isValidLatLng(lat, lng)) return;
      skipCenterFlyRef.current = true;
      try {
        if (radiusKm != null && radiusKm > 0) {
          const bounds = L.circle(sanitizeLatLngTuple(lat, lng), { radius: radiusKm * 1000 }).getBounds();
          mapInstance.current.fitBounds(bounds, { animate: false, padding: [48, 48], maxZoom: 14 });
        } else {
          mapInstance.current.setView(sanitizeLatLngTuple(lat, lng), zoom, { animate: false });
        }
        mapInstance.current.invalidateSize();
        refreshFlatTileLayer();
      } catch {
        // Map may not be ready
      }
    },
    jumpTo(lat: number, lng: number, zoom = 14) {
      if (!mapInstance.current || !isValidLatLng(lat, lng)) return;
      skipCenterFlyRef.current = true;
      try {
        mapInstance.current.setView(sanitizeLatLngTuple(lat, lng), zoom, { animate: false });
        refreshFlatTileLayer();
      } catch {
        // Map may not be ready
      }
    },
    flyTo(lat: number, lng: number, zoom = 13) {
      if (!mapInstance.current || !isValidLatLng(lat, lng)) return;
      skipCenterFlyRef.current = true;
      try {
        mapInstance.current.flyTo(sanitizeLatLngTuple(lat, lng), zoom, {
          duration: MAP_CROSSFADE_MS / 1000,
        });
      } catch {
        // Map may not be ready
      }
    },
    jumpToCityBounds(lat: number, lng: number, radiusKm: number) {
      if (!mapInstance.current || !isValidLatLng(lat, lng) || radiusKm <= 0) return;
      skipCenterFlyRef.current = true;
      try {
        const bounds = L.circle(sanitizeLatLngTuple(lat, lng), { radius: radiusKm * 1000 }).getBounds();
        mapInstance.current.fitBounds(bounds, { animate: false, padding: [48, 48], maxZoom: 14 });
        refreshFlatTileLayer();
      } catch {
        // Map may not be ready
      }
    },
    flyToCityBounds(lat: number, lng: number, radiusKm: number, opts?: { durationSec?: number }) {
      if (!mapInstance.current || !isValidLatLng(lat, lng) || radiusKm <= 0) return;
      skipCenterFlyRef.current = true;
      const duration = opts?.durationSec ?? MAP_CITY_FLY_DURATION_S;
      try {
        const bounds = L.circle(sanitizeLatLngTuple(lat, lng), { radius: radiusKm * 1000 }).getBounds();
        mapInstance.current.flyToBounds(bounds, {
          padding: [48, 48],
          duration,
          maxZoom: 14,
        });
      } catch {
        // Map may not be ready
      }
    },
  }), [refreshFlatTileLayer]);

  // Skip globe when WebGL is unavailable (GPU off, context limit, low power mode, etc.)
  useEffect(() => {
    if (mapStyle === 'globe' && !webglSupportedRef.current) {
      requestGlobeFallback();
    }
  }, [mapStyle, requestGlobeFallback]);

  // ── Globe ↔ flat crossfade ────────────────────────────────────────────────
  // Globe→flat: warm Carto tiles (kept mounted under opacity 0), then crossfade
  // globe out while flat fades in (MAP_CROSSFADE_MS). Unmount globe after fade.
  // Flat→globe: show globe immediately, fade flat out.
  useEffect(() => {
    if (globeTimerRef.current !== null) {
      clearTimeout(globeTimerRef.current);
      globeTimerRef.current = null;
    }
    if (crossfadeRafRef.current !== null) {
      cancelAnimationFrame(crossfadeRafRef.current);
      crossfadeRafRef.current = null;
    }

    if (mapStyle === 'globe' && webglSupportedRef.current) {
      setShowGlobe(true);
      setFlatReveal(0);
      return;
    }

    if (mapStyle === 'globe' && !webglSupportedRef.current) {
      setShowGlobe(false);
      setFlatReveal(1);
      return;
    }

    // Switching to flat — keep globe mounted during crossfade
    setShowGlobe(true);
    setFlatReveal(0);

    // Ensure zoom ≥ 3 so zoomend doesn't immediately re-trigger globe.
    if (mapInstance.current) {
      try {
        if (mapInstance.current.getZoom() < 3) {
          mapInstance.current.setZoom(3, { animate: false });
        }
        mapInstance.current.invalidateSize();
      } catch { /* map may not be ready */ }
    }

    let cancelled = false;

    const startCrossfade = () => {
      if (cancelled) return;
      crossfadeRafRef.current = requestAnimationFrame(() => {
        crossfadeRafRef.current = null;
        if (!cancelled) setFlatReveal(1);
      });
      globeTimerRef.current = setTimeout(() => {
        if (!cancelled) setShowGlobe(false);
        globeTimerRef.current = null;
      }, MAP_CROSSFADE_MS + 40);
    };

    const warmupTiles = () => {
      const layer = tileLayerRef.current;
      if (!layer) {
        startCrossfade();
        return;
      }

      refreshFlatTileLayer();

      let done = false;
      const finish = () => {
        if (done || cancelled) return;
        done = true;
        layer.off('tileload', onTileLoad);
        layer.off('load', onLayerLoad);
        clearTimeout(minTimer);
        clearTimeout(maxTimer);
        startCrossfade();
      };

      const onTileLoad = () => finish();
      const onLayerLoad = () => finish();

      layer.on('tileload', onTileLoad);
      layer.once('load', onLayerLoad);

      const minTimer = setTimeout(finish, TILE_WARMUP_MIN_MS);
      const maxTimer = setTimeout(finish, TILE_WARMUP_MAX_MS);
    };

    warmupTiles();

    return () => {
      cancelled = true;
      if (globeTimerRef.current !== null) {
        clearTimeout(globeTimerRef.current);
        globeTimerRef.current = null;
      }
      if (crossfadeRafRef.current !== null) {
        cancelAnimationFrame(crossfadeRafRef.current);
        crossfadeRafRef.current = null;
      }
    };
  }, [mapStyle]);

  // ── Map initialisation (runs once) ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Expose L as window.L so leaflet.markercluster's UMD factory can find it
    // in bundled environments where the module scope has no implicit global.
    const win = window as Window & { L?: typeof L };
    if (!win.L) win.L = L;

    const initial = safeCenter(center);

    const MAP_INIT_OPTIONS: L.MapOptions = {
      zoomControl: false,
      attributionControl: true,
      // Prefer canvas renderer: faster for large marker counts.
      preferCanvas: true,
      // Required by leaflet.markercluster (spiderfyOnMaxZoom) — prevents
      // "Map has no maxZoom specified" crash when clusters are initialised.
      maxZoom: 19,
      // Zoom 2 is the minimum; reaching it triggers auto-switch to globe.
      minZoom: 2,
      // Prevent the world from repeating left/right when zoomed out.
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1,
    };

    let map: L.Map;
    try {
      map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView(initial, 14);
    } catch (err) {
      console.error('[MapView] Leaflet init error:', err);
      try {
        map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView([...DEFAULT_CENTER], 14);
      } catch {
        return;
      }
    }

    map.attributionControl?.setPrefix(false);
    mapInstance.current = map;

    // Salon / live markers — regular group (counts stay low).
    salonLiveLayerRef.current = L.layerGroup().addTo(map);
    eventsLayerRef.current = L.layerGroup().addTo(map);

    // Person markers — cluster group to avoid rendering 10 000 divIcons.
    // A try/catch protects against any runtime environment where the
    // leaflet.markercluster UMD failed to extend L (e.g., stale SW cache).
    let cluster: L.MarkerClusterGroup;
    try {
      cluster = L.markerClusterGroup({
        maxClusterRadius: 55,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        iconCreateFunction: (c: L.MarkerCluster) => {
          const count = c.getChildCount();
          const size = count >= 100 ? 44 : count >= 20 ? 38 : 32;
          return L.divIcon({
            html: `<div class="map-cluster-icon" style="width:${size}px;height:${size}px">${count}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
    } catch (clusterErr) {
      console.warn('[MapView] markerClusterGroup unavailable, falling back to LayerGroup:', clusterErr);
      cluster = L.layerGroup() as unknown as L.MarkerClusterGroup;
    }
    personClusterRef.current = cluster;
    cluster.addTo(map);

    capitalsLayerRef.current = L.layerGroup().addTo(map);

    // Flat Carto tiles always mounted (hidden via container opacity in globe mode)
    // so they can warm up before the crossfade reveals the flat map.
    const flatCfg = TILE_LAYERS.flat;
    const touchCoarse = isTouchCoarseViewport();
    tileLayerRef.current = L.tileLayer(flatCfg.url, {
      attribution: flatCfg.attribution,
      maxZoom: flatCfg.maxZoom,
      noWrap: true,
      // Mobile Safari : charger les tuiles pendant le pan (updateWhenIdle laisse la carte grise).
      updateWhenIdle: !touchCoarse,
      updateWhenZooming: touchCoarse,
      keepBuffer: touchCoarse ? 4 : 3,
      crossOrigin: touchCoarse,
    }).addTo(map);

    const onMapClick = () => onMapBackgroundClickRef.current?.();
    map.on('click', onMapClick);

    // Auto-switch to globe when the user zooms out to the minimum (zoom ≤ 2).
    // Guard on mapStyleRef to avoid re-triggering when we're already on globe.
    const onViewChange = () => {
      const zoom = map.getZoom();
      flatMapZoomRef.current = zoom;
      if (zoom !== lastFlatZoomRef.current) {
        lastFlatZoomRef.current = zoom;
        setFlatMapZoom((prev) => (shouldCommitFlatMapZoom(prev, zoom) ? zoom : prev));
      }
      scheduleDetailEmit();
      if (zoom <= 2 && mapStyleRef.current === 'flat' && webglSupportedRef.current) {
        onAutoSwitchToGlobeRef.current?.();
      }
    };
    const onMapMoveEnd = () => {
      onViewChange();
      if (skipCenterFlyRef.current) return;
      try {
        const c = map.getCenter();
        if (!isValidLatLng(c.lat, c.lng)) return;
        userMapPanRef.current = true;
        onMapExploredRef.current?.();
        onFlatMapViewportCenterRef.current?.(c.lat, c.lng);
      } catch {
        /* map may not be ready */
      }
    };
    map.on('zoomend', onViewChange);
    map.on('moveend', onMapMoveEnd);
    lastFlatZoomRef.current = map.getZoom();
    setFlatMapZoom(map.getZoom());

    const rafId = requestAnimationFrame(() => map.invalidateSize());
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      if (detailEmitRafRef.current !== null) {
        cancelAnimationFrame(detailEmitRafRef.current);
        detailEmitRafRef.current = null;
      }
      ro.disconnect();
      map.off('click', onMapClick);
      map.off('zoomend', onViewChange);
      map.off('moveend', onMapMoveEnd);
      map.remove();
      mapInstance.current = null;
      salonLiveLayerRef.current = null;
      eventsLayerRef.current = null;
      personClusterRef.current = null;
      capitalsLayerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // iOS Safari : recalcule taille + tuiles au retour onglet (carte grise / globe figé).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const map = mapInstance.current;
      if (!map) return;
      try {
        map.invalidateSize();
        tileLayerRef.current?.redraw();
      } catch {
        /* map may not be ready */
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── Fly to center on explicit recenter only (not after user pan) ─────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (!isValidLatLng(center[0], center[1])) return;
    if (recenterToken === lastRecenterTokenRef.current && userMapPanRef.current) return;
    lastRecenterTokenRef.current = recenterToken;
    if (skipCenterFlyRef.current) {
      skipCenterFlyRef.current = false;
      return;
    }
    userMapPanRef.current = false;
    try {
      const zoom = map.getZoom();
      map.flyTo(sanitizeLatLngTuple(center[0], center[1]), zoom, { duration: 0.6 });
    } catch (err) {
      console.error('[MapView] flyTo error:', err);
    }
  }, [recenterToken, center]);

  // ── User position marker (bonhomme bleu) ────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!userPosition || !isValidLatLng(userPosition[0], userPosition[1])) {
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.remove();
        } catch {
          /* map may be torn down */
        }
        userMarkerRef.current = null;
      }
      return;
    }
    const safe = sanitizeLatLngTuple(userPosition[0], userPosition[1]);
    try {
      if (!userMarkerRef.current) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div class="map-user-position">
            <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13" cy="7" r="5.5" fill="#60a5fa"/>
              <path d="M8 14 Q13 11.5 18 14 L17 23 H9 Z" fill="#60a5fa"/>
              <line x1="9" y1="15.5" x2="3.5" y2="21.5" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="17" y1="15.5" x2="22.5" y2="21.5" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="11" y1="23" x2="8.5" y2="31" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="15" y1="23" x2="17.5" y2="31" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <div class="map-user-dot"></div>
          </div>`,
          iconSize: [26, 44],
          iconAnchor: [13, 42],
        });
        userMarkerRef.current = L.marker(safe, { icon: userIcon, zIndexOffset: 1000 })
          .addTo(mapInstance.current);
      } else {
        userMarkerRef.current.setLatLng(safe);
      }
    } catch (err) {
      console.error('[MapView] userMarker error:', err);
    }
  }, [userPosition]);

  const showCapitalLabels = flatMapZoom >= CAPITAL_LABEL_MIN_ZOOM;

  // ── World capital markers (flat map) — built once per visibility gate ─────
  const capitalsBuiltRef = useRef(false);
  const capitalsLabelsPermanentRef = useRef(false);

  useEffect(() => {
    const layer = capitalsLayerRef.current;
    if (!layer) return;

    const shouldShow =
      mapStyle === 'flat' && flatReveal >= 1 && markerVisibility.capitals;

    if (!shouldShow) {
      layer.clearLayers();
      capitalsBuiltRef.current = false;
      return;
    }

    const showLabels = showCapitalLabels;
    if (capitalsBuiltRef.current && capitalsLabelsPermanentRef.current === showLabels) {
      return;
    }

    if (!capitalsBuiltRef.current) {
      layer.clearLayers();
      for (const cap of WORLD_CAPITALS) {
        if (!isValidLatLng(cap.lat, cap.lng)) continue;
        try {
          const marker = L.circleMarker([cap.lat, cap.lng], {
            radius: 3,
            color: 'rgba(190, 190, 255, 0.95)',
            fillColor: 'rgba(170, 170, 255, 0.8)',
            fillOpacity: 0.85,
            weight: 1,
            interactive: false,
          });
          marker.bindTooltip(
            `<span class="map-capital-label">${escapeHtml(cap.name)}</span>`,
            {
              permanent: showLabels,
              direction: 'top',
              offset: [0, -4],
              className: 'map-capital-tooltip',
            }
          );
          marker.addTo(layer);
        } catch (err) {
          console.error('[MapView] capital marker error:', err);
        }
      }
      capitalsBuiltRef.current = true;
      capitalsLabelsPermanentRef.current = showLabels;
      return;
    }

    // Toggle label visibility without rebuilding ~200 markers.
    capitalsLabelsPermanentRef.current = showLabels;
    layer.eachLayer((marker) => {
      const tooltip = (marker as L.Marker).getTooltip?.();
      if (!tooltip) return;
      if (showLabels) tooltip.options.permanent = true;
      else {
        tooltip.options.permanent = false;
        tooltip.close();
      }
      tooltip.update();
    });
  }, [mapStyle, flatReveal, showCapitalLabels, markerVisibility.capitals]);

  const salonLivePeopleKey = useMemo(
    () =>
      `${markerVisibility.density}:${buildSalonLivePeopleKey(visibleSalons, visibleLives, visiblePeople)}`,
    [markerVisibility.density, visibleSalons, visibleLives, visiblePeople]
  );
  const eventClusterKey = useMemo(
    () => buildEventClusterKey(visibleEventClusters, flatDetailTier),
    [visibleEventClusters, flatDetailTier]
  );

  // ── Marker update (salons, lives, people) ────────────────────────────────
  // IMPORTANT: callbacks (onSelectSalon, onSelectLive, onSelectPerson) are
  // accessed via stable refs so they are NOT listed as deps.  Without this,
  // every parent re-render would recreate 10 000+ markers because the parent
  // passes fresh arrow functions on every render.
  //
  // The arrays visibleSalons / visibleLives / visiblePeople are also read via
  // stable refs and removed from the dep array.  With a filter active, their
  // array *references* change on every 250 ms bounds update even when the
  // actual content is unchanged, which would otherwise cause this effect to
  // run and clear+rebuild all Leaflet DOM nodes unnecessarily.
  // The salonLivePeopleKey string encodes every field that matters for visual
  // output, so it is the single correct dep for triggering a rebuild.
  useEffect(() => {
    const salonLayer = salonLiveLayerRef.current;
    const personCluster = personClusterRef.current;
    if (!salonLayer || !personCluster) return;

    if (
      salonLivePeopleKeyRef.current !== null &&
      salonLivePeopleKey === salonLivePeopleKeyRef.current
    ) {
      return;
    }
    salonLivePeopleKeyRef.current = salonLivePeopleKey;

    // Read current data from refs — always up-to-date by render time.
    const visibleSalons = visibleSalonsRef.current;
    const visibleLives = visibleLivesRef.current;
    const visiblePeople = visiblePeopleRef.current;
    const markerVisibility = markerVisibilityRef.current;
    const overviewDots = markerVisibility.density === 'overview';

    // ── Salons ──
    salonLayer.clearLayers();

    visibleSalons.forEach((s) => {
      if (!isValidLatLng(s.latitude, s.longitude)) return;
      const botClass = s.isBot ? 'bot' : '';
      const liveClass = s.isLive ? 'live' : '';
      try {
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = overviewDots
          ? L.circleMarker([lat, lon], {
              radius: s.isLive ? 7 : 6,
              color: s.isLive ? '#f87171' : '#c084fc',
              fillColor: s.isLive ? '#f87171' : '#c084fc',
              fillOpacity: 0.9,
              weight: 2,
            })
          : L.marker(
              [lat, lon],
              {
                icon: L.divIcon({
                  className: '',
                  html: `<div class="map-marker ${botClass} ${liveClass}">${s.isBot ? '<span class="bot-badge">BOT</span>' : ''}${s.isLive ? '<span class="live-badge">LIVE</span>' : ''}<img src="${escapeHtml(s.playbackState.albumArtUrl || '')}" alt=""/>${usernameMapLabelHtml(s.hostName, s.hostUsernameColor, { wave: { from: s.hostUsernameWaveFrom, to: s.hostUsernameWaveTo } })}</div>`,
                  iconSize: [56, 56],
                  iconAnchor: [28, 28],
                }),
              }
            );
        m.addTo(salonLayer);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectSalonRef.current(s);
        });
      } catch (err) {
        console.error('[MapView] salon marker error:', err);
      }
    });

    visibleLives.forEach((l) => {
      if (!isValidLatLng(l.latitude, l.longitude)) return;
      if (visibleSalons.some((s) => s.id === l.id)) return;
      try {
        const lat = Number(l.latitude);
        const lon = Number(l.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = overviewDots
          ? L.circleMarker([lat, lon], {
              radius: 7,
              color: '#f87171',
              fillColor: '#f87171',
              fillOpacity: 0.9,
              weight: 2,
            })
          : L.marker(
              [lat, lon],
              {
                icon: L.divIcon({
                  className: '',
                  html: `<div class="map-marker live"><span class="live-badge">LIVE</span><img src="${escapeHtml(l.playbackState.albumArtUrl || '')}" alt=""/>${usernameMapLabelHtml(l.hostName, l.hostUsernameColor, { wave: { from: l.hostUsernameWaveFrom, to: l.hostUsernameWaveTo } })}</div>`,
                  iconSize: [56, 56],
                  iconAnchor: [28, 28],
                }),
              }
            );
        m.addTo(salonLayer);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectLiveRef.current(l);
        });
      } catch (err) {
        console.error('[MapView] live marker error:', err);
      }
    });

    // ── People (clustered at city/street ; lightweight dots at overview) ──
    personCluster.clearLayers();

    if (overviewDots) {
      visiblePeople
        .filter((p) => isValidLatLng(p.latitude, p.longitude))
        .forEach((p) => {
          try {
            const lat = Number(p.latitude);
            const lon = Number(p.longitude);
            if (!isValidLatLng(lat, lon)) return;
            const m = L.circleMarker([lat, lon], {
              radius: 6,
              color: '#f87171',
              fillColor: '#f87171',
              fillOpacity: 0.85,
              weight: 2,
            }).addTo(salonLayer);
            m.on('click', (ev) => {
              L.DomEvent.stopPropagation(ev.originalEvent);
              onSelectPersonRef.current?.(p);
            });
          } catch (err) {
            console.error('[MapView] person overview marker error:', err);
          }
        });
      return;
    }

    const sortedPeople = visiblePeople
      .filter((p) => isValidLatLng(p.latitude, p.longitude))
      .sort((a, b) => {
        const scoreA = (a.isLive ? 2 : 0) + (a.salonId ? 1 : 0);
        const scoreB = (b.isLive ? 2 : 0) + (b.salonId ? 1 : 0);
        return scoreB - scoreA;
      });

    const batchMarkers: L.Marker[] = [];

    sortedPeople.forEach((p) => {
      const avatar = p.avatarUrl?.trim() || dicebearAdventurerAvatar(p.id);
      const avatarFallback = dicebearAdventurerAvatar(p.id);
      const avatarOnError = `this.onerror=null;this.src='${avatarFallback.replace(/'/g, '%27')}';`;
      const botClass = p.isBot ? 'bot' : '';
      const liveClass = p.isLive ? 'live' : '';
      const liveBadge = p.isLive ? '<span class="live-badge">LIVE</span>' : '';
      const viewersLabel =
        p.isLive && p.liveViewersCount != null
          ? `<span class="viewer-count">${escapeHtml(formatCompactCount(p.liveViewersCount))}</span>`
          : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker person ${botClass} ${liveClass}"><div class="map-marker-person-top">${viewersLabel}<div class="person-avatar-stack">${liveBadge}<img src="${escapeHtml(avatar)}" alt="" onerror="${avatarOnError}"/></div></div>${usernameMapLabelHtml(p.username, p.usernameColor, { wave: { from: p.usernameWaveFrom, to: p.usernameWaveTo } })}</div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      try {
        const lat = Number(p.latitude);
        const lon = Number(p.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = L.marker([lat, lon], { icon });
        if (p.isLive && p.liveId) {
          m.bindPopup(
            (() => {
              const { className, style } = getUsernameStyle(p.usernameColor, {
                from: p.usernameWaveFrom,
                to: p.usernameWaveTo,
              });
              const styleAttr = style ? ` style="${style}"` : '';
              return `<div class="map-person-popup"><strong class="${className}"${styleAttr}>${escapeHtml(p.username)}</strong><br/><span class="live-badge">LIVE</span></div>`;
            })()
          );
        }
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectPersonRef.current?.(p);
        });
        batchMarkers.push(m);
      } catch (err) {
        console.error('[MapView] person marker error:', err);
      }
    });

    // Add all person markers in one batch call for performance.
    if (batchMarkers.length > 0) {
      personCluster.addLayers(batchMarkers);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonLivePeopleKey]); // data arrays read via stable refs; callbacks via stable refs

  // ── Event markers (location pins) ───────────────────────────────────────
  useEffect(() => {
    const layer = eventsLayerRef.current;
    if (!layer) return;

    if (
      eventClusterKeyRef.current !== null &&
      eventClusterKey === eventClusterKeyRef.current
    ) {
      return;
    }
    eventClusterKeyRef.current = eventClusterKey;

    // Read visibleEventClusters from ref — same rationale as the salon effect above.
    const visibleEventClusters = visibleEventClustersRef.current;

    layer.clearLayers();

    const showIndividualEvents = flatDetailTier !== 'overview';

    const addClusterMarker = (cluster: MapEventCityCluster) => {
      if (!isValidLatLng(cluster.latitude, cluster.longitude)) return;
      const cityLabel = cluster.cityLabel.trim() || 'Ville';
      const shortLabel = cityLabel.length > 22 ? `${cityLabel.slice(0, 20)}…` : cityLabel;
      const countBadge =
        cluster.count > 1
          ? `<span class="event-cluster-badge">${escapeHtml(String(cluster.count))}</span>`
          : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker event"><span class="event-marker-icon" aria-hidden="true">📍</span>${countBadge}<span class="map-marker-label">${escapeHtml(shortLabel)}</span></div>`,
        iconSize: [48, 52],
        iconAnchor: [24, 26],
      });
      const lat = Number(cluster.latitude);
      const lon = Number(cluster.longitude);
      if (!isValidLatLng(lat, lon)) return;
      const m = L.marker([lat, lon], { icon, zIndexOffset: 200 }).addTo(layer);
      const tooltipParts = [escapeHtml(cityLabel)];
      if (cluster.count > 1) {
        tooltipParts.push(`${cluster.count} événements`);
      } else if (cluster.events[0]) {
        const ev = cluster.events[0];
        if (ev.title) tooltipParts.push(escapeHtml(ev.title.trim() || 'Événement'));
        if (ev.eventDate) tooltipParts.push(escapeHtml(formatEventDateShort(ev.eventDate)));
      }
      m.bindTooltip(tooltipParts.join('<br/>'), {
        direction: 'top',
        offset: [0, -8],
        className: 'map-event-tooltip',
      });
      m.on('click', (clickEv) => {
        L.DomEvent.stopPropagation(clickEv.originalEvent);
        onSelectEventClusterRef.current?.(cluster);
      });
    };

    const addIndividualEventMarker = (cluster: MapEventCityCluster, ev: MapEventMarker) => {
      const lat = Number(ev.latitude);
      const lon = Number(ev.longitude);
      if (!isValidLatLng(lat, lon)) return;
      const title = ev.title.trim() || 'Événement';
      const shortTitle = title.length > 22 ? `${title.slice(0, 20)}…` : title;
      const markerIcon = getEventTypeIcon(ev.eventType);
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker event"><span class="event-marker-icon" aria-hidden="true">${markerIcon}</span><span class="map-marker-label">${escapeHtml(shortTitle)}</span></div>`,
        iconSize: [48, 52],
        iconAnchor: [24, 26],
      });
      const m = L.marker([lat, lon], { icon, zIndexOffset: 200 }).addTo(layer);
      const tooltipParts = [escapeHtml(title)];
      if (ev.eventDate) tooltipParts.push(escapeHtml(formatEventDateShort(ev.eventDate)));
      if (ev.eventLocation) tooltipParts.push(escapeHtml(ev.eventLocation));
      m.bindTooltip(tooltipParts.join('<br/>'), {
        direction: 'top',
        offset: [0, -8],
        className: 'map-event-tooltip',
      });
      m.on('click', (clickEv) => {
        L.DomEvent.stopPropagation(clickEv.originalEvent);
        onSelectEventClusterRef.current?.(cluster);
      });
    };

    try {
      if (showIndividualEvents) {
        visibleEventClusters.forEach((cluster) => {
          cluster.events.forEach((ev) => addIndividualEventMarker(cluster, ev));
        });
      } else {
        visibleEventClusters.forEach((cluster) => addClusterMarker(cluster));
      }
    } catch (err) {
      console.error('[MapView] event marker error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventClusterKey, flatDetailTier]); // visibleEventClusters read via stable ref

  return (
    <div className="absolute inset-0 z-0">
      {/* Globe below Leaflet — fades out in sync during globe→flat crossfade. */}
      {showGlobe && webglSupportedRef.current && (
        <div
          className="absolute inset-0"
          style={{
            opacity: 1 - flatReveal,
            transition: `opacity ${MAP_CROSSFADE_MS}ms ease-out`,
            pointerEvents: flatReveal > 0.5 ? 'none' : undefined,
            willChange: flatReveal > 0 && flatReveal < 1 ? 'opacity' : undefined,
            transform: 'translateZ(0)',
          }}
        >
        <Suspense
          fallback={
            <div className="absolute inset-0 bg-[#060611] flex items-center justify-center">
              <span className="text-indigo-400/50 text-sm animate-pulse">
                Globe 3D en cours de chargement…
              </span>
            </div>
          }
        >
          <GlobeErrorBoundary onUnavailable={requestGlobeFallback}>
            <LazyGlobeView
              salons={salons}
              lives={lives}
              people={people}
              eventClusters={eventClusters}
              hasEventClusters={eventClustersActive}
              eventsOnly={eventsOnly}
              showAllSalonsAtCityZoom={showAllSalonsAtCityZoom}
              center={center}
              recenterToken={recenterToken}
              userPosition={userPosition}
              onSelectSalon={onSelectSalon}
              onSelectLive={onSelectLive}
              onSelectPerson={onSelectPerson}
              onSelectEventCluster={onSelectEventCluster}
              onSelectLiveCluster={onSelectLiveCluster}
              onZoomToFlat={onGlobeZoomToFlat}
              onGlobeAltitudeChange={handleGlobeAltitudeChange}
              onGlobePovChange={onGlobePovChange}
              onPrepareFlatMap={onPrepareFlatMap}
              onMapExplored={onMapExplored}
              onGlobeUnavailable={requestGlobeFallback}
              livesFilterOn={livesFilterOn}
              salonFilterOn={salonFilterOn}
              eventsFilterOn={eventsFilterOn}
            />
          </GlobeErrorBoundary>
        </Suspense>
        </div>
      )}

      {/* Leaflet flat map — always mounted; crossfades in sync with globe fade-out. */}
      <div
        ref={mapRef}
        className="absolute inset-0"
        style={{
          opacity: flatReveal,
          transition: `opacity ${MAP_CROSSFADE_MS}ms ease-out`,
          pointerEvents: flatReveal > 0.5 ? undefined : 'none',
          willChange: flatReveal > 0 && flatReveal < 1 ? 'opacity' : undefined,
          transform: 'translateZ(0)',
        }}
        data-map-style={mapStyle}
      />
    </div>
  );
}));
