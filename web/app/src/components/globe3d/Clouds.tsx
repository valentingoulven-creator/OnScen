import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { Mesh } from 'three';
import {
  CAMERA_MIN_DISTANCE,
  CLOUDS_RADIUS,
  GLOBE_CLOUDS_PARALLAX_SPEED,
  GLOBE_ROTATION_REF_DISTANCE,
  TEXTURE_PATHS,
} from '../../lib/globe3d/constants';

interface CloudsProps {
  /** Parallaxe nuages (idle) — désactivée pendant drag/zoom utilisateur. */
  parallaxActive?: boolean;
}

export function Clouds({ parallaxActive = false }: CloudsProps) {
  const { camera } = useThree();
  const cloudsMap = useTexture(TEXTURE_PATHS.clouds);
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!parallaxActive || !meshRef.current) return;
    const dist = Math.max(camera.position.length(), CAMERA_MIN_DISTANCE);
    const zoomFactor = GLOBE_ROTATION_REF_DISTANCE / dist;
    meshRef.current.rotation.y += delta * GLOBE_CLOUDS_PARALLAX_SPEED * zoomFactor;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[CLOUDS_RADIUS, 96, 64]} />
      <meshLambertMaterial map={cloudsMap} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
