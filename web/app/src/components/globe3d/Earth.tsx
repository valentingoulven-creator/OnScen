import { useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { SRGBColorSpace } from 'three';
import { EARTH_RADIUS, TEXTURE_PATHS } from '../../lib/globe3d/constants';
import { vector3ToLonLat } from '../../lib/globe3d/geoMath';

interface EarthProps {
  useBumpMap: boolean;
  onGlobeDblClick?: (lat: number, lng: number) => void;
}

export function Earth({ useBumpMap, onGlobeDblClick }: EarthProps) {
  const [dayMap, bumpMap, specularMap] = useTexture([
    TEXTURE_PATHS.day,
    TEXTURE_PATHS.bump,
    TEXTURE_PATHS.specular,
  ]);
  dayMap.colorSpace = SRGBColorSpace;
  dayMap.anisotropy = 8;

  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const { lon, lat } = vector3ToLonLat(event.point, EARTH_RADIUS);
    onGlobeDblClick?.(lat, lon);
  };

  return (
    <mesh onDoubleClick={handleDoubleClick}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
      <meshPhongMaterial
        map={dayMap}
        bumpMap={useBumpMap ? bumpMap : undefined}
        bumpScale={useBumpMap ? 0.32 : 0}
        specularMap={specularMap}
        specular="#3a4a66"
        shininess={22}
      />
    </mesh>
  );
}
