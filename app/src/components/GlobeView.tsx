import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { formatEventDateShort } from '../lib/feedEvents';
import { getEventTypeIcon } from '../lib/eventType';
import { isValidLatLng } from '../lib/mapCoords';
import { isWebGLError } from '../lib/webglSupport';
import { getCityMapView } from '../lib/mapEventClusters';
import {
  filterPeopleForZoom,
  filterSalonsForZoom,
  getGlobeDetailTier,
  getMapMarkerVisibility,
  type MapDetailTier,
} from '../lib/mapMarkerVisibility';
import { toGlobeCapitalLabels, type GlobeCapitalLabel } from '../lib/worldCapitals';
import type { Salon, Live, NearbyPerson, MapEventCityCluster, MapEventMarker } from '../types';

const GLOBE_CAPITAL_LABELS = toGlobeCapitalLabels();

interface GlobePoint {
  lat: number;
  lng: number;
  type: 'salon' | 'live' | 'person' | 'user' | 'event';
  color: string;
  radius: number;
  label: string;
  entity?: Salon | Live | NearbyPerson | MapEventCityCluster;
}

interface GlobeRing {
  lat: number;
  lng: number;
}

/** Altitude en dessous de laquelle le globe bascule automatiquement vers la carte plate. */
const ALTITUDE_AUTO_SWITCH = 0.03;

/** Cap pixel ratio — évite le surcoût GPU sur mobile (DPR 2–3). */
const GLOBE_MAX_PIXEL_RATIO = 1.5;

/**
 * Désactive l'antialiasing WebGL sur mobile/écrans haute densité (DPR > 1).
 * Sur ces devices le DPR élevé donne déjà un rendu lissé nativement ;
 * activer l'antialias alourdit le fragment shader inutilement.
 */
const GLOBE_USE_ANTIALIAS = typeof window !== 'undefined' && window.devicePixelRatio <= 1;

/**
 * Appareil à faible puissance GPU : mobile, petit DPR, ou peu de cœurs CPU.
 * Sur ces devices un nombre élevé de markers risque l'OOM / crash WebGL.
 */
const IS_LOW_POWER_DEVICE =
  typeof window !== 'undefined' &&
  (window.devicePixelRatio <= 1 ||
    navigator.hardwareConcurrency <= 4 ||
    /Mobile|Android|iPhone/i.test(navigator.userAgent));

/** Caps adaptatifs : bas (mobile) vs haut (desktop). */
const GLOBE_PEOPLE_CAP = IS_LOW_POWER_DEVICE ? 800 : 5000;
const GLOBE_OVERVIEW_CAP = IS_LOW_POWER_DEVICE ? 400 : 5000;

/** Debounce POV pour rechargement nearby (filtre Lives). */
const POV_DEBOUNCE_MS = 600;

/** Textures globe servies localement (app/public/globe → backend/public/globe). */
const GLOBE_EARTH_TEXTURE = '/globe/earth-night.jpg';
const GLOBE_SKY_TEXTURE = '/globe/night-sky.png';

/**
 * Stable empty arrays — passed as globe layer props when the layer has no data.
 * Using module-level constants prevents Three.js from receiving a new array
 * reference on every render, which would otherwise trigger geometry re-uploads
 * even when there is nothing to show.
 */
const EMPTY_RINGS: GlobeRing[] = [];
const EMPTY_CAPITAL_LABELS: GlobeCapitalLabel[] = [];

/**
 * Stable WebGL renderer configuration.
 *
 * Must be a module-level constant so the same object reference is passed on
 * every render.  react-globe.gl forwards rendererConfig to the Three.js
 * WebGLRenderer constructor; a new object reference on every render risks
 * triggering renderer re-creation (context destroy + recreate) in versions that
 * do not memo the config themselves.
 *
 * preserveDrawingBuffer is intentionally false (the WebGL default):
 *   – true forces the GPU to keep the full colour buffer alive between frames,
 *     preventing the driver from using double-buffering / buffer-swap optimisation.
 *   – On integrated GPUs this costs roughly 2–5 ms per frame → 10–20 % overhead
 *     at 60 fps, visible as globe stuttering especially on mobile.
 *   – The only reason to enable it is canvas.toDataURL() screenshots; Soundy does
 *     not take globe screenshots, so the flag is unnecessary.
 */
const GLOBE_RENDERER_CONFIG = {
  antialias: GLOBE_USE_ANTIALIAS,
  alpha: true,
  powerPreference: 'default' as WebGLPowerPreference,
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,
};

/**
 * Stable accessor functions for react-globe.gl layer props.
 *
 * react-globe.gl's underlying ThreeGlobe library tracks accessor function
 * identity: when a function reference changes it schedules a full geometry
 * rebuild for the affected layer.  Inline JSX arrow functions are new object
 * references on every React render, so they cause unnecessary Three.js buffer
 * re-uploads on every re-render even when the actual data has not changed.
 *
 * Module-level functions are always the same reference → no spurious rebuilds.
 */
const getPointLat    = (d: object) => (d as GlobePoint).lat;
const getPointLng    = (d: object) => (d as GlobePoint).lng;
const getPointColor  = (d: object) => (d as GlobePoint).color;
const getPointRadius = (d: object) => (d as GlobePoint).radius;
const getPointLabel  = (d: object) => (d as GlobePoint).label;

const getRingLat   = (d: object) => (d as GlobeRing).lat;
const getRingLng   = (d: object) => (d as GlobeRing).lng;
const getRingColor = () => 'rgba(248, 113, 113, 0.5)';

const getLabelLat   = (d: object) => (d as GlobeCapitalLabel).lat;
const getLabelLng   = (d: object) => (d as GlobeCapitalLabel).lng;
const getLabelText  = (d: object) => (d as GlobeCapitalLabel).text;
const getLabelColor = () => 'rgba(210, 210, 255, 0.88)';

/**
 * Shallow equality over the fields that drive Three.js geometry / material.
 * If these fields are unchanged, Three.js does not need to re-upload the buffer.
 */
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
      ai.radius !== bi.radius
    )
      return false;
  }
  return true;
}

export interface GlobeViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  eventClusters?: MapEventCityCluster[];
  /** True when events exist before viewport clip (keeps layer visible while panning). */
  hasEventClusters?: boolean;
  /** Masque capitales — ne laisse que les pins événement (+ position utilisateur). */
  eventsOnly?: boolean;
  /** Au zoom ville, afficher tous les salons (filtre Salon sans Lives). */
  showAllSalonsAtCityZoom?: boolean;
  center: [number, number];
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
  onSelectEventCluster?: (cluster: MapEventCityCluster) => void;
  /**
   * Appelé après l'animation de zoom sur un marqueur (~900 ms) **ou** quand
   * l'utilisateur zoome manuellement en dessous de `ALTITUDE_AUTO_SWITCH`.
   * `doSelect` est une no-op dans le cas du zoom manuel.
   * `zoom` est le niveau Leaflet cible (optionnel, défaut 14).
   */
  onZoomToFlat?: (
    lat: number,
    lng: number,
    doSelect: () => void,
    zoom?: number,
    radiusKm?: number,
    animated?: boolean
  ) => void;
  /** Altitude globe (pointOfView) — panneau latéral carte. */
  onGlobeAltitudeChange?: (altitude: number) => void;
  /** POV complet (centre visible + altitude) — rechargement nearby globe. */
  onGlobePovChange?: (lat: number, lng: number, altitude: number) => void;
  /** Filtre Lives actif — points live (simplifiés en vue globale). */
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
  eventsFilterOn?: boolean;
  /** WebGL / Three.js init failed — parent should fall back to flat map. */
  onGlobeUnavailable?: () => void;
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
  const parts = [`${getEventTypeIcon(ev.eventType)} ${title}`];
  if (ev.eventDate) parts.push(formatEventDateShort(ev.eventDate));
  return parts.join(' · ');
}

export const GlobeView = memo(function GlobeView({
  salons,
  lives,
  people = [],
  eventClusters = [],
  hasEventClusters,
  eventsOnly = false,
  showAllSalonsAtCityZoom = false,
  center,
  userPosition,
  onSelectSalon,
  onSelectLive,
  onSelectPerson,
  onSelectEventCluster,
  onZoomToFlat,
  onGlobeAltitudeChange,
  onGlobePovChange,
  livesFilterOn = false,
  salonFilterOn = false,
  eventsFilterOn = false,
  onGlobeUnavailable,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  /** Tier seul en state — évite re-renders lourds à chaque frame d'altitude. */
  const [globeDetailTier, setGlobeDetailTier] = useState<MapDetailTier>('overview');
  const [isInteracting, setIsInteracting] = useState(false);
  const globeAltitudeRef = useRef(1.0);
  const altitudeRafRef = useRef<number | null>(null);
  const povDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPovRef = useRef<{ lat: number; lng: number; altitude: number } | null>(null);
  const povSetRef = useRef(false);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref stable pour éviter les closures périmées dans le listener OrbitControls
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
  const onGlobeAltitudeChangeRef = useRef(onGlobeAltitudeChange);
  onGlobeAltitudeChangeRef.current = onGlobeAltitudeChange;
  const onGlobePovChangeRef = useRef(onGlobePovChange);
  onGlobePovChangeRef.current = onGlobePovChange;
  const onGlobeUnavailableRef = useRef(onGlobeUnavailable);
  onGlobeUnavailableRef.current = onGlobeUnavailable;
  const globeUnavailableReportedRef = useRef(false);
  // Empêche la transition auto de se déclencher plusieurs fois
  const autoSwitchedRef = useRef(false);
  const lastReportedTierRef = useRef<MapDetailTier>(getGlobeDetailTier(1.0));

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

  // Track container dimensions for the canvas
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

  // Configure OrbitControls and renderer once the globe canvas is ready
  useEffect(() => {
    if (!globeRef.current || size.w === 0) return;
    let cleanupListener: (() => void) | undefined;
    let cleanupRendererListeners: (() => void) | undefined;
    try {
      const controls = globeRef.current.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enableDamping: boolean;
        dampingFactor: number;
        zoomSpeed: number;
        maxDistance: number;
        addEventListener: (event: string, cb: () => void) => void;
        removeEventListener: (event: string, cb: () => void) => void;
      };
      controls.autoRotate = false;
      controls.enableZoom = true;
      controls.enableDamping = true;
      // Damping plus réactif : inertie courte = zoom/pan qui répond sans traîner
      controls.dampingFactor = 0.08;
      // Zoom légèrement accéléré pour une réponse plus vive au pinch/scroll
      controls.zoomSpeed = 1.2;
      // Globe radius ≈ 100 units; 400 = altitude ~3× — prevents the globe from shrinking to a dot
      controls.maxDistance = 400;

      const handleInteractionStart = () => setIsInteracting(true);
      const handleInteractionEnd = () => {
        setIsInteracting(false);
        flushPovChange();
      };

      const handleControlsChange = () => {
        // Mise à jour tier (rAF) — setState uniquement au changement de tier
        if (altitudeRafRef.current === null) {
          altitudeRafRef.current = requestAnimationFrame(() => {
            altitudeRafRef.current = null;
            try {
              const pov = globeRef.current?.pointOfView() as
                | { lat: number; lng: number; altitude: number }
                | undefined;
              if (pov && typeof pov.altitude === 'number') {
                globeAltitudeRef.current = pov.altitude;
                const tier = getGlobeDetailTier(pov.altitude);
                const tierChanged = tier !== lastReportedTierRef.current;
                if (tierChanged) {
                  lastReportedTierRef.current = tier;
                  setGlobeDetailTier(tier);
                  onGlobeAltitudeChangeRef.current?.(pov.altitude);
                }
                if (isValidLatLng(pov.lat, pov.lng)) {
                  schedulePovChange(pov.lat, pov.lng, pov.altitude);
                }
              }
            } catch {
              // pointOfView peut ne pas être disponible
            }
          });
        }

        // Bascule auto vers la carte plate quand l'utilisateur zoome trop près
        if (autoSwitchedRef.current || !onZoomToFlatRef.current) return;
        try {
          const pov = globeRef.current?.pointOfView() as
            | { lat: number; lng: number; altitude: number }
            | undefined;
          if (!pov || pov.altitude >= ALTITUDE_AUTO_SWITCH) return;
          autoSwitchedRef.current = true;
          // Convertit l'altitude globe en zoom Leaflet équivalent (même étendue visuelle)
          // Formule : zoom ≈ log2(40075 / (altitude_km * 2)) + 1, clampé entre 6 et 10
          const altKm = pov.altitude * 6371;
          const leafletZoom = Math.round(Math.max(6, Math.min(10, Math.log2(40075 / (altKm * 2)) + 1)));
          onZoomToFlatRef.current(pov.lat, pov.lng, () => {}, leafletZoom, undefined, true);
        } catch {
          // pointOfView peut ne pas être disponible
        }
      };
      controls.addEventListener('start', handleInteractionStart);
      controls.addEventListener('end', handleInteractionEnd);
      controls.addEventListener('change', handleControlsChange);
      cleanupListener = () => {
        controls.removeEventListener('start', handleInteractionStart);
        controls.removeEventListener('end', handleInteractionEnd);
        controls.removeEventListener('change', handleControlsChange);
      };
    } catch (err) {
      if (isWebGLError(err)) reportGlobeUnavailable(err);
      // OrbitControls may not be ready on first render
    }
    try {
      const renderer = (globeRef.current as unknown as { renderer: () => { domElement: HTMLCanvasElement; setPixelRatio: (r: number) => void } }).renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, GLOBE_MAX_PIXEL_RATIO));

      // Ensure the canvas captures all touch gestures so OrbitControls handles
      // drag/rotation everywhere on mobile without browser interference.
      renderer.domElement.style.touchAction = 'none';

      const onContextLost = () => reportGlobeUnavailable();
      const onContextCreationError = (event: Event) => {
        reportGlobeUnavailable((event as WebGLContextEvent).statusMessage ?? event);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('webglcontextcreationerror', onContextCreationError);

      // Disable pointer events on any HTML overlay elements that react-globe.gl
      // places beside the canvas (tooltip div, CSS2D/CSS3D containers).
      // These overlays can absorb pointerdown in zones with markers/rings/labels,
      // blocking OrbitControls from starting a drag. The canvas itself keeps
      // pointer-events: auto so OrbitControls and onPointClick raycasting still work.
      const wrapper = renderer.domElement.parentElement;
      if (wrapper) {
        Array.from(wrapper.children).forEach((child) => {
          if (child !== renderer.domElement) {
            (child as HTMLElement).style.pointerEvents = 'none';
          }
        });
      }

      // Double-click anywhere on the globe surface → transition to flat map
      // centered on that location, with a brief globe spin as visual feedback.
      const handleDblClick = (e: MouseEvent) => {
        if (!globeRef.current) return;
        try {
          const globeWithCoords = globeRef.current as unknown as {
            toGlobeCoords?: (x: number, y: number) => { lat: number; lng: number } | null;
          };
          const coords = globeWithCoords.toGlobeCoords?.(e.offsetX, e.offsetY);
          if (!coords || !isValidLatLng(coords.lat, coords.lng)) return;
          // Cancel any pending single-click zoom timer to avoid a double transition.
          if (zoomTimerRef.current !== null) {
            clearTimeout(zoomTimerRef.current);
            zoomTimerRef.current = null;
          }
          // Spin globe toward the clicked point for natural visual feedback.
          try {
            globeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 0.5 }, 350);
          } catch { /* Globe may not be ready */ }
          // Start crossfade after 300 ms (while the spin animation is still playing).
          zoomTimerRef.current = setTimeout(() => {
            zoomTimerRef.current = null;
            onZoomToFlatRef.current?.(coords.lat, coords.lng, () => {}, 12, undefined, false);
          }, 300);
        } catch { /* toGlobeCoords may not be available */ }
      };
      renderer.domElement.addEventListener('dblclick', handleDblClick);

      cleanupRendererListeners = () => {
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextcreationerror', onContextCreationError);
        renderer.domElement.removeEventListener('dblclick', handleDblClick);
      };
    } catch (err) {
      if (isWebGLError(err)) reportGlobeUnavailable(err);
      // renderer accessor may not be available
    }
    return () => {
      cleanupListener?.();
      cleanupRendererListeners?.();
      if (altitudeRafRef.current !== null) {
        cancelAnimationFrame(altitudeRafRef.current);
        altitudeRafRef.current = null;
      }
    };
  }, [size.w, flushPovChange, schedulePovChange, reportGlobeUnavailable]);

  // Cleanup pending zoom timer on unmount
  useEffect(() => {
    return () => {
      if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
      if (povDebounceRef.current !== null) clearTimeout(povDebounceRef.current);
      if (altitudeRafRef.current !== null) cancelAnimationFrame(altitudeRafRef.current);
    };
  }, []);

  // Fly to user center when it changes — preserve altitude (évite reset overview qui masque les lives).
  useEffect(() => {
    if (!globeRef.current || !isValidLatLng(center[0], center[1])) return;
    const duration = povSetRef.current ? 1200 : 0;
    povSetRef.current = true;
    try {
      let altitude = 1.0;
      const pov = globeRef.current.pointOfView() as
        | { lat: number; lng: number; altitude: number }
        | undefined;
      if (pov && typeof pov.altitude === 'number') {
        altitude = pov.altitude;
      }
      globeRef.current.pointOfView({ lat: center[0], lng: center[1], altitude }, duration);
    } catch {
      // Globe may not be ready yet
    }
  }, [center[0], center[1]]);

  const salonIds = useMemo(() => new Set(salons.map((s) => s.id)), [salons]);

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
  const cappedSalonsForGlobe = useMemo(
    () => visibleSalons.slice(0, GLOBE_OVERVIEW_CAP),
    [visibleSalons]
  );
  const cappedLivesForGlobe = useMemo(
    () => visibleLives.slice(0, GLOBE_OVERVIEW_CAP),
    [visibleLives]
  );
  const visibleEventClusters = useMemo(
    () => (markerVisibility.eventClusters ? eventClusters : []),
    [eventClusters, markerVisibility.eventClusters]
  );

  const rawPoints = useMemo<GlobePoint[]>(() => {
    const pts: GlobePoint[] = [];
    const overviewDots = markerVisibility.density === 'overview';

    cappedSalonsForGlobe.forEach((s) => {
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (!isValidLatLng(lat, lng)) return;
      const liveSuffix = s.isLive ? ' · LIVE' : '';
      pts.push({
        lat,
        lng,
        type: 'salon',
        color: s.isLive ? '#f87171' : '#c084fc',
        radius: overviewDots ? (s.isLive ? 0.34 : 0.3) : s.isLive ? 0.52 : 0.48,
        label: overviewDots
          ? `${s.isLive ? '🔴' : '🎵'} ${s.hostName}${liveSuffix}`
          : `🎵 ${s.hostName}${liveSuffix}`,
        entity: s,
      });
    });

    cappedLivesForGlobe.forEach((l) => {
      if (salonIds.has(l.id)) return;
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!isValidLatLng(lat, lng)) return;
      pts.push({
        lat,
        lng,
        type: 'live',
        color: '#f87171',
        radius: overviewDots ? 0.34 : 0.52,
        label: `🔴 ${l.hostName} · LIVE`,
        entity: l,
      });
    });

    visiblePeople.forEach((p) => {
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
          pts.push({
            lat,
            lng,
            type: 'event',
            color: '#f59e0b',
            radius: 0.52,
            label: buildIndividualEventGlobeLabel(ev),
            entity: cluster,
          });
        });
      });
    } else {
      visibleEventClusters.forEach((cluster) => {
        const lat = Number(cluster.latitude);
        const lng = Number(cluster.longitude);
        if (!isValidLatLng(lat, lng)) return;
        pts.push({
          lat,
          lng,
          type: 'event',
          color: '#f59e0b',
          radius: cluster.count > 1 ? 0.68 : 0.58,
          label: buildEventClusterGlobeLabel(cluster),
          entity: cluster,
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

    return pts;
  }, [
    cappedSalonsForGlobe,
    cappedLivesForGlobe,
    visiblePeople,
    visibleEventClusters,
    userPosition,
    salonIds,
    globeDetailTier,
    markerVisibility.density,
  ]);

  /**
   * Reference stabilizer for `rawPoints`.
   * When the parent re-renders due to a bounds update (e.g., every 250 ms while
   * panning with a filter active), `rawPoints` may be a new array object even
   * though every point's geometry/color/radius is identical.  Passing a new
   * reference to <Globe pointsData> would cause Three.js to re-upload the
   * entire geometry buffer for no visual change.
   *
   * This block runs during render (not in an effect) so there is no extra
   * commit cycle.  Mutating refs during render is safe here because it has no
   * observable side-effects on React state.
   */
  const prevRawPointsRef = useRef<GlobePoint[] | null>(null);
  const stablePointsRef = useRef<GlobePoint[]>(rawPoints);
  if (rawPoints !== prevRawPointsRef.current) {
    prevRawPointsRef.current = rawPoints;
    if (!globePointsEqual(rawPoints, stablePointsRef.current)) {
      stablePointsRef.current = rawPoints;
    }
  }
  const points = stablePointsRef.current;

  // Pulsing rings on live sessions (ville + rue uniquement) — off pendant drag
  const liveRings = useMemo<GlobeRing[]>(() => {
    if (!markerVisibility.lives || isInteracting) return EMPTY_RINGS;
    const rings: GlobeRing[] = [];
    cappedSalonsForGlobe.forEach((s) => {
      if (!s.isLive) return;
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (!isValidLatLng(lat, lng)) return;
      rings.push({ lat, lng });
    });
    cappedLivesForGlobe.forEach((l) => {
      if (salonIds.has(l.id)) return;
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!isValidLatLng(lat, lng)) return;
      rings.push({ lat, lng });
    });
    return rings;
  }, [cappedSalonsForGlobe, cappedLivesForGlobe, salonIds, markerVisibility.lives, isInteracting]);

  // useMemo keeps the reference stable — GLOBE_CAPITAL_LABELS and EMPTY_CAPITAL_LABELS
  // are module-level constants, so labelsData never gets a fresh array object unless
  // the visible tier actually changes.
  const capitalLabels = useMemo(
    () =>
      markerVisibility.capitals && !isInteracting
        ? GLOBE_CAPITAL_LABELS
        : EMPTY_CAPITAL_LABELS,
    [markerVisibility.capitals, isInteracting]
  );

  const overviewDots = markerVisibility.density === 'overview';
  const pointResolution = isInteracting ? 3 : overviewDots ? 4 : 8;

  const handlePointClick = useCallback(
    (pointObj: object) => {
      const p = pointObj as GlobePoint;

      if (p.type === 'event') {
        const cluster = p.entity as MapEventCityCluster | undefined;
        const doSelect = () => {
          if (cluster) onSelectEventClusterRef.current?.(cluster);
        };

        if (onZoomToFlatRef.current && isValidLatLng(p.lat, p.lng)) {
          const cityView = getCityMapView(cluster?.cityKey ?? '');
          try {
            globeRef.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.05 }, 1000);
          } catch {
            // Globe may not be ready
          }
          if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
          zoomTimerRef.current = setTimeout(() => {
            zoomTimerRef.current = null;
            onZoomToFlatRef.current?.(p.lat, p.lng, doSelect, cityView.zoom, cityView.radiusKm);
          }, 700);
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
        // Zoom in on the marker (~1 s animation: altitude 1.0 → 0.05)
        try {
          globeRef.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.05 }, 1000);
        } catch {
          // Globe may not be ready
        }
        // Trigger map transition at 700 ms (≈70% of zoom animation) to start crossfade
        if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = setTimeout(() => {
          zoomTimerRef.current = null;
          onZoomToFlatRef.current?.(p.lat, p.lng, doSelect);
        }, 700);
        return;
      }

      doSelect();
    },
    []
  );

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#010112] overflow-hidden touch-none">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          animateIn={false}
          waitForGlobeReady={false}
          rendererConfig={GLOBE_RENDERER_CONFIG}
          // Earth-at-night texture: dark continents + city lights (bundled locally)
          globeImageUrl={GLOBE_EARTH_TEXTURE}
          backgroundImageUrl={GLOBE_SKY_TEXTURE}
          // Purple-indigo atmosphere matching app palette
          atmosphereColor="rgba(120, 90, 255, 0.85)"
          atmosphereAltitude={0.22}
          pointsTransitionDuration={0}
          labelsTransitionDuration={0}
          // Salon / live / person markers
          pointsData={points}
          pointLat={getPointLat}
          pointLng={getPointLng}
          pointColor={getPointColor}
          pointRadius={getPointRadius}
          pointAltitude={0.008}
          pointResolution={pointResolution}
          pointLabel={getPointLabel}
          onPointClick={handlePointClick}
          // Animated pulsing rings on live sessions
          ringsData={liveRings}
          ringLat={getRingLat}
          ringLng={getRingLng}
          ringColor={getRingColor}
          ringMaxRadius={3.5}
          ringPropagationSpeed={2}
          ringRepeatPeriod={800}
          // Capital city labels (hidden in events-only mode)
          labelsData={capitalLabels}
          labelLat={getLabelLat}
          labelLng={getLabelLng}
          labelText={getLabelText}
          labelSize={0.45}
          labelColor={getLabelColor}
          labelDotRadius={0.3}
          labelAltitude={0.003}
          labelResolution={3}
        />
      )}
    </div>
  );
});
