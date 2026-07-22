import type { CSSProperties } from 'react';
import { EventDayPinIcon } from './EventDayPinIcon';
import { resolveMapEventMarkerPinColor } from '../lib/mapEventDayColors';
import { SPONSOR_EVENT_ICON } from '../lib/eventType';
import type { MapEventMarker } from '../types';

export type EventMapPinSize = 'compact' | 'md';

const SIZE_PX: Record<EventMapPinSize, number> = {
  compact: 20,
  md: 26,
};

export function EventMapPinIcon({
  marker,
  size = 'md',
  className,
  generic = false,
}: {
  marker?: Pick<MapEventMarker, 'eventDate' | 'eventDates' | 'isSponsored'>;
  size?: EventMapPinSize;
  className?: string;
  /** Pin générique (en-tête de section) sans couleur liée à un événement. */
  generic?: boolean;
}) {
  const px = SIZE_PX[size];
  const isSponsored = Boolean(marker?.isSponsored);
  const pinColor =
    generic || !marker ? undefined : resolveMapEventMarkerPinColor(marker);

  return (
    <span
      className={`map-marker event inline-flex shrink-0 pointer-events-none${
        isSponsored ? ' map-marker--sponso' : ''
      }${className ? ` ${className}` : ''}`}
      style={
        pinColor ? ({ '--event-day-color': pinColor } as CSSProperties) : undefined
      }
      aria-hidden
    >
      <span
        className={`event-marker-icon${
          size === 'compact' ? ' event-marker-icon--compact' : ''
        }`}
      >
        {isSponsored ? (
          <span
            className="event-sponso-pin"
            style={{ fontSize: Math.max(14, Math.round(px * 0.92)) }}
          >
            {SPONSOR_EVENT_ICON}
          </span>
        ) : pinColor ? (
          <EventDayPinIcon pinColor={pinColor} className="event-day-pin" />
        ) : (
          <EventDayPinIcon sectionIndex={0} className="event-day-pin" />
        )}
      </span>
    </span>
  );
}
