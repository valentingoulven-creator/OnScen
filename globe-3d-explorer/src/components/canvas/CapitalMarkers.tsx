import { Instance, Instances } from '@react-three/drei';
import { CAPITAL_RADIUS } from '../../constants';
import { lonLatToVector3 } from '../../utils/geoMath';
import { WORLD_CAPITALS } from '../../data/worldCapitals';

interface CapitalMarkersProps {
  color: string;
}

/**
 * Marqueurs des capitales mondiales — un seul draw call (InstancedMesh via
 * drei `<Instances>`) pour ~195 points, quel que soit le niveau de zoom.
 */
export function CapitalMarkers({ color }: CapitalMarkersProps) {
  return (
    <Instances limit={WORLD_CAPITALS.length} range={WORLD_CAPITALS.length}>
      <sphereGeometry args={[0.0055, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
      {WORLD_CAPITALS.map((capital) => {
        const pos = lonLatToVector3(capital.lon, capital.lat, CAPITAL_RADIUS);
        return <Instance key={capital.country} position={[pos.x, pos.y, pos.z]} />;
      })}
    </Instances>
  );
}
