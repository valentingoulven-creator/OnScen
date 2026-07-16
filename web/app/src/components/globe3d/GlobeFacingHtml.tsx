import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ComponentProps } from 'react';
import { Group } from 'three';
import { MARKER_SURFACE_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';
import {
  htmlMarkerSurfaceRadius,
  isGlobePointFacingCamera,
} from '../../lib/globe3d/markerVisibility3d';

type HtmlProps = ComponentProps<typeof Html>;

interface GlobeFacingHtmlProps extends Omit<HtmlProps, 'position' | 'occlude'> {
  lat: number;
  lng: number;
}

/**
 * HTML overlay pinned to the globe surface with hemisphere culling only.
 * Avoids drei `occlude` raycasts that hide all pins at low camera altitude.
 */
export function GlobeFacingHtml({ lat, lng, style, children, ...htmlProps }: GlobeFacingHtmlProps) {
  const groupRef = useRef<Group>(null);
  const visibilityRootRef = useRef<HTMLDivElement>(null);
  const markerPosRef = useRef(
    lonLatToVector3(lng, lat, MARKER_SURFACE_RADIUS * 1.01)
  );

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;

    const surfaceRadius = htmlMarkerSurfaceRadius(camera.position.length());
    markerPosRef.current = lonLatToVector3(lng, lat, surfaceRadius);
    group.position.copy(markerPosRef.current);

    const el = visibilityRootRef.current;
    if (!el) return;
    const facing = isGlobePointFacingCamera(markerPosRef.current, camera.position);
    el.style.visibility = facing ? 'visible' : 'hidden';
    el.style.pointerEvents = facing ? 'auto' : 'none';
  });

  return (
    <group ref={groupRef} position={markerPosRef.current}>
      <Html
        {...htmlProps}
        occlude={false}
        style={{ ...style, pointerEvents: 'auto' }}
      >
        <div ref={visibilityRootRef}>{children}</div>
      </Html>
    </group>
  );
}
