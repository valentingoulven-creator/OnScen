import { getCalendarDayKey, getNextCalendarDayKeys, MAP_EVENTS_BROWSE_DAY_COUNT } from './feedEvents';
import type { MapEventCityCluster, MapEventMarker } from '../types';

/** Jour 1 vert · jour 2 bleu · jour 3 orange · jour 4 noir (fenêtre browse carte). */
export const MAP_EVENT_DAY_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#171717'] as const;

export type MapEventDayIndex = 0 | 1 | 2 | 3;

export function clampMapEventDayIndex(index: number): MapEventDayIndex {
  if (index <= 0) return 0;
  if (index === 1) return 1;
  if (index === 2) return 2;
  return 3;
}

/** Index 0 = aujourd'hui … 3 = 4e jour de la fenêtre browse. */
export function getMapEventBrowseDayIndex(dayKey: string, from = new Date()): number {
  const keys = getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, from);
  const idx = keys.indexOf(dayKey);
  return idx;
}

export function getMapEventDayColor(dayIndex: number): string {
  return MAP_EVENT_DAY_COLORS[clampMapEventDayIndex(dayIndex)];
}

export function getMapEventDayIndexFromIso(
  iso: string | undefined | null,
  from = new Date()
): MapEventDayIndex {
  if (!iso) return 3;
  const dayKey = getCalendarDayKey(iso);
  if (!dayKey) return 3;
  const idx = getMapEventBrowseDayIndex(dayKey, from);
  return idx >= 0 ? clampMapEventDayIndex(idx) : 3;
}

export function getClusterEventDayIndex(
  cluster: Pick<MapEventCityCluster, 'events'>,
  from = new Date()
): MapEventDayIndex {
  let minIdx: MapEventDayIndex = 3;
  for (const ev of cluster.events) {
    const primary = ev.eventDate ?? ev.eventDates?.[0];
    const idx = getMapEventDayIndexFromIso(primary, from);
    if (idx < minIdx) minIdx = idx;
  }
  return minIdx;
}

export function getMapEventMarkerDayIndex(
  marker: Pick<MapEventMarker, 'eventDate' | 'eventDates'>,
  from = new Date()
): MapEventDayIndex {
  return getMapEventDayIndexFromIso(marker.eventDate ?? marker.eventDates?.[0], from);
}

const PIN_SVG_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z';

/** Pin SVG inline pour marqueurs Leaflet (HTML string). */
export function buildEventDayPinHtml(dayIndex: number, sizePx = 26): string {
  const color = getMapEventDayColor(dayIndex);
  const stroke = dayIndex >= 3 ? 'rgba(255,255,255,0.85)' : '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" stroke="${stroke}" stroke-width="1.25" d="${PIN_SVG_PATH}"/></svg>`;
  const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return `<img src="${src}" class="event-day-pin" width="${sizePx}" height="${sizePx}" alt="" draggable="false" aria-hidden="true" />`;
}

export { PIN_SVG_PATH };
