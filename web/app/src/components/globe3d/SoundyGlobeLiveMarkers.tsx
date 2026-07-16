import type { SoundyGlobePoint } from './SoundyGlobeMarkers';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface SoundyGlobeLiveMarkersProps {
  points: SoundyGlobePoint[];
  onPointClick: (point: SoundyGlobePoint) => void;
}

const LIVE_TYPES = new Set(['live', 'live-cluster']);

/** Voir commentaire équivalent dans SoundyGlobeEventMarkers (overlay DOM Html). */
const MAX_HTML_LIVE_MARKERS = 120;

/**
 * Icône dédiée aux sessions live (pastille rouge + halo pulsé), même famille
 * visuelle que `.map-marker-overview-dot.live` de la carte plate — cohérent
 * avec le pin 📍 des événements (`SoundyGlobeEventMarkers`) mais distinct.
 *
 * Pas de `distanceFactor` : taille CSS fixe à l'écran quel que soit le zoom
 * caméra (voir commentaire détaillé dans SoundyGlobeEventMarkers).
 */
export function SoundyGlobeLiveMarkers({ points, onPointClick }: SoundyGlobeLiveMarkersProps) {
  const livePoints = points
    .filter((p) => LIVE_TYPES.has(p.type))
    .slice(0, MAX_HTML_LIVE_MARKERS);
  if (livePoints.length === 0) return null;

  return (
    <>
      {livePoints.map((p, i) => (
        <GlobeFacingHtml
          key={`live-${p.lat}-${p.lng}-${i}`}
          lat={p.lat}
          lng={p.lng}
          zIndexRange={[10, 0]}
          center
        >
          <button
            type="button"
            className="globe-live-marker-hit"
            title={p.label}
            aria-label={p.label}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick(p);
            }}
          >
            <span className="globe-live-dot" aria-hidden="true" />
            {p.count && p.count > 1 && (
              <span className="globe-live-cluster-badge">{p.count}</span>
            )}
          </button>
        </GlobeFacingHtml>
      ))}
    </>
  );
}
