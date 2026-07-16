import type { SoundyGlobePoint } from './SoundyGlobeMarkers';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface SoundyGlobeEventMarkersProps {
  points: SoundyGlobePoint[];
  onPointClick: (point: SoundyGlobePoint) => void;
}

/**
 * Chaque marqueur est un overlay DOM (<Html>), pas un draw call GPU comme les
 * sphères instanciées. Les caps amont (GlobeView GLOBE_OVERVIEW_CAP) montent
 * jusqu'à 5000 pour les sphères — sans plafond dédié ici, une zone très dense
 * en événements (festival, métropole) pourrait rendre des centaines d'overlays
 * Html et saccader le scroll/zoom. Voir audit globe/carte.
 */
const MAX_HTML_EVENT_MARKERS = 120;

/**
 * Pins événement globe — icône 📍 dédiée (pas `.map-marker.event`, sinon 26px carte gagne).
 *
 * Pas de `distanceFactor` : sans lui, <Html> garde une taille CSS fixe à l'écran
 * quel que soit le zoom caméra (comme un iconAnchor Leaflet). Avec `distanceFactor`,
 * la taille est mise à l'échelle par la distance caméra → énorme en zoomant (bug).
 * `center` ancre le point exact projeté au centre du bouton — précision constante
 * à tout niveau de zoom, sans hack de transform supplémentaire.
 */
export function SoundyGlobeEventMarkers({ points, onPointClick }: SoundyGlobeEventMarkersProps) {
  const eventPoints = points
    .filter((p) => p.type === 'event')
    .slice(0, MAX_HTML_EVENT_MARKERS);
  if (eventPoints.length === 0) return null;

  return (
    <>
      {eventPoints.map((p, i) => (
        <GlobeFacingHtml
          key={`event-${p.lat}-${p.lng}-${i}`}
          lat={p.lat}
          lng={p.lng}
          zIndexRange={[10, 0]}
          center
        >
          <button
            type="button"
            className="globe-event-marker-hit"
            title={p.label}
            aria-label={p.label}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick(p);
            }}
          >
            <span className="globe-event-pin" aria-hidden="true">
              📍
            </span>
            {p.count && p.count > 1 && (
              <span className="globe-event-cluster-badge">{p.count}</span>
            )}
          </button>
        </GlobeFacingHtml>
      ))}
    </>
  );
}
