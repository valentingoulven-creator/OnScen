import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { MARKER_SURFACE_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';

export interface OnScenGlobeRing {
  lat: number;
  lng: number;
}

interface OnScenGlobeRingsProps {
  rings: OnScenGlobeRing[];
  maxRadius: number;
  propagationSpeed: number;
  repeatPeriod: number;
}

function LiveRingMesh({
  lat,
  lng,
  maxRadius,
  propagationSpeed,
  repeatPeriod,
  phaseOffset,
}: {
  lat: number;
  lng: number;
  maxRadius: number;
  propagationSpeed: number;
  repeatPeriod: number;
  phaseOffset: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const normal = useMemo(() => lonLatToVector3(lng, lat, 1).normalize(), [lat, lng]);
  const position = useMemo(() => lonLatToVector3(lng, lat, MARKER_SURFACE_RADIUS), [lat, lng]);
  const quaternion = useMemo(() => {
    const q = new Quaternion();
    q.setFromUnitVectors(new Vector3(0, 0, 1), normal);
    return q;
  }, [normal]);
  const baseSize = 2.2;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t =
      ((state.clock.elapsedTime * 1000 + phaseOffset) % repeatPeriod) / repeatPeriod;
    const scale = 1 + t * maxRadius * propagationSpeed * 0.35;
    mesh.scale.setScalar(scale);
    const mat = mesh.material as MeshBasicMaterial;
    mat.opacity = (1 - t) * 0.72;
  });

  return (
    <mesh ref={meshRef} position={position} quaternion={quaternion}>
      <ringGeometry args={[baseSize, baseSize * 1.18, 32]} />
      <meshBasicMaterial
        color="#f87171"
        transparent
        opacity={0.72}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function OnScenGlobeRings({
  rings,
  maxRadius,
  propagationSpeed,
  repeatPeriod,
}: OnScenGlobeRingsProps) {
  if (rings.length === 0) return null;

  return (
    <>
      {rings.map((ring, i) => (
        <LiveRingMesh
          key={`${ring.lat},${ring.lng},${i}`}
          lat={ring.lat}
          lng={ring.lng}
          maxRadius={maxRadius}
          propagationSpeed={propagationSpeed}
          repeatPeriod={repeatPeriod}
          phaseOffset={(i * repeatPeriod) / Math.max(rings.length, 1)}
        />
      ))}
    </>
  );
}
