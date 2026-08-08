import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { MARKER_SURFACE_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';
import { circleLatLngRing } from '../../lib/geoCircle';

export type GlobeLivesRadiusKind = 'reference' | 'viewport';

const STROKE: Record<GlobeLivesRadiusKind, string> = {
  reference: '#f87171',
  viewport: '#c084fc',
};

interface OnScenGlobeQueryRadiusRingProps {
  lat: number;
  lng: number;
  radiusKm: number;
  kind?: GlobeLivesRadiusKind;
}

/** Contour géodésique uniquement (pas de remplissage — évite de masquer la Terre sur grands rayons). */
export function OnScenGlobeQueryRadiusRing({
  lat,
  lng,
  radiusKm,
  kind = 'viewport',
}: OnScenGlobeQueryRadiusRingProps) {
  const surfaceRadius = MARKER_SURFACE_RADIUS * 1.003;

  const lineGeometry = useMemo(() => {
    const segments = radiusKm >= 2000 ? 128 : 96;
    const ring = circleLatLngRing(lat, lng, radiusKm, segments);
    if (ring.length < 2) return null;
    const positions = new Float32Array(ring.length * 3);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const v = lonLatToVector3(p.lon, p.lat, surfaceRadius);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, [lat, lng, radiusKm, surfaceRadius]);

  useEffect(() => () => lineGeometry?.dispose(), [lineGeometry]);

  if (!lineGeometry) return null;

  return (
    <lineLoop geometry={lineGeometry} renderOrder={kind === 'viewport' ? 5 : 6}>
      <lineBasicMaterial
        color={STROKE[kind]}
        transparent
        opacity={kind === 'viewport' ? 0.88 : 0.92}
        depthTest
        depthWrite={false}
      />
    </lineLoop>
  );
}
