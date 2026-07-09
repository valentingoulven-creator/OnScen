import { forwardRef, lazy, memo, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefAttributes } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { GlobeViewProps, GlobeViewHandle } from './GlobeView';
import { formatCompactCount } from '../lib/formatCount';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { formatEventDateShort } from '../lib/feedEvents';
import type { Salon, Live, NearbyPerson, MapEventCityCluster, MapEventMarker } from '../types';
import { buildEventClusterKey, buildSalonLivePeopleKey } from '../lib/mapMarkersKey';
import { buildEventClusterPopupHtml } from '../lib/mapEventPopupHtml';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import { DEFAULT_CENTER } from '../lib/livesGeo';
import { WORLD_CAPITALS } from '../lib/worldCapitals';
import { getUsernameStyle, usernameMapLabelHtml } from '../lib/usernameColor';
import {
  filterPeopleForZoom,
  filterSalonsForZoom,
  getDistanceKm,
  getFlatMapDetailTier,
  getGlobeDetailTier,
  getMapMarkerVisibility,
  isInMapBounds,
  FLAT_ZOOM_CITY_MIN,
  type MapBounds,
  type MapViewDetailState,
} from '../lib/mapMarkerVisibility';
import {
  clusterSalonsLivesByMajorCity,
  filterOverviewIndividualMarkers,
  type MapMajorCityLiveCluster,
} from '../lib/mapMajorCityLiveClusters';
import {
  buildMajorCityHubMarkerHtml,
  buildOverviewGeoMarkerHtml,
} from '../lib/mapOverviewMarkerHtml';
import { canUseGlobeView } from '../lib/webglSupport';
import {
  flatZoomToNorm,
  globeAltToNorm,
  MAP_GLOBE_ALT_MAX,
  normToFlatZoom,
  normToGlobeAlt,
  type MapZoomControlSnapshot,
  type MapZoomMode,
} from '../lib/mapZoomControl';
import { isTouchCoarseViewport } from '../lib/phoneViewport';
import { GlobeErrorBoundary } from './GlobeErrorBoundary';

// Lazy-load the 3D globe (large Three.js bundle) only when needed.
const LazyGlobeView = lazy(() =>
  import('./GlobeView').then((m) => ({ default: m.GlobeView }))
) as React.LazyExoticComponent<
  React.ForwardRefExoticComponent<GlobeViewProps & RefAttributes<GlobeViewHandle>>
>;

export type MapStyle = 'flat' | 'globe';

/** Handle impératif exposé par MapView via forwardRef. */
export interface MapViewHandle {
  /** Leaflet prêt (instance initialisée). */
  isMapReady: () => boolean;
  /** Recalcule la taille du conteneur (onglet caché → visible). */
  invalidateSize: () => void;
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
  /** Slider zoom vertical — 0 dézoom, 1 zoom max. */
  setZoomControlNorm: (norm: number) => void;
  /** Pendant le drag du slider — évite les allers-retours avec molette/pinch. */
  setZoomSliderDragging: (dragging: boolean) => void;
}

/** Globe ↔ flat crossfade duration (ms) — keep in sync with CSS transition. */
const MAP_CROSSFADE_MS = 300;

/** Vol carte vers une ville (filtre événement, etc.) — plus lisible que le crossfade. */
export const MAP_CITY_FLY_DURATION_S = 1.15;

/** Min wait before crossfade (ms) — laisse le globe amorcer le zoom. */
const TILE_WARMUP_MIN_MS = 60;

/** Max wait for first Carto tiles before crossfade anyway (ms) — desktop/wifi rapide. */
const TILE_WARMUP_MAX_MS = 380;

/**
 * Max wait mobile (ms) — réseau cellulaire plus lent, latence tuiles plus élevée.
 * Sans ce délai plus généreux, le crossfade révèle la carte plate avant que les
 * tuiles aient eu le temps de charger sur 3G/4G, laissant apparaître un aperçu
 * sombre/vide (perçu comme « carte grise ») pendant quelques centaines de ms.
 */
const TILE_WARMUP_MAX_MS_MOBILE = 700;

/** Zoom par défaut : niveau ville (profil / recentrage). */
export const MAP_DEFAULT_CITY_ZOOM = 12;
/** Déplacement GPS minimal avant de bouger le marqueur utilisateur (~8 m). */
const MAP_USER_MARKER_MIN_MOVE_KM = 0.008;

const CARTO_TILES_PROXY = '/tiles/{z}/{x}/{y}{r}.png';
const CARTO_TILES_DIRECT =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/** Délai sélection marqueur après bascule globe → carte (ms). */
export const MAP_GLOBE_FLAT_DO_SELECT_MS = 150;

/** Debounce rebuild marqueurs capitales pendant pan carte (ms). */
const FLAT_CAPITALS_DEBOUNCE_MS = 200;

/** Only bump React zoom state when marker tier or capital labels would change. */
function shouldCommitFlatMapZoom(prevZoom: number, nextZoom: number): boolean {
  if (getFlatMapDetailTier(prevZoom) !== getFlatMapDetailTier(nextZoom)) return true;
  const prevCapitals = prevZoom >= FLAT_ZOOM_CITY_MIN;
  const nextCapitals = nextZoom >= FLAT_ZOOM_CITY_MIN;
  return prevCapitals !== nextCapitals;
}

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxZoom: number }> = {
  flat: {
    // Local tile proxy — backend fetches from CARTO and caches tiles on disk.
    // tileerror → repli CDN direct si le proxy est indisponible (dev sans msdev).
    url: CARTO_TILES_PROXY,
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
  onSelectMapEvent?: (event: MapEventMarker) => void;
  onSelectLiveCluster?: (cluster: import('../lib/mapLiveClusters').MapLiveLocationCluster) => void;
  onSelectMajorCityCluster?: (cluster: MapMajorCityLiveCluster) => void;
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
  /** État slider zoom (carte / globe). */
  onZoomControlChange?: (snapshot: MapZoomControlSnapshot) => void;
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
  onSelectMapEvent,
  onSelectLiveCluster,
  onSelectMajorCityCluster,
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
  onZoomControlChange,
  livesFilterOn = false,
  salonFilterOn = false,
  eventsFilterOn = false,
}: MapViewProps, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const globeViewRef = useRef<GlobeViewHandle | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  // Separate layer for salons + lives (always visible, small count).
  const salonLiveLayerRef = useRef<L.LayerGroup | null>(null);
  const majorCityLayerRef = useRef<L.LayerGroup | null>(null);
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
  const [flatCapitalsRevision, setFlatCapitalsRevision] = useState(0);
  const globeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossfadeRafRef = useRef<number | null>(null);
  const prevMapStyleRef = useRef<MapStyle | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;
  const skipCenterFlyRef = useRef(false);
  const programmaticMapMoveUntilRef = useRef(0);
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
  const onSelectMapEventRef = useRef(onSelectMapEvent);
  onSelectMapEventRef.current = onSelectMapEvent;
  const onSelectMajorCityClusterRef = useRef(onSelectMajorCityCluster);
  onSelectMajorCityClusterRef.current = onSelectMajorCityCluster;
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
  const onZoomControlChangeRef = useRef(onZoomControlChange);
  onZoomControlChangeRef.current = onZoomControlChange;
  const zoomSliderDraggingRef = useRef(false);
  const flatCapitalsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showGlobeRef = useRef(showGlobe);
  showGlobeRef.current = showGlobe;
  const touchCoarseRef = useRef(false);
  const flatRevealRef = useRef(flatReveal);
  flatRevealRef.current = flatReveal;
  const userMapPanRef = useRef(false);
  const userMarkerPosRef = useRef<[number, number] | null>(null);

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
    const layer = tileLayerRef.current;
    if (!layer) return;
    try {
      layer.redraw();
    } catch {
      /* layer may be removed */
    }
  }, []);

  const scheduleDetailEmit = useCallback(() => {
    if (detailEmitRafRef.current !== null) return;
    detailEmitRafRef.current = requestAnimationFrame(() => {
      detailEmitRafRef.current = null;
      emitMapDetailStateFnRef.current();
    });
  }, []);

  const resolveZoomMode = useCallback((): MapZoomMode => {
    if (showGlobeRef.current && webglSupportedRef.current && flatRevealRef.current < 0.5) {
      return 'globe';
    }
    return 'flat';
  }, []);

  const emitZoomControl = useCallback((mode: MapZoomMode, norm: number) => {
    onZoomControlChangeRef.current?.({
      mode,
      norm: Math.max(0, Math.min(1, norm)),
    });
  }, []);

  const syncZoomControlFromView = useCallback(() => {
    if (zoomSliderDraggingRef.current) return;
    const mode = resolveZoomMode();
    const norm =
      mode === 'globe'
        ? globeAltToNorm(globeAltitudeRef.current)
        : flatZoomToNorm(flatMapZoomRef.current);
    emitZoomControl(mode, norm);
  }, [emitZoomControl, resolveZoomMode]);

  const applyZoomControlNorm = useCallback(
    (norm: number) => {
      const clamped = Math.max(0, Math.min(1, norm));
      const mode = resolveZoomMode();
      if (mode === 'globe') {
        const alt = normToGlobeAlt(clamped);
        globeViewRef.current?.setAltitude(alt, 0);
        globeAltitudeRef.current = alt;
        emitZoomControl('globe', clamped);
        return;
      }
      const zoom = Math.round(normToFlatZoom(clamped));
      if (zoom <= 2 && webglSupportedRef.current) {
        onAutoSwitchToGlobeRef.current?.();
        emitZoomControl('globe', globeAltToNorm(MAP_GLOBE_ALT_MAX * 0.85));
        return;
      }
      if (!mapInstance.current) return;
      try {
        mapInstance.current.setZoom(zoom);
        flatMapZoomRef.current = zoom;
        setFlatMapZoom((prev) => (shouldCommitFlatMapZoom(prev, zoom) ? zoom : prev));
        emitZoomControl('flat', flatZoomToNorm(zoom));
      } catch {
        /* map may not be ready */
      }
    },
    [emitZoomControl, resolveZoomMode]
  );

  const handleGlobeAltitudeLive = useCallback(
    (altitude: number) => {
      globeAltitudeRef.current = altitude;
      if (zoomSliderDraggingRef.current || resolveZoomMode() !== 'globe') return;
      emitZoomControl('globe', globeAltToNorm(altitude));
    },
    [emitZoomControl, resolveZoomMode]
  );

  const syncZoomControlFromViewRef = useRef(syncZoomControlFromView);
  syncZoomControlFromViewRef.current = syncZoomControlFromView;

  const scheduleFlatCapitalsRefresh = useCallback(() => {
    if (flatCapitalsDebounceRef.current) clearTimeout(flatCapitalsDebounceRef.current);
    flatCapitalsDebounceRef.current = setTimeout(() => {
      flatCapitalsDebounceRef.current = null;
      setFlatCapitalsRevision((prev) => prev + 1);
    }, FLAT_CAPITALS_DEBOUNCE_MS);
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

  useEffect(() => {
    syncZoomControlFromView();
  }, [flatReveal, mapStyle, showGlobe, syncZoomControlFromView]);

  useImperativeHandle(ref, () => ({
    isMapReady() {
      return mapInstance.current != null;
    },
    invalidateSize() {
      try {
        mapInstance.current?.invalidateSize();
      } catch {
        // Map may not be ready
      }
    },
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
      const durationSec = MAP_CROSSFADE_MS / 1000;
      programmaticMapMoveUntilRef.current = Date.now() + Math.ceil(durationSec * 1000) + 500;
      skipCenterFlyRef.current = true;
      try {
        mapInstance.current.flyTo(sanitizeLatLngTuple(lat, lng), zoom, {
          duration: durationSec,
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
      const duration = opts?.durationSec ?? MAP_CITY_FLY_DURATION_S;
      programmaticMapMoveUntilRef.current = Date.now() + Math.ceil(duration * 1000) + 500;
      skipCenterFlyRef.current = true;
      try {
        mapInstance.current.invalidateSize();
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
    setZoomControlNorm(norm: number) {
      applyZoomControlNorm(norm);
    },
    setZoomSliderDragging(dragging: boolean) {
      zoomSliderDraggingRef.current = dragging;
      if (!dragging) syncZoomControlFromView();
    },
  }), [refreshFlatTileLayer, applyZoomControlNorm, syncZoomControlFromView]);

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

    const prevStyle = prevMapStyleRef.current;
    prevMapStyleRef.current = mapStyle;

    // Déjà en mode flat (premier chargement) — ne pas masquer les tuiles.
    if (prevStyle !== 'globe') {
      setShowGlobe(false);
      setFlatReveal(1);
      if (mapInstance.current) {
        try {
          mapInstance.current.invalidateSize();
          tileLayerRef.current?.redraw();
        } catch { /* map may not be ready */ }
      }
      return;
    }

    // Globe → flat : crossfade avec préchauffe tuiles
    setShowGlobe(true);
    setFlatReveal(0);

    // Sync hidden flat map to current center before crossfade (globe POV / bootstrap geo).
    if (mapInstance.current) {
      const [lat, lng] = centerRef.current;
      try {
        if (isValidLatLng(lat, lng)) {
          const current = mapInstance.current.getCenter();
          if (getDistanceKm(current.lat, current.lng, lat, lng) >= 0.01) {
            skipCenterFlyRef.current = true;
            programmaticMapMoveUntilRef.current = Date.now() + MAP_CROSSFADE_MS + 200;
            mapInstance.current.flyTo(sanitizeLatLngTuple(lat, lng), MAP_DEFAULT_CITY_ZOOM, {
              duration: MAP_CROSSFADE_MS / 1000,
            });
          }
        }
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

      const maxWaitMs = touchCoarseRef.current ? TILE_WARMUP_MAX_MS_MOBILE : TILE_WARMUP_MAX_MS;
      const minTimer = setTimeout(finish, TILE_WARMUP_MIN_MS);
      const maxTimer = setTimeout(finish, maxWaitMs);
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

    const initial = safeCenter(centerRef.current);

    const MAP_INIT_OPTIONS: L.MapOptions = {
      zoomControl: false,
      attributionControl: true,
      // Prefer canvas renderer: faster for large marker counts.
      preferCanvas: true,
      // Désactive les animations tuiles/zoom qui amplifient le jitter visuel.
      fadeAnimation: false,
      zoomAnimation: false,
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
      skipCenterFlyRef.current = true;
      map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView(initial, MAP_DEFAULT_CITY_ZOOM);
    } catch (err) {
      console.error('[MapView] Leaflet init error:', err);
      try {
        skipCenterFlyRef.current = true;
        map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView([...DEFAULT_CENTER], MAP_DEFAULT_CITY_ZOOM);
      } catch {
        return;
      }
    }

    map.attributionControl?.setPrefix(false);
    mapInstance.current = map;

    // Salon / live markers — regular group (counts stay low).
    salonLiveLayerRef.current = L.layerGroup().addTo(map);
    majorCityLayerRef.current = L.layerGroup().addTo(map);
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
    touchCoarseRef.current = touchCoarse;
    const tileLayer = L.tileLayer(flatCfg.url, {
      attribution: flatCfg.attribution,
      maxZoom: flatCfg.maxZoom,
      noWrap: true,
      // Mobile Safari : charger les tuiles pendant le pan (updateWhenIdle laisse la carte grise).
      updateWhenIdle: !touchCoarse,
      updateWhenZooming: touchCoarse,
      keepBuffer: touchCoarse ? 4 : 3,
      crossOrigin: touchCoarse,
    }).addTo(map);
    tileLayerRef.current = tileLayer;
    let tileProxyFailed = false;
    tileLayer.on('tileerror', () => {
      if (tileProxyFailed) return;
      tileProxyFailed = true;
      console.warn('[MapView] tile proxy unavailable — fallback CARTO CDN');
      tileLayer.setUrl(CARTO_TILES_DIRECT);
      tileLayer.redraw();
    });

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
      if (!zoomSliderDraggingRef.current && flatRevealRef.current >= 0.5) {
        syncZoomControlFromViewRef.current();
      }
      if (flatRevealRef.current >= 0.5 && getFlatMapDetailTier(zoom) !== 'overview') {
        scheduleFlatCapitalsRefresh();
      }
      if (zoom <= 2 && mapStyleRef.current === 'flat' && webglSupportedRef.current) {
        onAutoSwitchToGlobeRef.current?.();
      }
    };
    const onMapMoveEnd = () => {
      const programmatic =
        skipCenterFlyRef.current || Date.now() < programmaticMapMoveUntilRef.current;
      skipCenterFlyRef.current = false;

      const zoom = map.getZoom();
      flatMapZoomRef.current = zoom;
      if (zoom !== lastFlatZoomRef.current) {
        lastFlatZoomRef.current = zoom;
        setFlatMapZoom((prev) => (shouldCommitFlatMapZoom(prev, zoom) ? zoom : prev));
      }
      scheduleDetailEmit();

      if (programmatic) return;

      if (!zoomSliderDraggingRef.current && flatRevealRef.current >= 0.5) {
        syncZoomControlFromViewRef.current();
      }
      if (flatRevealRef.current >= 0.5 && getFlatMapDetailTier(zoom) !== 'overview') {
        scheduleFlatCapitalsRefresh();
      }
      try {
        const c = map.getCenter();
        if (!isValidLatLng(c.lat, c.lng)) return;
        userMapPanRef.current = true;
        onFlatMapViewportCenterRef.current?.(c.lat, c.lng);
        onMapExploredRef.current?.();
      } catch {
        /* map may not be ready */
      }
    };
    map.on('zoomend', onViewChange);
    map.on('moveend', onMapMoveEnd);
    lastFlatZoomRef.current = map.getZoom();
    setFlatMapZoom(map.getZoom());

    const rafId = requestAnimationFrame(() => map.invalidateSize());
    let resizeDebounce: ReturnType<typeof setTimeout> | null = null;
    let lastObservedW = 0;
    let lastObservedH = 0;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      if (w === lastObservedW && h === lastObservedH) return;
      lastObservedW = w;
      lastObservedH = h;
      if (resizeDebounce) clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(() => {
        resizeDebounce = null;
        map.invalidateSize();
      }, 120);
    });
    ro.observe(mapRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      if (flatCapitalsDebounceRef.current) {
        clearTimeout(flatCapitalsDebounceRef.current);
        flatCapitalsDebounceRef.current = null;
      }
      if (detailEmitRafRef.current !== null) {
        cancelAnimationFrame(detailEmitRafRef.current);
        detailEmitRafRef.current = null;
      }
      if (resizeDebounce) clearTimeout(resizeDebounce);
      ro.disconnect();
      map.off('click', onMapClick);
      map.off('zoomend', onViewChange);
      map.off('moveend', onMapMoveEnd);
      map.remove();
      mapInstance.current = null;
      salonLiveLayerRef.current = null;
      majorCityLayerRef.current = null;
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

  // ── Fly to center on explicit recenter (recenterToken) — not on every center prop change ──
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (recenterToken === 0) return;
    if (recenterToken === lastRecenterTokenRef.current) return;
    lastRecenterTokenRef.current = recenterToken;
    const [lat, lng] = centerRef.current;
    if (!isValidLatLng(lat, lng)) return;
    if (Date.now() < programmaticMapMoveUntilRef.current) return;

    const skipFromProgrammaticMove = skipCenterFlyRef.current;
    skipCenterFlyRef.current = false;
    if (skipFromProgrammaticMove) {
      try {
        const current = map.getCenter();
        if (getDistanceKm(current.lat, current.lng, lat, lng) < 0.01) return;
      } catch {
        /* map may not be ready — fall through to flyTo */
      }
    }

    userMapPanRef.current = false;
    try {
      skipCenterFlyRef.current = true;
      programmaticMapMoveUntilRef.current = Date.now() + 1100;
      map.flyTo(sanitizeLatLngTuple(lat, lng), MAP_DEFAULT_CITY_ZOOM, {
        duration: 0.6,
      });
    } catch (err) {
      console.error('[MapView] flyTo error:', err);
    }
  }, [recenterToken]);

  // ── User position marker (bonhomme bleu) ────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!userPosition || !isValidLatLng(userPosition[0], userPosition[1])) {
      userMarkerPosRef.current = null;
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
        userMarkerPosRef.current = safe;
      } else {
        const last = userMarkerPosRef.current;
        if (
          last &&
          getDistanceKm(last[0], last[1], safe[0], safe[1]) < MAP_USER_MARKER_MIN_MOVE_KM
        ) {
          return;
        }
        userMarkerRef.current.setLatLng(safe);
        userMarkerPosRef.current = safe;
      }
    } catch (err) {
      console.error('[MapView] userMarker error:', err);
    }
  }, [userPosition]);

  const showCapitalLabels = flatMapZoom >= FLAT_ZOOM_CITY_MIN;

  // ── World capital markers (flat map) — viewport only at city/street zoom ─
  useEffect(() => {
    const layer = capitalsLayerRef.current;
    if (!layer) return;

    const shouldShow =
      mapStyle === 'flat' && flatReveal >= 1 && markerVisibility.capitals;

    if (!shouldShow) {
      layer.clearLayers();
      return;
    }

    const bounds = readFlatMapBounds();
    const showLabels = showCapitalLabels;

    layer.clearLayers();
    for (const cap of WORLD_CAPITALS) {
      if (!isValidLatLng(cap.lat, cap.lng)) continue;
      if (bounds && !isInMapBounds(cap.lat, cap.lng, bounds)) continue;
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
  }, [
    mapStyle,
    flatReveal,
    showCapitalLabels,
    markerVisibility.capitals,
    flatCapitalsRevision,
    readFlatMapBounds,
  ]);

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

    // ── Salons & lives ──
    salonLayer.clearLayers();
    majorCityLayerRef.current?.clearLayers();

    const linkedSalonIds = new Set(visibleSalons.map((s) => s.id));

    let salonsToDraw: typeof visibleSalons;
    let livesToDraw: typeof visibleLives;

    // Hôtes déjà représentés par un point salon/live — sans ceci, le même hôte
    // (visible dans la liste "à proximité" dès qu'il est en live ou a un salon)
    // recevait EN PLUS un point "person" séparé au même endroit : 2 points
    // superposés sur la carte pour un seul live/salon.
    const mapActivityHostIds = new Set([
      ...visibleSalons.map((s) => s.hostId),
      ...visibleLives.map((l) => l.hostId),
    ]);

    // Salons/lives ancrés sur une grande ville (sans GPS précis, coords = centre ville)
    // sont toujours regroupés sous un seul logo cliquable — quel que soit le zoom —
    // pour éviter plusieurs marqueurs empilés exactement au même point.
    {
      const { cityClusters } = clusterSalonsLivesByMajorCity(
        visibleSalons,
        visibleLives,
        linkedSalonIds
      );
      const individual = filterOverviewIndividualMarkers(
        visibleSalons,
        visibleLives,
        linkedSalonIds
      );
      salonsToDraw = individual.salons;
      livesToDraw = individual.lives;

      const cityLayer = majorCityLayerRef.current;
      if (cityLayer) {
        for (const cluster of cityClusters) {
          try {
            const lat = Number(cluster.latitude);
            const lon = Number(cluster.longitude);
            if (!isValidLatLng(lat, lon)) continue;
            const icon = L.divIcon({
              className: '',
              html: buildMajorCityHubMarkerHtml(
                cluster.cityLabel,
                cluster.count,
                cluster.liveCount
              ),
              iconSize: [52, 56],
              iconAnchor: [26, 28],
            });
            const m = L.marker([lat, lon], { icon, zIndexOffset: 300 }).addTo(cityLayer);
            m.bindTooltip(
              `${escapeHtml(cluster.cityLabel)}<br/>${cluster.count} session${cluster.count !== 1 ? 's' : ''}`,
              {
                direction: 'top',
                offset: [0, -10],
                className: 'map-event-tooltip',
              }
            );
            m.on('click', (ev) => {
              L.DomEvent.stopPropagation(ev.originalEvent);
              onSelectMajorCityClusterRef.current?.(cluster);
            });
          } catch (err) {
            console.error('[MapView] major city marker error:', err);
          }
        }
      }
    }

    salonsToDraw.forEach((s) => {
      if (!isValidLatLng(s.latitude, s.longitude)) return;
      const botClass = s.isBot ? 'bot' : '';
      const liveClass = s.isLive ? 'live' : '';
      try {
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = overviewDots
          ? L.marker([lat, lon], {
              icon: L.divIcon({
                className: '',
                html: buildOverviewGeoMarkerHtml({
                  kind: 'salon',
                  isLive: s.isLive === true,
                }),
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
              zIndexOffset: s.isLive ? 120 : 80,
            })
          : L.marker(
              [lat, lon],
              {
                icon: L.divIcon({
                  className: '',
                  html: (() => {
                    const avatarFallback = dicebearAdventurerAvatar(s.hostId);
                    const avatar = s.hostAvatarUrl?.trim() || avatarFallback;
                    const avatarOnError = `this.onerror=null;this.src='${avatarFallback.replace(/'/g, '%27')}';`;
                    return `<div class="map-marker ${botClass} ${liveClass}">${s.isBot ? '<span class="bot-badge">BOT</span>' : ''}${s.isLive ? '<span class="live-badge">LIVE</span>' : ''}<img src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" onerror="${avatarOnError}"/>${usernameMapLabelHtml(s.hostName, s.hostUsernameColor, { wave: { from: s.hostUsernameWaveFrom, to: s.hostUsernameWaveTo } })}</div>`;
                  })(),
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

    livesToDraw.forEach((l) => {
      if (!isValidLatLng(l.latitude, l.longitude)) return;
      try {
        const lat = Number(l.latitude);
        const lon = Number(l.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = overviewDots
          ? L.marker([lat, lon], {
              icon: L.divIcon({
                className: '',
                html: buildOverviewGeoMarkerHtml({ kind: 'live', isLive: true }),
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              }),
              zIndexOffset: 120,
            })
          : L.marker(
              [lat, lon],
              {
                icon: L.divIcon({
                  className: '',
                  html: (() => {
                    const avatarFallback = dicebearAdventurerAvatar(l.hostId);
                    const avatar = l.hostAvatarUrl?.trim() || avatarFallback;
                    const avatarOnError = `this.onerror=null;this.src='${avatarFallback.replace(/'/g, '%27')}';`;
                    return `<div class="map-marker live"><span class="live-badge">LIVE</span><img src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" onerror="${avatarOnError}"/>${usernameMapLabelHtml(l.hostName, l.hostUsernameColor, { wave: { from: l.hostUsernameWaveFrom, to: l.hostUsernameWaveTo } })}</div>`;
                  })(),
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
        .filter((p) => isValidLatLng(p.latitude, p.longitude) && !mapActivityHostIds.has(p.id))
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
      .filter((p) => isValidLatLng(p.latitude, p.longitude) && !mapActivityHostIds.has(p.id))
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
        html: `<div class="map-marker person ${botClass} ${liveClass}"><div class="map-marker-person-top">${viewersLabel}<div class="person-avatar-stack">${liveBadge}<img src="${escapeHtml(avatar)}" alt="" loading="lazy" decoding="async" onerror="${avatarOnError}"/></div></div>${usernameMapLabelHtml(p.username, p.usernameColor, { wave: { from: p.usernameWaveFrom, to: p.usernameWaveTo } })}</div>`,
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

    const attachEventPopupHandlers = (marker: L.Marker, cluster: MapEventCityCluster) => {
      const popupEl = marker.getPopup()?.getElement();
      if (!popupEl) return;
      popupEl.querySelectorAll<HTMLButtonElement>('[data-event-id]').forEach((btn) => {
        const eventId = btn.getAttribute('data-event-id');
        if (!eventId) return;
        const ev = cluster.events.find((e) => e.id === eventId);
        if (!ev) return;
        L.DomEvent.on(btn, 'click', (domEv) => {
          L.DomEvent.stopPropagation(domEv);
          marker.closePopup();
          onSelectMapEventRef.current?.(ev);
          onSelectEventClusterRef.current?.(cluster);
        });
      });
    };

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
      m.bindPopup(buildEventClusterPopupHtml(cluster), {
        className: 'map-event-popup-wrap',
        maxWidth: 300,
        minWidth: 220,
      });
      m.on('popupopen', () => attachEventPopupHandlers(m, cluster));
      m.on('click', (clickEv) => {
        L.DomEvent.stopPropagation(clickEv.originalEvent);
        m.openPopup();
        onSelectEventClusterRef.current?.(cluster);
      });
    };

    try {
      visibleEventClusters.forEach((cluster) => addClusterMarker(cluster));
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
              ref={globeViewRef}
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
              onGlobeAltitudeLive={handleGlobeAltitudeLive}
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
