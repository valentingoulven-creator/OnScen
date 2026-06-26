import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { formatEventDateShort } from '../lib/feedEvents';
import { getEventTypeIcon } from '../lib/eventType';
import { isValidLatLng } from '../lib/mapCoords';
import { isWebGLError } from '../lib/webglSupport';
import { getCityMapView } from '../lib/mapEventClusters';
import { buildEventClusterKey, buildSalonLivePeopleKey } from '../lib/mapMarkersKey';
import { loadGlobeCountryFeatures, type CountryGeoFeature } from '../lib/globeCountries';
import { clusterLiveMapMarkers, type MapLiveLocationCluster } from '../lib/mapLiveClusters';
import {
  filterPeopleForZoom,
  filterSalonsForZoom,
  getDistanceKm,
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
  type: 'salon' | 'live' | 'person' | 'user' | 'event' | 'live-cluster';
  color: string;
  radius: number;
  label: string;
  entity?: Salon | Live | NearbyPerson | MapEventCityCluster | MapLiveLocationCluster;
}

interface GlobeRing {
  lat: number;
  lng: number;
}

/** Altitude en dessous de laquelle le globe bascule automatiquement vers la carte plate. */
const ALTITUDE_AUTO_SWITCH = 0.03;

/** Durée animation zoom globe → marqueur (ms). */
const GLOBE_MARKER_ZOOM_MS = 520;

/** Délai avant bascule carte plate pendant l'animation globe (ms). */
const GLOBE_FLAT_TRIGGER_MS = 280;

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

/** DPR réduit pendant drag/zoom globe — moins de fill-rate GPU. */
const GLOBE_INTERACTION_MAX_DPR = IS_LOW_POWER_DEVICE ? 1 : 1.5;

/** Fenêtre après dernier mouvement OrbitControls avant arrêt du loop damping. */
const DAMPING_IDLE_MS = 320;

/** Profil rendu adaptatif — netteté desktop vs perf mobile. */
const GLOBE_RENDER_PROFILE = (() => {
  const base = {
    skyTexture: '/globe/night-sky.png',
    backgroundColor: '#0a1220',
    atmosphereColor: 'rgba(140, 170, 255, 0.55)',
    atmosphereAltitude: 0.2,
    toneExposure: 1.38,
    spaceLighting: true,
    skyBrightness: 1.28,
  };
  if (typeof window === 'undefined') {
    return {
      maxPixelRatio: 1.5,
      antialias: false,
      curvatureResolution: 4,
      bumpTexture: null as string | null,
      bumpScale: 0,
      labelResolution: 3,
      ...base,
    };
  }
  if (IS_LOW_POWER_DEVICE) {
    return {
      maxPixelRatio: Math.min(window.devicePixelRatio, 1.5),
      antialias: false,
      curvatureResolution: 4,
      bumpTexture: null,
      bumpScale: 0,
      labelResolution: 3,
      ...base,
    };
  }
  return {
    maxPixelRatio: Math.min(window.devicePixelRatio, 2),
    antialias: true,
    curvatureResolution: 8,
    bumpTexture: '/globe/earth-topology.png',
    bumpScale: 0.32,
    labelResolution: 5,
    skyTexture: '/globe/stars-enhanced.jpg',
    backgroundColor: '#0c1628',
    /** Halo atmosphérique bleu (vue ISS) avec légère teinte Soundy. */
    atmosphereColor: 'rgba(88, 148, 220, 0.52)',
    atmosphereAltitude: 0.14,
    toneExposure: 1.52,
    spaceLighting: true,
    skyBrightness: 1.38,
  };
})();

/** Textures globe servies localement (app/public/globe → backend/public/globe). */
const GLOBE_EARTH_TEXTURE = '/globe/earth-night.jpg';

/** Améliore netteté textures + rendu HDR (desktop). Constantes Three.js (transitif via react-globe.gl). */
const THREE_LINEAR_FILTER = 1006;
const THREE_LINEAR_MIPMAP_LINEAR = 1008;
const THREE_SRGB_COLOR_SPACE = 'srgb';
const THREE_ACES_FILMIC = 4;

type GlobeTexture = {
  anisotropy: number;
  minFilter: number;
  magFilter: number;
  generateMipmaps?: boolean;
  needsUpdate: boolean;
};

type GlobePhongMaterial = {
  map?: GlobeTexture;
  bumpMap?: GlobeTexture;
  bumpScale?: number;
  shininess?: number;
  specular?: { setHex: (hex: number) => void };
  color?: { setRGB: (r: number, g: number, b: number) => void };
  needsUpdate?: boolean;
};

function configureGlobeSpaceLighting(globe: GlobeMethods): void {
  globe.scene().traverse((obj: unknown) => {
    const light = obj as {
      isAmbientLight?: boolean;
      isDirectionalLight?: boolean;
      intensity?: number;
      color?: { setHex: (hex: number) => void };
    };
    if (light.isAmbientLight && typeof light.intensity === 'number') {
      light.intensity = 0.62;
      light.color?.setHex(0x304060);
    }
    if (light.isDirectionalLight && typeof light.intensity === 'number') {
      light.intensity = 1.28;
      light.color?.setHex(0xfff6ea);
    }
  });
}

function applyGlobeVisualProfile(globe: GlobeMethods): void {
  configureGlobeVisualQuality(globe, GLOBE_RENDER_PROFILE.bumpScale, {
    toneExposure: GLOBE_RENDER_PROFILE.toneExposure,
    spaceLighting: GLOBE_RENDER_PROFILE.spaceLighting,
    skyBrightness: GLOBE_RENDER_PROFILE.skyBrightness,
  });
}

function configureGlobeVisualQuality(
  globe: GlobeMethods,
  bumpScale: number,
  opts: { toneExposure: number; spaceLighting: boolean; skyBrightness: number }
): void {
  try {
    const renderer = globe.renderer() as {
      outputColorSpace: string;
      toneMapping: number;
      toneMappingExposure: number;
      capabilities: { getMaxAnisotropy: () => number };
    };
    renderer.outputColorSpace = THREE_SRGB_COLOR_SPACE;
    renderer.toneMapping = THREE_ACES_FILMIC;
    renderer.toneMappingExposure = opts.toneExposure;

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    globe.scene().traverse((obj: unknown) => {
      const mesh = obj as { isMesh?: boolean; material?: GlobePhongMaterial | GlobePhongMaterial[] };
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of materials) {
        const isSkyMaterial = m.map && !m.bumpMap && typeof m.shininess !== 'number';
        if (m.map) {
          m.map.anisotropy = maxAniso;
          m.map.minFilter = THREE_LINEAR_MIPMAP_LINEAR;
          m.map.magFilter = THREE_LINEAR_FILTER;
          m.map.generateMipmaps = true;
          m.map.needsUpdate = true;
        }
        if (m.bumpMap) {
          m.bumpMap.anisotropy = maxAniso;
          m.bumpMap.minFilter = THREE_LINEAR_MIPMAP_LINEAR;
          m.bumpMap.magFilter = THREE_LINEAR_FILTER;
          m.bumpMap.needsUpdate = true;
          if (bumpScale > 0) m.bumpScale = bumpScale;
        }
        if (typeof m.shininess === 'number') {
          m.shininess = 14;
          m.specular?.setHex(0x4a5878);
          // Relève la texture earth-night sans la blanchir
          m.color?.setRGB(1.42, 1.38, 1.32);
        }
        if (isSkyMaterial && m.color && opts.skyBrightness !== 1) {
          const b = opts.skyBrightness;
          m.color.setRGB(b, b, b * 1.04);
        }
        m.needsUpdate = true;
      }
    });

    if (opts.spaceLighting) {
      configureGlobeSpaceLighting(globe);
    }
  } catch {
    /* mesh / textures pas encore prêts */
  }
}

/**
 * Stable empty arrays — passed as globe layer props when the layer has no data.
 * Using module-level constants prevents Three.js from receiving a new array
 * reference on every render, which would otherwise trigger geometry re-uploads
 * even when there is nothing to show.
 */
const EMPTY_RINGS: GlobeRing[] = [];
const EMPTY_CAPITAL_LABELS: GlobeCapitalLabel[] = [];
const EMPTY_COUNTRY_POLYGONS: CountryGeoFeature[] = [];

/** Frontières pays — remplissage transparent, trait très discret. */
const GLOBE_COUNTRY_BORDER_ALTITUDE = 0.004;
const GLOBE_COUNTRY_BORDER_CURVATURE = IS_LOW_POWER_DEVICE ? 2 : 3;
const getPolygonGeoJsonGeometry = (d: object) =>
  (d as CountryGeoFeature).geometry as unknown as { type: string; coordinates: number[] };
const getPolygonCapColor = () => 'rgba(0, 0, 0, 0)';
const getPolygonSideColor = () => 'rgba(0, 0, 0, 0)';
const getPolygonStrokeColor = () => 'rgba(130, 150, 180, 0.14)';

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
  antialias: GLOBE_RENDER_PROFILE.antialias,
  alpha: true,
  powerPreference: (IS_LOW_POWER_DEVICE ? 'default' : 'high-performance') as WebGLPowerPreference,
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
const getRingColor = () => 'rgba(248, 113, 113, 0.72)';

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
  /** Plusieurs lives au même endroit — popup liste (vue globe overview). */
  onSelectLiveCluster?: (cluster: MapLiveLocationCluster) => void;
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
  /**
   * Pré-charge la carte plate (position + tuiles) pendant l'animation globe,
   * avant le basculement mapStyle → flat.
   */
  onPrepareFlatMap?: (lat: number, lng: number, zoom?: number, radiusKm?: number) => void;
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
  onSelectLiveCluster,
  onZoomToFlat,
  onGlobeAltitudeChange,
  onGlobePovChange,
  livesFilterOn = false,
  salonFilterOn = false,
  eventsFilterOn = false,
  onGlobeUnavailable,
  onPrepareFlatMap,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  /** Tier seul en state — évite re-renders lourds à chaque frame d'altitude. */
  const [globeDetailTier, setGlobeDetailTier] = useState<MapDetailTier>('overview');
  const [countryPolygons, setCountryPolygons] = useState<CountryGeoFeature[]>(EMPTY_COUNTRY_POLYGONS);
  const [isInteracting, setIsInteracting] = useState(false);
  const isInteractingRef = useRef(false);
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

  const syncTierAndPovFromGlobe = useCallback(
    (scheduleNearby: boolean) => {
      try {
        const pov = globeRef.current?.pointOfView() as
          | { lat: number; lng: number; altitude: number }
          | undefined;
        if (!pov || typeof pov.altitude !== 'number') return;
        globeAltitudeRef.current = pov.altitude;
        const tier = getGlobeDetailTier(pov.altitude);
        const tierChanged = tier !== lastReportedTierRef.current;
        if (tierChanged) {
          lastReportedTierRef.current = tier;
          setGlobeDetailTier(tier);
          onGlobeAltitudeChangeRef.current?.(pov.altitude);
        }
        if (scheduleNearby && isValidLatLng(pov.lat, pov.lng)) {
          schedulePovChange(pov.lat, pov.lng, pov.altitude);
        }
      } catch {
        // pointOfView peut ne pas être disponible
      }
    },
    [schedulePovChange]
  );

  const setGlobeInteractionDpr = useCallback((interacting: boolean) => {
    try {
      const renderer = globeRef.current?.renderer() as { setPixelRatio: (r: number) => void } | undefined;
      if (!renderer) return;
      const ratio = interacting
        ? Math.min(window.devicePixelRatio, GLOBE_INTERACTION_MAX_DPR)
        : Math.min(window.devicePixelRatio, GLOBE_RENDER_PROFILE.maxPixelRatio);
      renderer.setPixelRatio(ratio);
    } catch {
      /* renderer may not be ready */
    }
  }, []);

  // Track container dimensions for the canvas
  useEffect(() => {
    let cancelled = false;
    void loadGlobeCountryFeatures().then((features) => {
      if (!cancelled && features.length) setCountryPolygons(features);
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

  // Configure OrbitControls and renderer once the globe canvas is ready
  useEffect(() => {
    if (!globeRef.current || size.w === 0) return;
    let cleanupListener: (() => void) | undefined;
    let cleanupRendererListeners: (() => void) | undefined;
    let dampingRafId = 0;
    let lastDampingAt = 0;
    try {
      const controls = globeRef.current.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableRotate: boolean;
        enablePan: boolean;
        enableZoom: boolean;
        enableDamping: boolean;
        dampingFactor: number;
        zoomSpeed: number;
        maxDistance: number;
        update: () => void;
        addEventListener: (event: string, cb: () => void) => void;
        removeEventListener: (event: string, cb: () => void) => void;
      };
      controls.autoRotate = false;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableDamping = true;
      // Damping plus réactif : inertie courte = zoom/pan qui répond sans traîner
      controls.dampingFactor = 0.08;
      // Zoom légèrement accéléré pour une réponse plus vive au pinch/scroll
      controls.zoomSpeed = 1.2;
      // Globe radius ≈ 100 units; 400 = altitude ~3× — prevents the globe from shrinking to a dot
      controls.maxDistance = 400;

      const tickDamping = () => {
        dampingRafId = 0;
        try {
          controls.update();
        } catch {
          return;
        }
        if (performance.now() - lastDampingAt < DAMPING_IDLE_MS) {
          dampingRafId = requestAnimationFrame(tickDamping);
        }
      };

      const bumpDampingLoop = () => {
        lastDampingAt = performance.now();
        if (!dampingRafId) {
          dampingRafId = requestAnimationFrame(tickDamping);
        }
      };

      const handleInteractionStart = () => {
        isInteractingRef.current = true;
        setIsInteracting(true);
        setGlobeInteractionDpr(true);
        bumpDampingLoop();
      };
      const handleInteractionEnd = () => {
        isInteractingRef.current = false;
        startTransition(() => setIsInteracting(false));
        setGlobeInteractionDpr(false);
        syncTierAndPovFromGlobe(true);
        flushPovChange();
        bumpDampingLoop();
      };

      const handleControlsChange = () => {
        bumpDampingLoop();

        // Tier / POV nearby : différés pendant le geste pour éviter re-renders HomePage.
        if (altitudeRafRef.current === null) {
          altitudeRafRef.current = requestAnimationFrame(() => {
            altitudeRafRef.current = null;
            if (isInteractingRef.current) {
              try {
                const pov = globeRef.current?.pointOfView() as
                  | { lat: number; lng: number; altitude: number }
                  | undefined;
                if (pov && typeof pov.altitude === 'number') {
                  globeAltitudeRef.current = pov.altitude;
                }
              } catch {
                /* ignore */
              }
            } else {
              syncTierAndPovFromGlobe(true);
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
          const altKm = pov.altitude * 6371;
          const leafletZoom = Math.round(Math.max(6, Math.min(10, Math.log2(40075 / (altKm * 2)) + 1)));
          onPrepareFlatMapRef.current?.(pov.lat, pov.lng, leafletZoom);
          onZoomToFlatRef.current(pov.lat, pov.lng, () => {}, leafletZoom, undefined, false);
        } catch {
          // pointOfView peut ne pas être disponible
        }
      };
      controls.addEventListener('start', handleInteractionStart);
      controls.addEventListener('end', handleInteractionEnd);
      controls.addEventListener('change', handleControlsChange);

      cleanupListener = () => {
        if (dampingRafId) cancelAnimationFrame(dampingRafId);
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, GLOBE_RENDER_PROFILE.maxPixelRatio));
      applyGlobeVisualProfile(globeRef.current);

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
          // Start crossfade while spin animation is still playing.
          onPrepareFlatMapRef.current?.(coords.lat, coords.lng, 12);
          try {
            globeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 0.5 }, 280);
          } catch { /* Globe may not be ready */ }
          zoomTimerRef.current = setTimeout(() => {
            zoomTimerRef.current = null;
            onZoomToFlatRef.current?.(coords.lat, coords.lng, () => {}, 12, undefined, false);
          }, 160);
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
  }, [size.w, flushPovChange, syncTierAndPovFromGlobe, setGlobeInteractionDpr, reportGlobeUnavailable]);

  // Cleanup pending zoom timer and dispose WebGL resources on unmount
  useEffect(() => {
    return () => {
      if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
      if (povDebounceRef.current !== null) clearTimeout(povDebounceRef.current);
      if (altitudeRafRef.current !== null) cancelAnimationFrame(altitudeRafRef.current);
      try {
        const globe = globeRef.current as unknown as {
          renderer?: () => { dispose: () => void; forceContextLoss?: () => void };
          scene?: () => { traverse: (cb: (obj: unknown) => void) => void };
        } | null;
        if (globe?.scene) {
          globe.scene().traverse((obj: unknown) => {
            const o = obj as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
            o.geometry?.dispose();
            if (Array.isArray(o.material)) {
              o.material.forEach((m) => m.dispose());
            } else {
              o.material?.dispose();
            }
          });
        }
        if (globe?.renderer) {
          const r = globe.renderer();
          r.forceContextLoss?.();
          r.dispose();
        }
      } catch {
        // Ignore disposal errors — globe may already be unmounted
      }
    };
  }, []);

  // Sync globe vers center prop (recenter explicite) — pas pendant interaction ni si déjà proche.
  useEffect(() => {
    if (!globeRef.current || !isValidLatLng(center[0], center[1])) return;
    if (isInteractingRef.current) return;
    try {
      const pov = globeRef.current.pointOfView() as
        | { lat: number; lng: number; altitude: number }
        | undefined;
      if (pov && isValidLatLng(pov.lat, pov.lng)) {
        const distKm = getDistanceKm(center[0], center[1], pov.lat, pov.lng);
        if (distKm < 0.15) return;
      }
      const duration = povSetRef.current ? 1200 : 0;
      povSetRef.current = true;
      let altitude = 1.0;
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
  const liveLocationClusters = useMemo(
    () =>
      globeDetailTier === 'overview' && markerVisibility.lives
        ? clusterLiveMapMarkers(
            cappedSalonsForGlobe.filter((s) => s.isLive),
            cappedLivesForGlobe,
            salonIds
          )
        : [],
    [
      globeDetailTier,
      markerVisibility.lives,
      cappedSalonsForGlobe,
      cappedLivesForGlobe,
      salonIds,
    ]
  );
  const useLiveClusters = globeDetailTier === 'overview' && liveLocationClusters.length > 0;
  const visibleEventClusters = useMemo(
    () => (markerVisibility.eventClusters ? eventClusters : []),
    [eventClusters, markerVisibility.eventClusters]
  );

  const globeMarkersContentKey = useMemo(() => {
    const userKey = userPosition
      ? `${userPosition[0]},${userPosition[1]}`
      : '';
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
          color: '#f87171',
          radius: multi ? 0.28 : 0.22,
          label: multi ? `🔴 ${cluster.count} LIVE` : `🔴 LIVE`,
          entity: cluster,
        });
      });
    } else {
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
    }

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
    globeDetailTier,
    markerVisibility.density,
    useLiveClusters,
    liveLocationClusters,
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

  // Pulsing rings — 1 sonar par cluster (overview) ou par live (zoom ville)
  const liveRings = useMemo<GlobeRing[]>(() => {
    if (!markerVisibility.lives || isInteracting) return EMPTY_RINGS;
    if (useLiveClusters) {
      return liveLocationClusters.map((c) => ({
        lat: c.latitude,
        lng: c.longitude,
      }));
    }
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
  }, [
    cappedSalonsForGlobe,
    cappedLivesForGlobe,
    salonIds,
    markerVisibility.lives,
    isInteracting,
    useLiveClusters,
    liveLocationClusters,
  ]);

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
  const ringMaxRadius = overviewDots ? 0.85 : 1.35;
  const ringPropagationSpeed = overviewDots ? 0.65 : 1.1;
  const ringRepeatPeriod = overviewDots ? 1100 : 900;
  const pointResolution = isInteracting ? 3 : overviewDots ? 4 : 8;
  const labelResolution = isInteracting ? 3 : GLOBE_RENDER_PROFILE.labelResolution;

  const handleGlobeReady = useCallback(() => {
    if (globeRef.current) {
      applyGlobeVisualProfile(globeRef.current);
    }
  }, []);

  const handlePointClick = useCallback(
    (pointObj: object) => {
      const p = pointObj as GlobePoint;

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
        const cluster = p.entity as MapEventCityCluster | undefined;
        const doSelect = () => {
          if (cluster) onSelectEventClusterRef.current?.(cluster);
        };

        if (onZoomToFlatRef.current && isValidLatLng(p.lat, p.lng)) {
          const cityView = getCityMapView(cluster?.cityKey ?? '');
          onPrepareFlatMapRef.current?.(p.lat, p.lng, cityView.zoom, cityView.radiusKm);
          try {
            globeRef.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.05 }, GLOBE_MARKER_ZOOM_MS);
          } catch {
            // Globe may not be ready
          }
          if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
          zoomTimerRef.current = setTimeout(() => {
            zoomTimerRef.current = null;
            onZoomToFlatRef.current?.(p.lat, p.lng, doSelect, cityView.zoom, cityView.radiusKm, false);
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
        try {
          globeRef.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.05 }, GLOBE_MARKER_ZOOM_MS);
        } catch {
          // Globe may not be ready
        }
        if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = setTimeout(() => {
          zoomTimerRef.current = null;
          onZoomToFlatRef.current?.(p.lat, p.lng, doSelect, 14, undefined, false);
        }, GLOBE_FLAT_TRIGGER_MS);
        return;
      }

      doSelect();
    },
    []
  );

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#0a1220] overflow-hidden touch-none">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          animateIn={false}
          waitForGlobeReady={false}
          rendererConfig={GLOBE_RENDERER_CONFIG}
          onGlobeReady={handleGlobeReady}
          globeCurvatureResolution={GLOBE_RENDER_PROFILE.curvatureResolution}
          backgroundColor={GLOBE_RENDER_PROFILE.backgroundColor}
          // Earth-at-night texture: dark continents + city lights (bundled locally)
          globeImageUrl={GLOBE_EARTH_TEXTURE}
          bumpImageUrl={GLOBE_RENDER_PROFILE.bumpTexture}
          backgroundImageUrl={GLOBE_RENDER_PROFILE.skyTexture}
          atmosphereColor={GLOBE_RENDER_PROFILE.atmosphereColor}
          atmosphereAltitude={GLOBE_RENDER_PROFILE.atmosphereAltitude}
          // Country borders (Natural Earth 110m — stroke only)
          polygonsData={countryPolygons}
          polygonGeoJsonGeometry={getPolygonGeoJsonGeometry}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStrokeColor}
          polygonAltitude={GLOBE_COUNTRY_BORDER_ALTITUDE}
          polygonCapCurvatureResolution={GLOBE_COUNTRY_BORDER_CURVATURE}
          polygonsTransitionDuration={0}
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
          ringMaxRadius={ringMaxRadius}
          ringPropagationSpeed={ringPropagationSpeed}
          ringRepeatPeriod={ringRepeatPeriod}
          // Capital city labels (hidden in events-only mode)
          labelsData={capitalLabels}
          labelLat={getLabelLat}
          labelLng={getLabelLng}
          labelText={getLabelText}
          labelSize={0.45}
          labelColor={getLabelColor}
          labelDotRadius={0.3}
          labelAltitude={0.003}
          labelResolution={labelResolution}
        />
      )}
    </div>
  );
});
