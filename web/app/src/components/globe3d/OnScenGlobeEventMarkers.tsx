import { EventDayPinIcon } from '../EventDayPinIcon';
import { SPONSOR_EVENT_ICON } from '../../lib/eventType';
import { devMarkerRefFromEventEntity } from '../../lib/devMapMarkerDrag';
import type { MapEventCityCluster, MapEventMarker } from '../../types';
import type { OnScenGlobePoint } from './OnScenGlobeMarkers';
import { DevDraggableGlobeHtmlMarker } from './DevDraggableGlobeMarker';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface OnScenGlobeEventMarkersProps {
  points: OnScenGlobePoint[];
  onPointClick: (point: OnScenGlobePoint) => void;
}

const MAX_HTML_EVENT_MARKERS = 120;

function EventMarkerContent({
  p,
  onPointClick,
  drag,
}: {
  p: OnScenGlobePoint;
  onPointClick: (point: OnScenGlobePoint) => void;
  drag?: {
    onPointerDown: (event: React.PointerEvent) => void;
    devDragClassName?: string;
  };
}) {
  return (
    <div className="globe-event-marker-anchor">
      <button
        type="button"
        className={`globe-event-marker-hit${drag?.devDragClassName ? ` ${drag.devDragClassName}` : ''}`}
        title={p.label}
        aria-label={p.label}
        onPointerDown={drag?.onPointerDown}
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
  );
}

export function OnScenGlobeEventMarkers({ points, onPointClick }: OnScenGlobeEventMarkersProps) {
  const eventPoints = points
    .filter((p) => p.type === 'event')
    .slice(0, MAX_HTML_EVENT_MARKERS);
  if (eventPoints.length === 0) return null;

  return (
    <>
      {eventPoints.map((p, i) => {
        const markerRef = devMarkerRefFromEventEntity(
          p.entity as MapEventMarker | MapEventCityCluster | undefined
        );
        const htmlProps = { zIndexRange: [10, 0] as [number, number] };

        if (markerRef) {
          return (
            <DevDraggableGlobeHtmlMarker
              key={`event-${markerRef.id}-${i}`}
              markerRef={markerRef}
              lat={p.lat}
              lng={p.lng}
              {...htmlProps}
            >
              {(drag) => <EventMarkerContent p={p} onPointClick={onPointClick} drag={drag} />}
            </DevDraggableGlobeHtmlMarker>
          );
        }

        return (
          <GlobeFacingHtml key={`event-${p.lat}-${p.lng}-${i}`} lat={p.lat} lng={p.lng} {...htmlProps}>
            <EventMarkerContent p={p} onPointClick={onPointClick} />
          </GlobeFacingHtml>
        );
      })}
    </>
  );
}
