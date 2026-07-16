import { useRef } from 'react';
import { useTexture } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { SRGBColorSpace, type Vector3 } from 'three';
import { EARTH_RADIUS, TEXTURE_PATHS } from '../../constants';
import { vector3ToLonLat } from '../../utils/geoMath';
import { isPointInAnyPolygon } from '../../utils/pointInPolygon';
import type { PreparedCountry } from '../../types';

interface EarthProps {
  countries: PreparedCountry[];
  onHoverCountry: (country: PreparedCountry | null) => void;
  onSelectCountry: (country: PreparedCountry) => void;
  /** Position écran du curseur (pour positionner l'infobulle en DOM). */
  onPointerScreenPosition: (clientX: number, clientY: number) => void;
}

/**
 * Sphère Terre "de jour" : texture diffuse haute résolution + relief (bump map)
 * + carte spéculaire (léger reflet sur les océans). Porte aussi les interactions
 * souris/tactile : survol et clic déterminent le pays sous le curseur via un test
 * point-dans-polygone sur les coordonnées géographiques du point d'intersection.
 */
export function Earth({ countries, onHoverCountry, onSelectCountry, onPointerScreenPosition }: EarthProps) {
  const [dayMap, bumpMap, specularMap] = useTexture([
    TEXTURE_PATHS.day,
    TEXTURE_PATHS.bump,
    TEXTURE_PATHS.specular,
  ]);
  dayMap.colorSpace = SRGBColorSpace;
  dayMap.anisotropy = 8;

  /** Évite de recalculer / notifier le pays survolé s'il n'a pas changé (perf). */
  const hoveredNameRef = useRef<string | null>(null);

  function findCountryAtPoint(point: Vector3): PreparedCountry | null {
    if (countries.length === 0) return null;
    const { lon, lat } = vector3ToLonLat(point, EARTH_RADIUS);
    for (const country of countries) {
      if (isPointInAnyPolygon(lon, lat, country.polygons)) return country;
    }
    return null;
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onPointerScreenPosition(event.nativeEvent.clientX, event.nativeEvent.clientY);

    const found = findCountryAtPoint(event.point);
    const foundName = found?.name ?? null;
    if (foundName !== hoveredNameRef.current) {
      hoveredNameRef.current = foundName;
      onHoverCountry(found);
    }
  };

  const handlePointerOut = () => {
    if (hoveredNameRef.current !== null) {
      hoveredNameRef.current = null;
      onHoverCountry(null);
    }
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const found = findCountryAtPoint(event.point);
    if (found) onSelectCountry(found);
  };

  return (
    <mesh onPointerMove={handlePointerMove} onPointerOut={handlePointerOut} onClick={handleClick}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
      <meshPhongMaterial
        map={dayMap}
        bumpMap={bumpMap}
        bumpScale={0.006}
        specularMap={specularMap}
        specular="#33405c"
        shininess={10}
      />
    </mesh>
  );
}
