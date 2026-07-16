import { useTexture } from '@react-three/drei';
import { EquirectangularReflectionMapping } from 'three';
import { TEXTURE_PATHS } from '../../constants';

/**
 * Fond étoilé — attache directement une texture équirectangulaire en tant que
 * `scene.background` (pas de sphère supplémentaire à gérer/éclairer).
 */
export function Starfield() {
  const starTexture = useTexture(TEXTURE_PATHS.starfield);
  starTexture.mapping = EquirectangularReflectionMapping;
  return <primitive object={starTexture} attach="background" />;
}
