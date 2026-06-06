import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { isValidLatLng } from '../lib/mapCoords';
import { toGlobeCapitalLabels, type GlobeCapitalLabel } from '../lib/worldCapitals';
import type { Salon, Live, NearbyPerson } from '../types';

const GLOBE_CAPITAL_LABELS = toGlobeCapitalLabels();

interface GlobePoint {
  lat: number;
  lng: number;
  type: 'salon' | 'live' | 'person' | 'user';
  color: string;
  radius: number;
  label: string;
  entity?: Salon | Live | NearbyPerson;
}

interface GlobeRing {
  lat: number;
  lng: number;
}

/** Altitude en dessous de laquelle le globe bascule automatiquement vers la carte plate. */
const ALTITUDE_AUTO_SWITCH = 0.03;

export interface GlobeViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  center: [number, number];
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
  /**
   * Appelé après l'animation de zoom sur un marqueur (~900 ms) **ou** quand
   * l'utilisateur zoome manuellement en dessous de `ALTITUDE_AUTO_SWITCH`.
   * `doSelect` est une no-op dans le cas du zoom manuel.
   * `zoom` est le niveau Leaflet cible (optionnel, défaut 14).
   */
  onZoomToFlat?: (lat: number, lng: number, doSelect: () => void, zoom?: number) => void;
  /** Affiche les noms des capitales mondiales sur le globe. */
  showCapitals?: boolean;
}

export function GlobeView({
  salons,
  lives,
  people = [],
  center,
  userPosition,
  onSelectSalon,
  onSelectLive,
  onSelectPerson,
  onZoomToFlat,
  showCapitals = true,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const povSetRef = useRef(false);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref stable pour éviter les closures périmées dans le listener OrbitControls
  const onZoomToFlatRef = useRef(onZoomToFlat);
  onZoomToFlatRef.current = onZoomToFlat;
  // Empêche la transition auto de se déclencher plusieurs fois
  const autoSwitchedRef = useRef(false);

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
    try {
      const controls = globeRef.current.controls() as {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enableDamping: boolean;
        maxDistance: number;
        addEventListener: (event: string, cb: () => void) => void;
        removeEventListener: (event: string, cb: () => void) => void;
      };
      controls.autoRotate = false;
      controls.enableZoom = true;
      controls.enableDamping = true;
      // Globe radius ≈ 100 units; 400 = altitude ~3× — prevents the globe from shrinking to a dot
      controls.maxDistance = 400;

      // Bascule auto vers la carte plate quand l'utilisateur zoome trop près
      const handleControlsChange = () => {
        if (autoSwitchedRef.current || !onZoomToFlatRef.current) return;
        try {
          const pov = globeRef.current?.pointOfView() as
            | { lat: number; lng: number; altitude: number }
            | undefined;
          if (!pov || pov.altitude >= ALTITUDE_AUTO_SWITCH) return;
          autoSwitchedRef.current = true;
          onZoomToFlatRef.current(pov.lat, pov.lng, () => {}, 13);
        } catch {
          // pointOfView peut ne pas être disponible
        }
      };
      controls.addEventListener('change', handleControlsChange);
      cleanupListener = () => controls.removeEventListener('change', handleControlsChange);
    } catch {
      // OrbitControls may not be ready on first render
    }
    try {
      const renderer = (globeRef.current as unknown as { renderer: () => { domElement: HTMLCanvasElement; setPixelRatio: (r: number) => void } }).renderer();
      renderer.setPixelRatio(window.devicePixelRatio);

      // Ensure the canvas captures all touch gestures so OrbitControls handles
      // drag/rotation everywhere on mobile without browser interference.
      renderer.domElement.style.touchAction = 'none';

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
    } catch {
      // renderer accessor may not be available
    }
    return cleanupListener;
  }, [size.w]);

  // Cleanup pending zoom timer on unmount
  useEffect(() => {
    return () => {
      if (zoomTimerRef.current !== null) clearTimeout(zoomTimerRef.current);
    };
  }, []);

  // Fly to user center when it changes
  useEffect(() => {
    if (!globeRef.current || !isValidLatLng(center[0], center[1])) return;
    const duration = povSetRef.current ? 1200 : 0;
    povSetRef.current = true;
    try {
      globeRef.current.pointOfView({ lat: center[0], lng: center[1], altitude: 1.0 }, duration);
    } catch {
      // Globe may not be ready yet
    }
  }, [center[0], center[1]]);

  const salonIds = useMemo(() => new Set(salons.map((s) => s.id)), [salons]);

  /** Max person points on the globe — Three.js slows down with 10 000+ points. */
  const MAX_GLOBE_PEOPLE = 300;

  const points = useMemo<GlobePoint[]>(() => {
    const pts: GlobePoint[] = [];

    // Only salons that are currently live
    salons.forEach((s) => {
      if (!s.isLive) return;
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (!isValidLatLng(lat, lng)) return;
      pts.push({
        lat,
        lng,
        type: 'salon',
        color: '#f87171',
        radius: 0.52,
        label: `🎵 ${s.hostName} · LIVE`,
        entity: s,
      });
    });

    lives.forEach((l) => {
      if (salonIds.has(l.id)) return;
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!isValidLatLng(lat, lng)) return;
      pts.push({
        lat,
        lng,
        type: 'live',
        color: '#f87171',
        radius: 0.52,
        label: `🔴 ${l.hostName} · LIVE`,
        entity: l,
      });
    });

    // Only people who are currently live (cap to avoid GPU overload)
    const visiblePeople = people
      .filter((p) => p.isLive && isValidLatLng(Number(p.latitude), Number(p.longitude)))
      .slice(0, MAX_GLOBE_PEOPLE);

    visiblePeople.forEach((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      pts.push({
        lat,
        lng,
        type: 'person',
        color: '#f87171',
        radius: 0.52,
        label: `🔴 ${p.username} · LIVE`,
        entity: p,
      });
    });

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
  }, [salons, lives, people, userPosition, salonIds]);

  // Pulsing rings on live sessions
  const liveRings = useMemo<GlobeRing[]>(() => {
    const rings: GlobeRing[] = [];
    salons.forEach((s) => {
      if (!s.isLive) return;
      const lat = Number(s.latitude);
      const lng = Number(s.longitude);
      if (!isValidLatLng(lat, lng)) return;
      rings.push({ lat, lng });
    });
    lives.forEach((l) => {
      if (salonIds.has(l.id)) return;
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!isValidLatLng(lat, lng)) return;
      rings.push({ lat, lng });
    });
    return rings;
  }, [salons, lives, salonIds]);

  const handlePointClick = useCallback(
    (pointObj: object) => {
      const p = pointObj as GlobePoint;

      const doSelect = () => {
        switch (p.type) {
          case 'salon':
            if (p.entity) onSelectSalon(p.entity as Salon);
            break;
          case 'live':
            if (p.entity) onSelectLive(p.entity as Live);
            break;
          case 'person':
            if (p.entity) onSelectPerson?.(p.entity as NearbyPerson);
            break;
        }
      };

      if (onZoomToFlat && isValidLatLng(p.lat, p.lng)) {
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
          onZoomToFlat(p.lat, p.lng, doSelect);
        }, 700);
        return;
      }

      doSelect();
    },
    [onSelectSalon, onSelectLive, onSelectPerson, onZoomToFlat]
  );

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#010112] overflow-hidden touch-none">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          rendererConfig={{ antialias: true, alpha: true }}
          // Earth-at-night texture: dark continents + city lights
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          // Purple-indigo atmosphere matching app palette
          atmosphereColor="rgba(120, 90, 255, 0.85)"
          atmosphereAltitude={0.22}
          // Salon / live / person markers
          pointsData={points}
          pointLat={(d) => (d as GlobePoint).lat}
          pointLng={(d) => (d as GlobePoint).lng}
          pointColor={(d) => (d as GlobePoint).color}
          pointRadius={(d) => (d as GlobePoint).radius}
          pointAltitude={0.008}
          pointResolution={8}
          pointLabel={(d) => (d as GlobePoint).label}
          onPointClick={handlePointClick}
          // Animated pulsing rings on live sessions
          ringsData={liveRings}
          ringLat={(d) => (d as GlobeRing).lat}
          ringLng={(d) => (d as GlobeRing).lng}
          ringColor={() => 'rgba(248, 113, 113, 0.5)'}
          ringMaxRadius={3.5}
          ringPropagationSpeed={2}
          ringRepeatPeriod={800}
          // Capital city labels (all sovereign capitals at exact coords)
          labelsData={showCapitals ? GLOBE_CAPITAL_LABELS : []}
          labelLat={(d) => (d as GlobeCapitalLabel).lat}
          labelLng={(d) => (d as GlobeCapitalLabel).lng}
          labelText={(d) => (d as GlobeCapitalLabel).text}
          labelSize={0.45}
          labelColor={() => 'rgba(210, 210, 255, 0.88)'}
          labelDotRadius={0.3}
          labelAltitude={0.003}
          labelResolution={3}
        />
      )}
    </div>
  );
}
