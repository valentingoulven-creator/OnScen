import { Instances, Instance } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { MARKER_SURFACE_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';
import { isGlobePointFacingCamera } from '../../lib/globe3d/markerVisibility3d';

export interface OnScenGlobePoint {
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
  /** Événement sponsorisé sidebar — pin ✨ (Html overlay). */
  isSponsored?: boolean;
  /** Nombre d'événements regroupés — badge numérique sur l'icône. */
  count?: number;
}

interface OnScenGlobeMarkersProps {
  points: OnScenGlobePoint[];
  resolution: number;
  overviewDots: boolean;
  onPointClick: (point: OnScenGlobePoint) => void;
}

function markerWorldSize(radius: number, overviewDots: boolean): number {
  return radius * (overviewDots ? 1.8 : 2.6);
}

const ICON_MARKER_TYPES = new Set(['event', 'live', 'live-cluster', 'user', 'salon']);

function FacingSphereInstance({
  point,
  size,
  onPointClick,
}: {
  point: OnScenGlobePoint;
  size: number;
  onPointClick: (point: OnScenGlobePoint) => void;
}) {
  const groupRef = useRef<Group>(null);
  const markerPosRef = useRef(lonLatToVector3(point.lng, point.lat, MARKER_SURFACE_RADIUS));

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    markerPosRef.current = lonLatToVector3(point.lng, point.lat, MARKER_SURFACE_RADIUS);
    group.position.copy(markerPosRef.current);
    const facing = isGlobePointFacingCamera(markerPosRef.current, camera.position);
    group.visible = facing;
  });

  return (
    <group ref={groupRef} position={markerPosRef.current}>
      <mesh
        scale={size}
        onClick={(e) => {
          e.stopPropagation();
          onPointClick(point);
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color={point.color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Sphères — marqueurs sans overlay DOM (event/live/salon/user via composants dédiés).
 * Masque l'hémisphère arrière (comme GlobeFacingHtml).
 */
export function OnScenGlobeMarkers({
  points,
  resolution,
  overviewDots,
  onPointClick,
}: OnScenGlobeMarkersProps) {
  const spherePoints = useMemo(
    () => points.filter((p) => !ICON_MARKER_TYPES.has(p.type)),
    [points]
  );
  if (spherePoints.length === 0) return null;

  if (spherePoints.length <= 120) {
    return (
      <>
        {spherePoints.map((p, i) => (
          <FacingSphereInstance
            key={`${p.type}-${p.lat}-${p.lng}-${i}`}
            point={p}
            size={markerWorldSize(p.radius, overviewDots)}
            onPointClick={onPointClick}
          />
        ))}
      </>
    );
  }

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
