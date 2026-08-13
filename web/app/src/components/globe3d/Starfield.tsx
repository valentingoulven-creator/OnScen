import { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { EquirectangularReflectionMapping } from 'three';
import { getGlobeTexturePaths } from '../../lib/globe3d/constants';

interface StarfieldProps {
  lowPower?: boolean;
}

export function Starfield({ lowPower = false }: StarfieldProps) {
  const textures = getGlobeTexturePaths();
  const starTexture = useTexture(lowPower ? textures.starfieldLow : textures.starfield);
  const { scene } = useThree();

  useEffect(() => {
    starTexture.mapping = EquirectangularReflectionMapping;
    const previous = scene.background;
    scene.background = starTexture;
    return () => {
      scene.background = previous;
    };
  }, [scene, starTexture]);

  return null;
}
