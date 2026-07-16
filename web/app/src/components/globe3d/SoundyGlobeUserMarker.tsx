import type { SoundyGlobePoint } from './SoundyGlobeMarkers';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface SoundyGlobeUserMarkerProps {
  points: SoundyGlobePoint[];
}

/**
 * Marqueur « Ma position » — pastille indigo + halo pulsé (overlay DOM Html),
 * distinct des pins événement (📍) et des pastilles live (rouge).
 */
export function SoundyGlobeUserMarker({ points }: SoundyGlobeUserMarkerProps) {
  const userPoint = points.find((p) => p.type === 'user');
  if (!userPoint) return null;

  return (
    <GlobeFacingHtml
      lat={userPoint.lat}
      lng={userPoint.lng}
      zIndexRange={[20, 0]}
      center
    >
      <div
        className="globe-user-marker"
        role="img"
        title={userPoint.label}
        aria-label={userPoint.label}
      >
        <span className="globe-user-pulse globe-user-pulse--delay" aria-hidden="true" />
        <span className="globe-user-pulse" aria-hidden="true" />
        <span className="globe-user-dot" aria-hidden="true">
          <span className="globe-user-dot-core" />
        </span>
      </div>
    </GlobeFacingHtml>
  );
}
