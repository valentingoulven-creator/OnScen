import { Instances, Instance } from '@react-three/drei';
import { MARKER_SURFACE_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';

export interface SoundyGlobePoint {
  lat: number;
  lng: number;
  type: string;
  color: string;
  radius: number;
  label: string;
  entity?: unknown;
  /** Emoji affiché sur le badge événement (marqueurs 'event' uniquement). */
  icon?: string;
  /** Index jour browse (0–3) pour la couleur du pin événement. */
  dayIndex?: number;
  /** Nombre d'événements regroupés — badge numérique sur l'icône. */
  count?: number;
}

interface SoundyGlobeMarkersProps {
  points: SoundyGlobePoint[];
  resolution: number;
  overviewDots: boolean;
  onPointClick: (point: SoundyGlobePoint) => void;
}

function markerWorldSize(radius: number, overviewDots: boolean): number {
  return radius * (overviewDots ? 1.8 : 2.6);
}

const ICON_MARKER_TYPES = new Set(['event', 'live', 'live-cluster', 'user']);

/**
 * Sphères instanciées — marqueurs sans overlay DOM dédié (event/live/user
 * rendus par SoundyGlobeEventMarkers / SoundyGlobeLiveMarkers / SoundyGlobeUserMarker).
 */
export function SoundyGlobeMarkers({
  points,
  resolution,
  overviewDots,
  onPointClick,
}: SoundyGlobeMarkersProps) {
  const spherePoints = points.filter((p) => !ICON_MARKER_TYPES.has(p.type));
  if (spherePoints.length === 0) return null;

  return (
    <Instances limit={spherePoints.length} range={spherePoints.length}>
      <sphereGeometry args={[1, resolution, resolution]} />
      <meshStandardMaterial toneMapped={false} />
      {spherePoints.map((p, i) => {
        const pos = lonLatToVector3(p.lng, p.lat, MARKER_SURFACE_RADIUS);
        const size = markerWorldSize(p.radius, overviewDots);
        return (
          <Instance
            key={`${p.type}-${p.lat}-${p.lng}-${i}`}
            position={pos}
            scale={size}
            color={p.color}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick(p);
            }}
          />
        );
      })}
    </Instances>
  );
}
