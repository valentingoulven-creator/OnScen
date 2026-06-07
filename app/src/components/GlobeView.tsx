import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { Live, NearbyPerson, Salon } from '../types';
import { useViewport } from '../hooks/useViewport';

const EARTH_TEXTURE = 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
const BUMP_TEXTURE = 'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png';

export type GlobeMarkerKind = 'salon' | 'live' | 'person';

export interface GlobeMarker {
  id: string;
  kind: GlobeMarkerKind;
  lat: number;
  lng: number;
  label: string;
  color: string;
  size: number;
  salon?: Salon;
  live?: Live;
  person?: NearbyPerson;
}

interface GlobeViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  center: [number, number];
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
}

function buildMarkers(
  salons: Salon[],
  lives: Live[],
  people: NearbyPerson[]
): GlobeMarker[] {
  const markers: GlobeMarker[] = [];
  const liveIds = new Set(lives.map((l) => l.id));

  for (const salon of salons) {
    markers.push({
      id: `salon-${salon.id}`,
      kind: liveIds.has(salon.id) ? 'live' : 'salon',
      lat: salon.latitude,
      lng: salon.longitude,
      label: salon.title,
      color: liveIds.has(salon.id) ? '#ef4444' : '#a855f7',
      size: 0.45,
      salon,
    });
  }

  for (const live of lives) {
    if (salons.some((s) => s.id === live.id)) continue;
    markers.push({
      id: `live-${live.id}`,
      kind: 'live',
      lat: live.latitude,
      lng: live.longitude,
      label: live.title,
      color: '#ef4444',
      size: 0.5,
      live,
    });
  }

  for (const person of people) {
    if (person.latitude == null || person.longitude == null) continue;
    markers.push({
      id: `person-${person.id}`,
      kind: 'person',
      lat: person.latitude,
      lng: person.longitude,
      label: person.username,
      color: person.isBot ? '#22d3ee' : '#c084fc',
      size: person.isLive ? 0.42 : 0.34,
      person,
    });
  }

  return markers;
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
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useViewport();
  const [size, setSize] = useState({ width: 320, height: 480 });

  const markers = useMemo(() => buildMarkers(salons, lives, people), [salons, lives, people]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const target = userPosition ?? center;
    globeRef.current?.pointOfView(
      { lat: target[0], lng: target[1], altitude: isMobile ? 1.65 : 1.35 },
      900
    );
  }, [center, userPosition, isMobile]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#020208] overflow-hidden">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(2,2,8,0)"
        globeImageUrl={EARTH_TEXTURE}
        bumpImageUrl={BUMP_TEXTURE}
        atmosphereColor="#7c3aed"
        atmosphereAltitude={0.12}
        pointsData={markers}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.02}
        pointRadius="size"
        pointLabel="label"
        onPointClick={(point) => {
          const marker = point as GlobeMarker;
          if (marker.salon) onSelectSalon(marker.salon);
          else if (marker.live) onSelectLive(marker.live);
          else if (marker.person) onSelectPerson?.(marker.person);
        }}
        animateIn
      />
      <div className="pointer-events-none absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/55 border border-purple-500/30 text-[10px] font-bold text-purple-200 uppercase tracking-wide">
        Globe 3D
      </div>
    </div>
  );
}
