import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  lazy,
  Suspense,
  type CSSProperties,
} from 'react';
import { formatEventDateShort } from '../lib/feedEvents';
import {
  getClusterEventDayIndex,
  getMapEventDayColor,
  getMapEventMarkerDayIndex,
  resolveClusterMapPinSponsored,
} from '../lib/mapEventDayColors';
import { getMapEventDisplayIcon } from '../lib/eventType';
import { isValidLatLng } from '../lib/mapCoords';
import { isWebGLError } from '../lib/webglSupport';
import { getCityMapView } from '../lib/mapEventClusters';
import { buildEventClusterKey, buildSalonLivePeopleKey } from '../lib/mapMarkersKey';
import { loadGlobeCountryFeatures } from '../lib/globeCountries';
import { prepareGlobeCountries } from '../lib/globe3d/prepareCountries';
import { CAMERA_DEFAULT_ALTITUDE } from '../lib/globe3d/constants';
import type { PreparedCountry } from '../lib/globe3d/types';
import { clusterLiveMapMarkers, type MapLiveLocationCluster } from '../lib/mapLiveClusters';
import {
  linkedSalonIdsForLiveDedup,
  mergeLivesWithLiveSalons,
  splitSalonsForMapMarkers,
} from '../lib/mapLiveSalonMarkers';
import {
  filterPeopleForZoom,
  filterSalonsForZoom,
  filterCapitalsInGlobeRegion,
  getGlobeCapitalVisibleRadiusKm,
  getGlobeDetailTier,
  getMapMarkerVisibility,
  type MapDetailTier,
} from '../lib/mapMarkerVisibility';
import { toGlobeCapitalLabels, type GlobeCapitalLabel } from '../lib/worldCapitals';
import type { Salon, Live, NearbyPerson, MapEventCityCluster, MapEventMarker } from '../types';
import type { GlobeCameraBridgeHandle, RecenterRequest } from './globe3d/GlobeCameraBridge';
import type { SoundyGlobePoint } from './globe3d/SoundyGlobeMarkers';
import type { DevMapMarkerRef } from '../lib/devMapMarkerDrag';

const SoundyGlobeCanvas = lazy(() =>
  import('./globe3d/SoundyGlobeCanvas').then((m) => ({ default: m.SoundyGlobeCanvas }))
);

const GLOBE_CAPITAL_LABELS = toGlobeCapitalLabels();

interface GlobePoint {
  lat: number;
  lng: number;
  type: 'salon' | 'live' | 'person' | 'user' | 'event' | 'live-cluster';
  color: string;
  radius: number;
  label: string;
  entity?: Salon | Live | NearbyPerson | MapEventCityCluster | MapLiveLocationCluster | MapEventMarker;
  /** Emoji affiché sur le badge événement (globe uniquement). */
  icon?: string;
  /** Index jour browse (0–3) pour la couleur du pin événement. */
  dayIndex?: number;
  /** Événement sponsorisé — pin ✨ (globe). */
  isSponsored?: boolean;
  /** Nombre d'événements regroupés — affiché en badge sur l'icône (globe). */
  count?: number;
}

interface GlobeRing {
  lat: number;
  lng: number;
}

const ALTITUDE_AUTO_SWITCH = 0.03;
const GLOBE_MARKER_ZOOM_MS = 520;
const GLOBE_FLAT_TRIGGER_MS = 280;

const IS_LOW_POWER_DEVICE =
  typeof window !== 'undefined' &&
  (window.devicePixelRatio <= 1 ||
    navigator.hardwareConcurrency <= 4 ||
    /Mobile|Android|iPhone/i.test(navigator.userAgent));

const GLOBE_PEOPLE_CAP = IS_LOW_POWER_DEVICE ? 800 : 5000;
const GLOBE_OVERVIEW_CAP = IS_LOW_POWER_DEVICE ? 400 : 5000;
const POV_DEBOUNCE_MS = 400;
const GLOBE_INTERACTION_MAX_DPR = IS_LOW_POWER_DEVICE ? 1 : 1.5;

const GLOBE_RENDER_PROFILE = (() => {
  const base = { backgroundColor: '#0a1220' };
  if (typeof window === 'undefined') {
    return { maxPixelRatio: 1.5, antialias: false, ...base };
  }
  if (IS_LOW_POWER_DEVICE) {
    return {
      maxPixelRatio: Math.min(window.devicePixelRatio, 1.5),
      antialias: false,
      ...base,
    };
  }
  return {
    maxPixelRatio: Math.min(window.devicePixelRatio, 2),
    antialias: true,
    backgroundColor: '#0c1628',
  };
})();

/** Largeur de référence (px) pour l'échelle 1.0 des icônes DOM (pins/live/labels) du globe. */
const GLOBE_ICON_SCALE_REFERENCE_WIDTH = 640;
const GLOBE_ICON_SCALE_MIN = 0.55;

/** Icônes DOM (drei Html) en taille CSS fixe : sans ce facteur elles ne rétrécissent
 * pas avec un canvas plus petit (contrairement aux sphères 3D, mises à l'échelle
 * par la perspective). On les fait donc adapter à la largeur du viewport globe. */
function computeGlobeIconScale(width: number): number {
  if (width <= 0) return 1;
  const ratio = width / GLOBE_ICON_SCALE_REFERENCE_WIDTH;
  return Math.min(1, Math.max(GLOBE_ICON_SCALE_MIN, ratio));
}

const MAX_LIVE_RINGS = 40;
const EMPTY_RINGS: GlobeRing[] = [];
const EMPTY_CAPITAL_LABELS: GlobeCapitalLabel[] = [];
const EMPTY_PREPARED_COUNTRIES: PreparedCountry[] = [];

function globePointsEqual(a: GlobePoint[], b: GlobePoint[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (
      ai.lat !== bi.lat ||
      ai.lng !== bi.lng ||
      ai.type !== bi.type ||
      ai.color !== bi.color ||
      ai.radius !== bi.radius ||
      ai.icon !== bi.icon ||
      ai.count !== bi.count
    ) {
      return false;
    }
  }
  return true;
}

export interface GlobeViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  eventClusters?: MapEventCityCluster[];
  hasEventClusters?: boolean;
  eventsOnly?: boolean;
  showAllSalonsAtCityZoom?: boolean;
  center: [number, number];
  recenterToken?: number;
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
  /** Clic sur un pin événement individuel (tier city/street) — ouvre le détail de CET événement. */
  onSelectMapEvent?: (event: MapEventMarker) => void;
  /** Clic sur un hub ville (tier overview) ou un pin regroupant plusieurs événements au même endroit. */
  onSelectEventCluster?: (cluster: MapEventCityCluster) => void;
  onSelectLiveCluster?: (cluster: MapLiveLocationCluster) => void;
  onZoomToFlat?: (
    lat: number,
    lng: number,
    doSelect: () => void,
    zoom?: number,
    radiusKm?: number,
    animated?: boolean
  ) => void;
  onGlobeAltitudeChange?: (altitude: number) => void;
  onGlobePovChange?: (lat: number, lng: number, altitude: number) => void;
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
  eventsFilterOn?: boolean;
  onGlobeUnavailable?: () => void;
  onPrepareFlatMap?: (lat: number, lng: number, zoom?: number, radiusKm?: number) => void;
  onMapExplored?: () => void;
  onGlobeAltitudeLive?: (altitude: number) => void;
  /** Compte Dev : repositionner les marqueurs sur le globe. */
  devMarkerDragEnabled?: boolean;
  onDevMarkerDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void;
}

export interface GlobeViewHandle {
  getPointOfView: () => { lat: number; lng: number; altitude: number } | null;
  setAltitude: (altitude: number, durationMs?: number) => void;
  flyTo: (lat: number, lng: number, altitude?: number, durationMs?: number) => void;
}

function buildEventClusterGlobeLabel(cluster: MapEventCityCluster): string {
  const parts = [`📍 ${cluster.cityLabel}`];
  if (cluster.count > 1) {
    parts.push(`${cluster.count} événements`);
  } else if (cluster.events[0]) {
    const ev = cluster.events[0];
    const title = ev.title.trim() || 'Événement';
    parts.push(title);
    if (ev.eventDate) parts.push(formatEventDateShort(ev.eventDate));
  }
  return parts.join(' · ');
}

function buildIndividualEventGlobeLabel(ev: MapEventMarker): string {
  const title = ev.title.trim() || 'Événement';
  const parts = [`${getMapEventDisplayIcon(ev.eventType, { sponsored: ev.isSponsored })} ${title}`];
  if (ev.eventDate) parts.push(formatEventDateShort(ev.eventDate));
  return parts.join(' · ');
}

export const GlobeView = memo(
  forwardRef<GlobeViewHandle, GlobeViewProps>(function GlobeView(
    {
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
      onZoomToFlat,
      onGlobeAltitudeChange,
      onGlobePovChange,
      livesFilterOn = false,
      salonFilterOn = false,
      eventsFilterOn = false,
      onGlobeUnavailable,
      onPrepareFlatMap,
      onMapExplored,
      onGlobeAltitudeLive,
      devMarkerDragEnabled = false,
      onDevMarkerDragEnd,
    }: GlobeViewProps,
    ref
  ) {
    const cameraBridgeRef = useRef<GlobeCameraBridgeHandle | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const [globeDetailTier, setGlobeDetailTier] = useState<MapDetailTier>('overview');
    const [globeCapitalRegion, setGlobeCapitalRegion] = useState(() => ({
      lat: center[0],
      lng: center[1],
      altitude: CAMERA_DEFAULT_ALTITUDE,
    }));
    const [preparedCountries, setPreparedCountries] = useState<PreparedCountry[]>(EMPTY_PREPARED_COUNTRIES);
    const [isInteracting, setIsInteracting] = useState(false);
    const [recenterRequest, setRecenterRequest] = useState<RecenterRequest | null>(null);
    const isInteractingRef = useRef(false);
    const globeAltitudeRef = useRef(CAMERA_DEFAULT_ALTITUDE);
    const altitudeRafRef = useRef<number | null>(null);
    const povDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingPovRef = useRef<{ lat: number; lng: number; altitude: number } | null>(null);
    const povSetRef = useRef(false);
    const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onZoomToFlatRef = useRef(onZoomToFlat);
    onZoomToFlatRef.current = onZoomToFlat;
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
    const onSelectLiveClusterRef = useRef(onSelectLiveCluster);
    onSelectLiveClusterRef.current = onSelectLiveCluster;
    const onGlobeAltitudeChangeRef = useRef(onGlobeAltitudeChange);
    onGlobeAltitudeChangeRef.current = onGlobeAltitudeChange;
    const onGlobePovChangeRef = useRef(onGlobePovChange);
    onGlobePovChangeRef.current = onGlobePovChange;
    const onGlobeUnavailableRef = useRef(onGlobeUnavailable);
    onGlobeUnavailableRef.current = onGlobeUnavailable;
    const onPrepareFlatMapRef = useRef(onPrepareFlatMap);
    onPrepareFlatMapRef.current = onPrepareFlatMap;
    const onMapExploredRef = useRef(onMapExplored);
    onMapExploredRef.current = onMapExplored;
    const onGlobeAltitudeLiveRef = useRef(onGlobeAltitudeLive);
    onGlobeAltitudeLiveRef.current = onGlobeAltitudeLive;
    const lastRecenterTokenRef = useRef(recenterToken);
    const globeUnavailableReportedRef = useRef(false);
    const autoSwitchedRef = useRef(false);
    const lastReportedTierRef = useRef<MapDetailTier>(getGlobeDetailTier(CAMERA_DEFAULT_ALTITUDE));

    const reportGlobeUnavailable = useCallback((err?: unknown) => {
      if (globeUnavailableReportedRef.current) return;
      if (err != null && !isWebGLError(err)) return;
      globeUnavailableReportedRef.current = true;
      onGlobeUnavailableRef.current?.();
    }, []);

    const flushPovChange = useCallback(() => {
      if (povDebounceRef.current !== null) {
        clearTimeout(povDebounceRef.current);
        povDebounceRef.current = null;
      }
      const pov = pendingPovRef.current;
      pendingPovRef.current = null;
      if (pov && isValidLatLng(pov.lat, pov.lng)) {
        onGlobePovChangeRef.current?.(pov.lat, pov.lng, pov.altitude);
      }
    }, []);

    const schedulePovChange = useCallback(
      (lat: number, lng: number, altitude: number) => {
        pendingPovRef.current = { lat, lng, altitude };
        if (povDebounceRef.current !== null) return;
        povDebounceRef.current = setTimeout(() => {
          povDebounceRef.current = null;
          flushPovChange();
        }, POV_DEBOUNCE_MS);
      },
      [flushPovChange]
    );

    const refreshGlobeCapitalRegion = useCallback((lat: number, lng: number, altitude: number) => {
      if (getGlobeDetailTier(altitude) === 'overview') return;
      if (!isValidLatLng(lat, lng)) return;
      setGlobeCapitalRegion((prev) => {
        if (prev.lat === lat && prev.lng === lng && Math.abs(prev.altitude - altitude) < 0.008) {
          return prev;
        }
        return { lat, lng, altitude };
      });
    }, []);

    const syncTierAndPovFromGlobe = useCallback(
      (_scheduleNearby: boolean) => {
        try {
          const pov = cameraBridgeRef.current?.getPointOfView();
          if (!pov || typeof pov.altitude !== 'number') return;
          globeAltitudeRef.current = pov.altitude;
          onGlobeAltitudeLiveRef.current?.(pov.altitude);
          const tier = getGlobeDetailTier(pov.altitude);
          const tierChanged = tier !== lastReportedTierRef.current;
          if (tierChanged) {
            lastReportedTierRef.current = tier;
            setGlobeDetailTier(tier);
            onGlobeAltitudeChangeRef.current?.(pov.altitude);
          }
          if (!isInteractingRef.current) {
            refreshGlobeCapitalRegion(pov.lat, pov.lng, pov.altitude);
          }
          if (isValidLatLng(pov.lat, pov.lng)) {
            schedulePovChange(pov.lat, pov.lng, pov.altitude);
          }
        } catch {
          /* POV indisponible */
        }
      },
      [schedulePovChange, refreshGlobeCapitalRegion]
    );

    useEffect(() => {
      let cancelled = false;
      void loadGlobeCountryFeatures().then((features) => {
        if (!cancelled && features.length) {
          setPreparedCountries(prepareGlobeCountries(features));
        }
      });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
        }
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      return () => {
        if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
        if (povDebounceRef.current !== null) clearTimeout(povDebounceRef.current);
        if (altitudeRafRef.current !== null) cancelAnimationFrame(altitudeRafRef.current);
      };
    }, []);

    useEffect(() => {
      if (!isValidLatLng(center[0], center[1])) return;
      if (recenterToken === lastRecenterTokenRef.current && povSetRef.current) return;
      lastRecenterTokenRef.current = recenterToken;
      if (isInteractingRef.current) return;
      const pov = cameraBridgeRef.current?.getPointOfView();
      const altitude = pov?.altitude ?? CAMERA_DEFAULT_ALTITUDE;
      const durationMs = povSetRef.current ? 900 : 0;
      povSetRef.current = true;
      setRecenterRequest({
        lat: center[0],
        lng: center[1],
        altitude,
        token: recenterToken,
        durationMs,
      });
    }, [recenterToken, center]);

    const handleInteractionStart = useCallback(() => {
      isInteractingRef.current = true;
      onMapExploredRef.current?.();
      setIsInteracting(true);
    }, []);

    const handleInteractionEnd = useCallback(() => {
      isInteractingRef.current = false;
      startTransition(() => setIsInteracting(false));
      syncTierAndPovFromGlobe(true);
      flushPovChange();
    }, [syncTierAndPovFromGlobe, flushPovChange]);

    const handleControlsChange = useCallback(() => {
      if (altitudeRafRef.current === null) {
        altitudeRafRef.current = requestAnimationFrame(() => {
          altitudeRafRef.current = null;
          if (isInteractingRef.current) {
            try {
              const pov = cameraBridgeRef.current?.getPointOfView();
              if (!pov || typeof pov.altitude !== 'number') return;
              globeAltitudeRef.current = pov.altitude;
              onGlobeAltitudeLiveRef.current?.(pov.altitude);
              const tier = getGlobeDetailTier(pov.altitude);
              if (tier !== lastReportedTierRef.current) {
                lastReportedTierRef.current = tier;
                setGlobeDetailTier(tier);
              }
              if (isValidLatLng(pov.lat, pov.lng)) {
                schedulePovChange(pov.lat, pov.lng, pov.altitude);
              }
            } catch {
              /* ignore */
            }
          } else {
            syncTierAndPovFromGlobe(true);
          }
        });
      }

      if (autoSwitchedRef.current || !onZoomToFlatRef.current) return;
      try {
        const pov = cameraBridgeRef.current?.getPointOfView();
        if (!pov || pov.altitude >= ALTITUDE_AUTO_SWITCH) return;
        autoSwitchedRef.current = true;
        const altKm = pov.altitude * 6371;
        const leafletZoom = Math.round(
          Math.max(6, Math.min(10, Math.log2(40075 / (altKm * 2)) + 1))
        );
        onPrepareFlatMapRef.current?.(pov.lat, pov.lng, leafletZoom);
        onZoomToFlatRef.current(pov.lat, pov.lng, () => {}, leafletZoom, undefined, false);
      } catch {
        /* POV indisponible */
      }
    }, [syncTierAndPovFromGlobe, schedulePovChange]);

    const salonIds = useMemo(
      () => linkedSalonIdsForLiveDedup(salons),
      [salons]
    );

    const eventClustersActive = hasEventClusters ?? eventClusters.length > 0;
    const markerVisibility = useMemo(
      () =>
        getMapMarkerVisibility({
          tier: globeDetailTier,
          eventsOnly,
          hasEventClusters: eventClustersActive,
          showAllSalonsAtCityZoom,
          livesFilterOn,
          salonFilterOn,
          eventsFilterOn,
        }),
      [
        globeDetailTier,
        eventsOnly,
        eventClustersActive,
        showAllSalonsAtCityZoom,
        livesFilterOn,
        salonFilterOn,
        eventsFilterOn,
      ]
    );

    const visibleSalons = useMemo(
      () => filterSalonsForZoom(salons, markerVisibility, showAllSalonsAtCityZoom, globeDetailTier),
      [salons, markerVisibility, showAllSalonsAtCityZoom, globeDetailTier]
    );
    const visibleLives = useMemo(
      () => (markerVisibility.lives ? lives : []),
      [lives, markerVisibility.lives]
    );
    const visiblePeople = useMemo(
      () =>
        filterPeopleForZoom(people, markerVisibility, globeDetailTier)
          .filter((p) => isValidLatLng(Number(p.latitude), Number(p.longitude)))
          .slice(0, GLOBE_PEOPLE_CAP),
      [people, markerVisibility, globeDetailTier]
    );

    const { offlineSalons: offlineVisibleSalons, liveSalons: liveVisibleSalons } = useMemo(
      () => splitSalonsForMapMarkers(visibleSalons),
      [visibleSalons]
    );

    const mergedVisibleLives = useMemo(
      () => mergeLivesWithLiveSalons(visibleLives, liveVisibleSalons),
      [visibleLives, liveVisibleSalons]
    );

    const cappedSalonsForGlobe = useMemo(
      () => offlineVisibleSalons.slice(0, GLOBE_OVERVIEW_CAP),
      [offlineVisibleSalons]
    );
    const cappedLivesForGlobe = useMemo(
      () => mergedVisibleLives.slice(0, GLOBE_OVERVIEW_CAP),
      [mergedVisibleLives]
    );
    const mapActivityHostIds = useMemo(
      () =>
        new Set([
          ...cappedSalonsForGlobe.map((s) => s.hostId),
          ...cappedLivesForGlobe.map((l) => l.hostId),
        ]),
      [cappedSalonsForGlobe, cappedLivesForGlobe]
    );
    const liveLocationClusters = useMemo(
      () =>
        markerVisibility.lives
          ? clusterLiveMapMarkers([], cappedLivesForGlobe, salonIds)
          : [],
      [markerVisibility.lives, cappedLivesForGlobe, salonIds]
    );
    const useLiveClusters = markerVisibility.lives && liveLocationClusters.length > 0;
    const visibleEventClusters = useMemo(
      () => (markerVisibility.eventClusters ? eventClusters : []),
      [eventClusters, markerVisibility.eventClusters]
    );

    const globeMarkersContentKey = useMemo(() => {
      const userKey = userPosition ? `${userPosition[0]},${userPosition[1]}` : '';
      return [
        globeDetailTier,
        markerVisibility.density,
        buildSalonLivePeopleKey(cappedSalonsForGlobe, cappedLivesForGlobe, visiblePeople),
        useLiveClusters
          ? liveLocationClusters.map((c) => `${c.id}:${c.count}`).join('|')
          : '',
        buildEventClusterKey(visibleEventClusters, globeDetailTier),
        userKey,
      ].join('::');
    }, [
      globeDetailTier,
      markerVisibility.density,
      cappedSalonsForGlobe,
      cappedLivesForGlobe,
      visiblePeople,
      visibleEventClusters,
      userPosition,
      useLiveClusters,
      liveLocationClusters,
    ]);

    const cachedGlobePointsRef = useRef<{ key: string; points: GlobePoint[] }>({
      key: '',
      points: [],
    });

    const rawPoints = useMemo<GlobePoint[]>(() => {
      if (cachedGlobePointsRef.current.key === globeMarkersContentKey) {
        return cachedGlobePointsRef.current.points;
      }

      const pts: GlobePoint[] = [];
      const overviewDots = markerVisibility.density === 'overview';

      if (useLiveClusters) {
        liveLocationClusters.forEach((cluster) => {
          const lat = cluster.latitude;
          const lng = cluster.longitude;
          if (!isValidLatLng(lat, lng)) return;
          const multi = cluster.count > 1;
          pts.push({
            lat,
            lng,
            type: 'live-cluster',
            color: '#ef4444',
            radius: multi ? 0.42 : 0.34,
            label: multi ? `🔴 ${cluster.count} LIVE` : '🔴 LIVE',
            entity: cluster,
            count: multi ? cluster.count : undefined,
          });
        });
        cappedSalonsForGlobe.forEach((s) => {
          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          if (!isValidLatLng(lat, lng)) return;
          pts.push({
            lat,
            lng,
            type: 'salon',
            color: '#c084fc',
            radius: overviewDots ? 0.3 : 0.48,
            label: overviewDots ? `🎵 ${s.hostName}` : `🎵 ${s.hostName}`,
            entity: s,
          });
        });
      } else {
        cappedSalonsForGlobe.forEach((s) => {
          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          if (!isValidLatLng(lat, lng)) return;
          pts.push({
            lat,
            lng,
            type: 'salon',
            color: '#c084fc',
            radius: overviewDots ? 0.3 : 0.48,
            label: overviewDots ? `🎵 ${s.hostName}` : `🎵 ${s.hostName}`,
            entity: s,
          });
        });

        cappedLivesForGlobe.forEach((l) => {
          const lat = Number(l.latitude);
          const lng = Number(l.longitude);
          if (!isValidLatLng(lat, lng)) return;
          pts.push({
            lat,
            lng,
            type: 'live',
            color: '#ef4444',
            radius: overviewDots ? 0.4 : 0.56,
            label: `🔴 ${l.hostName} · LIVE`,
            entity: l,
          });
        });
      }

      visiblePeople.forEach((p) => {
        if (mapActivityHostIds.has(p.id)) return;
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        const liveSuffix = p.isLive ? ' · LIVE' : '';
        pts.push({
          lat,
          lng,
          type: 'person',
          color: p.isLive ? '#f87171' : '#a78bfa',
          radius: p.isLive ? 0.52 : 0.46,
          label: `${p.isLive ? '🔴' : '👤'} ${p.username}${liveSuffix}`,
          entity: p,
        });
      });

      if (globeDetailTier !== 'overview') {
        visibleEventClusters.forEach((cluster) => {
          cluster.events.forEach((ev) => {
            const lat = Number(ev.latitude);
            const lng = Number(ev.longitude);
            if (!isValidLatLng(lat, lng)) return;
            const dayIndex = getMapEventMarkerDayIndex(ev);
            pts.push({
              lat,
              lng,
              type: 'event',
              color: getMapEventDayColor(dayIndex),
              radius: 0.52,
              label: buildIndividualEventGlobeLabel(ev),
              dayIndex,
              isSponsored: Boolean(ev.isSponsored),
              // `entity` = l'événement précis (pas le cluster ville) : le clic
              // sur ce pin doit ouvrir le détail de CET événement, pas la
              // liste de la ville — cf. handlePointClick.
              entity: ev,
            });
          });
        });
      } else {
        visibleEventClusters.forEach((cluster) => {
          const lat = Number(cluster.latitude);
          const lng = Number(cluster.longitude);
          if (!isValidLatLng(lat, lng)) return;
          const dayIndex = getClusterEventDayIndex(cluster);
          pts.push({
            lat,
            lng,
            type: 'event',
            color: getMapEventDayColor(dayIndex),
            radius: cluster.count > 1 ? 0.78 : 0.68,
            label: buildEventClusterGlobeLabel(cluster),
            entity: cluster,
            dayIndex,
            isSponsored: resolveClusterMapPinSponsored(cluster),
            count: cluster.count > 1 ? cluster.count : undefined,
          });
        });
      }

      if (userPosition && isValidLatLng(userPosition[0], userPosition[1])) {
        pts.push({
          lat: userPosition[0],
          lng: userPosition[1],
          type: 'user',
          color: '#6366f1',
          radius: 0.42,
          label: 'Ma position',
        });
      }

      cachedGlobePointsRef.current = { key: globeMarkersContentKey, points: pts };
      return pts;
    }, [
      globeMarkersContentKey,
      cappedSalonsForGlobe,
      cappedLivesForGlobe,
      visiblePeople,
      visibleEventClusters,
      userPosition,
      salonIds,
      mapActivityHostIds,
      globeDetailTier,
      markerVisibility.density,
      useLiveClusters,
      liveLocationClusters,
    ]);

    const prevRawPointsRef = useRef<GlobePoint[] | null>(null);
    const stablePointsRef = useRef<GlobePoint[]>(rawPoints);
    if (rawPoints !== prevRawPointsRef.current) {
      prevRawPointsRef.current = rawPoints;
      if (!globePointsEqual(rawPoints, stablePointsRef.current)) {
        stablePointsRef.current = rawPoints;
      }
    }
    const points = stablePointsRef.current;

    // Anneaux "sonar" pulsés sur les lives actifs (feature MODIF 710, perdue
    // lors de la migration R3F — MODIF 981 laissait `liveRings` figé à vide).
    // Dérivés des `points` déjà calculés (pas de calcul géo supplémentaire),
    // plafonnés pour éviter un coût perf en zone très dense.
    const liveRings = useMemo(() => {
      const rings: GlobeRing[] = [];
      for (const p of points) {
        if (p.type !== 'live') continue;
        rings.push({ lat: p.lat, lng: p.lng });
        if (rings.length >= MAX_LIVE_RINGS) break;
      }
      return rings.length > 0 ? rings : EMPTY_RINGS;
    }, [points]);

    const capitalLabels = useMemo(() => {
      if (!markerVisibility.capitals || isInteracting) return EMPTY_CAPITAL_LABELS;
      const radiusKm = getGlobeCapitalVisibleRadiusKm(globeCapitalRegion.altitude);
      return filterCapitalsInGlobeRegion(
        GLOBE_CAPITAL_LABELS,
        globeCapitalRegion.lat,
        globeCapitalRegion.lng,
        radiusKm
      );
    }, [markerVisibility.capitals, isInteracting, globeCapitalRegion]);

    const overviewDots = markerVisibility.density === 'overview';
    const ringMaxRadius = overviewDots ? 0.85 : 1.35;
    const ringPropagationSpeed = overviewDots ? 0.65 : 1.1;
    const ringRepeatPeriod = overviewDots ? 1100 : 900;
    const pointResolution = isInteracting ? 3 : overviewDots ? 4 : 8;

    useImperativeHandle(
      ref,
      () => ({
        getPointOfView() {
          return cameraBridgeRef.current?.getPointOfView() ?? null;
        },
        setAltitude(altitude: number, durationMs = 0) {
          cameraBridgeRef.current?.setAltitude(altitude, durationMs);
          globeAltitudeRef.current = altitude;
          onGlobeAltitudeLiveRef.current?.(altitude);
          const pov = cameraBridgeRef.current?.getPointOfView();
          if (pov) {
            refreshGlobeCapitalRegion(pov.lat, pov.lng, altitude);
          }
          syncTierAndPovFromGlobe(false);
        },
        flyTo(lat: number, lng: number, altitude = 0.5, durationMs = 900) {
          if (!isValidLatLng(lat, lng)) return;
          cameraBridgeRef.current?.pointOfView(lat, lng, altitude, durationMs);
          globeAltitudeRef.current = altitude;
          onGlobeAltitudeLiveRef.current?.(altitude);
          refreshGlobeCapitalRegion(lat, lng, altitude);
          syncTierAndPovFromGlobe(true);
        },
      }),
      [syncTierAndPovFromGlobe, refreshGlobeCapitalRegion]
    );

    const handlePointClick = useCallback((p: SoundyGlobePoint) => {
      if (p.type === 'live-cluster') {
        const cluster = p.entity as MapLiveLocationCluster | undefined;
        if (!cluster) return;
        if (cluster.count === 1) {
          const salon = cluster.salons[0];
          const live = cluster.lives[0];
          if (salon) onSelectSalonRef.current(salon);
          else if (live) onSelectLiveRef.current(live);
          return;
        }
        onSelectLiveClusterRef.current?.(cluster);
        return;
      }

      if (p.type === 'event') {
        // Pin individuel (tier city/street, `entity` = l'événement précis) vs
        // hub ville (tier overview / regroupement, `entity` = le cluster) —
        // distingués par la présence de `events` (seul le cluster l'a).
        const entity = p.entity as MapEventCityCluster | MapEventMarker | undefined;
        const isCluster = !!entity && 'events' in entity;
        const cluster = isCluster ? (entity as MapEventCityCluster) : undefined;
        const singleEvent = !isCluster ? (entity as MapEventMarker | undefined) : undefined;
        const doSelect = () => {
          if (singleEvent) onSelectMapEventRef.current?.(singleEvent);
          else if (cluster) onSelectEventClusterRef.current?.(cluster);
        };

        if (onZoomToFlatRef.current && isValidLatLng(p.lat, p.lng)) {
          const cityView = getCityMapView(cluster?.cityKey ?? '');
          onPrepareFlatMapRef.current?.(p.lat, p.lng, cityView.zoom, cityView.radiusKm);
          cameraBridgeRef.current?.pointOfView(p.lat, p.lng, 0.05, GLOBE_MARKER_ZOOM_MS);
          if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
          zoomTimerRef.current = setTimeout(() => {
            zoomTimerRef.current = null;
            onZoomToFlatRef.current?.(
              p.lat,
              p.lng,
              doSelect,
              cityView.zoom,
              cityView.radiusKm,
              false
            );
          }, GLOBE_FLAT_TRIGGER_MS);
          return;
        }

        doSelect();
        return;
      }

      const doSelect = () => {
        switch (p.type) {
          case 'salon':
            if (p.entity) onSelectSalonRef.current(p.entity as Salon);
            break;
          case 'live':
            if (p.entity) onSelectLiveRef.current(p.entity as Live);
            break;
          case 'person':
            if (p.entity) onSelectPersonRef.current?.(p.entity as NearbyPerson);
            break;
        }
      };

      if (onZoomToFlatRef.current && isValidLatLng(p.lat, p.lng)) {
        onPrepareFlatMapRef.current?.(p.lat, p.lng, 14);
        cameraBridgeRef.current?.pointOfView(p.lat, p.lng, 0.05, GLOBE_MARKER_ZOOM_MS);
        if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = setTimeout(() => {
          zoomTimerRef.current = null;
          onZoomToFlatRef.current?.(p.lat, p.lng, doSelect, 14, undefined, false);
        }, GLOBE_FLAT_TRIGGER_MS);
        return;
      }

      doSelect();
    }, []);

    const handleGlobeDblClick = useCallback((lat: number, lng: number) => {
      if (!isValidLatLng(lat, lng)) return;
      if (zoomTimerRef.current !== null) {
        clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = null;
      }
      onPrepareFlatMapRef.current?.(lat, lng, 12);
      cameraBridgeRef.current?.pointOfView(lat, lng, 0.5, 280);
      zoomTimerRef.current = setTimeout(() => {
        zoomTimerRef.current = null;
        onZoomToFlatRef.current?.(lat, lng, () => {}, 12, undefined, false);
      }, 160);
    }, []);

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 bg-[#0a1220] overflow-hidden touch-none"
        style={{ '--globe-icon-scale': computeGlobeIconScale(size.w) } as CSSProperties}
      >
        {size.w > 0 && (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            }
          >
            <SoundyGlobeCanvas
              width={size.w}
              height={size.h}
              maxPixelRatio={GLOBE_RENDER_PROFILE.maxPixelRatio}
              interactionMaxPixelRatio={GLOBE_INTERACTION_MAX_DPR}
              isInteracting={isInteracting}
              antialias={GLOBE_RENDER_PROFILE.antialias}
              backgroundColor={GLOBE_RENDER_PROFILE.backgroundColor}
              lowPower={IS_LOW_POWER_DEVICE}
              countries={preparedCountries}
              points={points}
              rings={liveRings}
              capitalLabels={capitalLabels}
              overviewDots={overviewDots}
              pointResolution={pointResolution}
              ringMaxRadius={ringMaxRadius}
              ringPropagationSpeed={ringPropagationSpeed}
              ringRepeatPeriod={ringRepeatPeriod}
              cameraRef={cameraBridgeRef}
              recenterRequest={recenterRequest}
              onPointClick={handlePointClick}
              onGlobeDblClick={handleGlobeDblClick}
              autoRotateEnabled={false}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
              onControlsChange={handleControlsChange}
              onGlobeReady={() => syncTierAndPovFromGlobe(false)}
              onGlobeUnavailable={reportGlobeUnavailable}
              devMarkerDragEnabled={devMarkerDragEnabled}
              onDevMarkerDragEnd={onDevMarkerDragEnd}
            />
          </Suspense>
        )}
      </div>
    );
  })
);
