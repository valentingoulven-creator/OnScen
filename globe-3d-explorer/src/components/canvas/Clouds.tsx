import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { Mesh } from 'three';
import { CLOUDS_RADIUS, TEXTURE_PATHS } from '../../constants';

/**
 * Fine couche nuageuse semi-transparente légèrement au-dessus de la Terre —
 * technique classique des globes photoréalistes. Tourne un peu plus lentement
 * que la rotation automatique du globe pour un effet de parallaxe subtil.
 */
export function Clouds() {
  const cloudsMap = useTexture(TEXTURE_PATHS.clouds);
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.006;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[CLOUDS_RADIUS, 96, 64]} />
      <meshLambertMaterial map={cloudsMap} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
