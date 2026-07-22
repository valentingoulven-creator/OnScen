import { EventDayPinIcon } from '../EventDayPinIcon';
import { SPONSOR_EVENT_ICON } from '../../lib/eventType';
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
 * Pins événement globe — SVG coloré par jour (pas `.map-marker.event`, sinon 26px carte gagne).
 *
 * Pas de `distanceFactor` : taille CSS fixe à l'écran. Ancrage bas-centre (pointe du pin)
 * aligné sur lat/lng — comme Leaflet `iconAnchor: [24, 26]` sur la carte sombre.
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
        >
          <div className="globe-event-marker-anchor">
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
              {p.isSponsored ? (
                <span className="globe-event-pin globe-event-pin--sponso" aria-hidden>
                  {SPONSOR_EVENT_ICON}
                </span>
              ) : (
                <EventDayPinIcon dayIndex={p.dayIndex ?? 3} className="globe-event-pin" />
              )}
              {p.count && p.count > 1 ? (
                <span className="globe-event-cluster-badge">{p.count}</span>
              ) : null}
            </button>
          </div>
        </GlobeFacingHtml>
      ))}
    </>
  );
}
