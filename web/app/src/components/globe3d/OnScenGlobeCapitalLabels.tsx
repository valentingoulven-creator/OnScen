import { Html } from '@react-three/drei';
import { EARTH_RADIUS } from '../../lib/globe3d/constants';
import { lonLatToVector3 } from '../../lib/globe3d/geoMath';
import type { GlobeCapitalLabel } from '../../lib/worldCapitals';

interface OnScenGlobeCapitalLabelsProps {
  labels: GlobeCapitalLabel[];
}

export function OnScenGlobeCapitalLabels({ labels }: OnScenGlobeCapitalLabelsProps) {
  if (labels.length === 0) return null;

  return (
    <>
      {labels.map((cap) => {
        const pos = lonLatToVector3(cap.lng, cap.lat, EARTH_RADIUS * 1.004);
        return (
          <Html
            key={`${cap.lat},${cap.lng}`}
            position={pos}
            distanceFactor={140}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
            zIndexRange={[0, 0]}
          >
            <span className="globe-capital-label">{cap.text}</span>
          </Html>
        );
      })}
    </>
  );
}
