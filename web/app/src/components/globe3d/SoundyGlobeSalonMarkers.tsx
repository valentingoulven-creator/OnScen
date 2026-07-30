import type { SoundyGlobePoint } from './SoundyGlobeMarkers';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface SoundyGlobeSalonMarkersProps {
  points: SoundyGlobePoint[];
  onPointClick: (point: SoundyGlobePoint) => void;
}

const MAX_HTML_SALON_MARKERS = 120;

export function SoundyGlobeSalonMarkers({ points, onPointClick }: SoundyGlobeSalonMarkersProps) {
  const salonPoints = points.filter((p) => p.type === 'salon').slice(0, MAX_HTML_SALON_MARKERS);
  if (salonPoints.length === 0) return null;

  return (
    <>
      {salonPoints.map((p, i) => {
        const isLive = Boolean((p.entity as { isLive?: boolean } | undefined)?.isLive);
        return (
          <GlobeFacingHtml
            key={`salon-${p.lat}-${p.lng}-${i}`}
            lat={p.lat}
            lng={p.lng}
            zIndexRange={[10, 0]}
            center
          >
            <button
              type="button"
              className="globe-salon-marker-hit"
              title={p.label}
              aria-label={p.label}
              onClick={(e) => {
                e.stopPropagation();
                onPointClick(p);
              }}
            >
              <span
                className={`globe-salon-dot${isLive ? ' globe-salon-dot--live' : ''}`}
                aria-hidden
              />
            </button>
          </GlobeFacingHtml>
        );
      })}
    </>
  );
}
