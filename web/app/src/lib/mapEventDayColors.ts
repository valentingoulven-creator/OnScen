import {
  getCalendarDayKey,
  getNextCalendarDayKeys,
  MAP_EVENTS_BROWSE_DAY_COUNT,
  resolvePostBrowseDayKey,
} from './feedEvents';
import { SPONSOR_EVENT_ICON } from './eventType';
import type { MapEventCityCluster, MapEventMarker } from '../types';

/** Jour 1 vert · jour 2 bleu · jour 3 orange · jour 4 noir (fenêtre browse carte). */
export const MAP_EVENT_DAY_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#171717'] as const;

/** Palette sidebar browse : une couleur distincte par section jour (cycle si plage longue). */
export const MAP_EVENT_BROWSE_SECTION_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#171717',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
] as const;

const MAP_EVENT_DARK_PIN_COLORS = new Set<string>(['#171717']);

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

/** Couleur pin section browse (index 0 = 1re section affichée). */
export function getBrowseSectionDayColor(sectionIndex: number): string {
  const i = Math.max(0, Math.floor(sectionIndex));
  return MAP_EVENT_BROWSE_SECTION_COLORS[i % MAP_EVENT_BROWSE_SECTION_COLORS.length]!;
}

export function getBrowseSectionDayStroke(color: string): string {
  return MAP_EVENT_DARK_PIN_COLORS.has(color.toLowerCase())
    ? 'rgba(255,255,255,0.85)'
    : '#ffffff';
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

export function getMapEventCalendarDayKey(
  marker: Pick<MapEventMarker, 'eventDate' | 'eventDates'>
): string | null {
  const primary = marker.eventDate ?? marker.eventDates?.[0];
  if (!primary) return null;
  return getCalendarDayKey(primary);
}

export function getClusterCalendarDayKey(
  cluster: Pick<MapEventCityCluster, 'events'>
): string | null {
  let earliest: string | null = null;
  for (const ev of cluster.events) {
    const key = getMapEventCalendarDayKey(ev);
    if (!key) continue;
    if (!earliest || key < earliest) earliest = key;
  }
  return earliest;
}

export function getDefaultMapEventBrowseDayKeys(from = new Date()): string[] {
  return getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, from);
}

export interface ResolveMapEventPinColorOptions {
  /** Aligné browse Autour (posts carte hors fenêtre strict). */
  fallbackNearestDay?: boolean;
}

function resolveBrowseSectionColorForDayKey(
  dayKey: string | null | undefined,
  browseDayKeys: readonly string[]
): string | null {
  if (!dayKey) return null;
  const idx = browseDayKeys.indexOf(dayKey);
  return idx >= 0 ? getBrowseSectionDayColor(idx) : null;
}

/** Couleur pin carte / halo — alignée sur les sections browse sidebar. */
export function resolveMapEventPinColor(
  dayKey: string | null | undefined,
  browseDayKeys?: readonly string[],
  opts?: ResolveMapEventPinColorOptions
): string {
  const keys = browseDayKeys?.length
    ? browseDayKeys
    : getDefaultMapEventBrowseDayKeys();
  const fromBrowse = resolveBrowseSectionColorForDayKey(dayKey, keys);
  if (fromBrowse) return fromBrowse;
  if (dayKey && opts?.fallbackNearestDay) {
    const nearest = resolvePostBrowseDayKey(
      { eventDate: `${dayKey}T12:00:00`, eventDates: [`${dayKey}T12:00:00`] },
      [...keys],
      { fallbackNearestDay: true }
    );
    const fromNearest = resolveBrowseSectionColorForDayKey(nearest, keys);
    if (fromNearest) return fromNearest;
  }
  if (dayKey) {
    const idx = getMapEventBrowseDayIndex(dayKey);
    if (idx >= 0) return getBrowseSectionDayColor(idx);
  }
  return getBrowseSectionDayColor(3);
}

/** Couleur pin pour un marqueur (toutes les dates d’occurrence, comme le browse). */
export function resolveMapEventMarkerPinColor(
  marker: Pick<MapEventMarker, 'eventDate' | 'eventDates'>,
  browseDayKeys?: readonly string[],
  opts?: ResolveMapEventPinColorOptions
): string {
  const keys = browseDayKeys?.length
    ? [...browseDayKeys]
    : getDefaultMapEventBrowseDayKeys();
  const dayKey = resolvePostBrowseDayKey(marker, keys, opts);
  if (dayKey) {
    const fromBrowse = resolveBrowseSectionColorForDayKey(dayKey, keys);
    if (fromBrowse) return fromBrowse;
  }
  return resolveMapEventPinColor(getMapEventCalendarDayKey(marker), keys, opts);
}

/** Couleur pin cluster (occurrence la plus tôt dans la fenêtre browse). */
export function resolveClusterMapPinColor(
  cluster: Pick<MapEventCityCluster, 'events'>,
  browseDayKeys?: readonly string[],
  opts?: ResolveMapEventPinColorOptions
): string {
  const keys = browseDayKeys?.length
    ? [...browseDayKeys]
    : getDefaultMapEventBrowseDayKeys();
  let bestIdx: number | null = null;
  for (const ev of cluster.events) {
    const dayKey = resolvePostBrowseDayKey(ev, keys, opts);
    if (!dayKey) continue;
    const idx = keys.indexOf(dayKey);
    if (idx >= 0 && (bestIdx === null || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx !== null) return getBrowseSectionDayColor(bestIdx);
  return resolveMapEventPinColor(getClusterCalendarDayKey(cluster), keys, opts);
}

const PIN_SVG_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z';

/** Pin SVG inline pour marqueurs Leaflet (HTML string). */
export function buildEventDayPinHtml(
  dayIndexOrColor: number | string,
  sizePx = 26
): string {
  const color =
    typeof dayIndexOrColor === 'string'
      ? dayIndexOrColor
      : getMapEventDayColor(dayIndexOrColor);
  const stroke = getBrowseSectionDayStroke(color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" stroke="${stroke}" stroke-width="1.25" d="${PIN_SVG_PATH}"/></svg>`;
  const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return `<img src="${src}" class="event-day-pin" width="${sizePx}" height="${sizePx}" alt="" draggable="false" aria-hidden="true" />`;
}

/** Pin ✨ pour événements sponsorisés (carte Leaflet). */
export function buildSponsorEventPinHtml(sizePx = 26): string {
  const fontSize = Math.max(16, Math.round(sizePx * 0.92));
  return `<span class="event-sponso-pin" style="font-size:${fontSize}px" aria-hidden="true">${SPONSOR_EVENT_ICON}</span>`;
}

export function resolveClusterMapPinSponsored(
  cluster: Pick<MapEventCityCluster, 'events'>
): boolean {
  if (cluster.events.length === 0) return false;
  if (cluster.events.length === 1) return Boolean(cluster.events[0]?.isSponsored);
  return cluster.events.every((ev) => ev.isSponsored);
}

export function resolveEventMapPinHtml(opts: {
  dayIndex?: number;
  pinColor?: string;
  isSponsored?: boolean;
  sizePx?: number;
}): string {
  if (opts.isSponsored) return buildSponsorEventPinHtml(opts.sizePx);
  const color = opts.pinColor ?? getMapEventDayColor(opts.dayIndex ?? 3);
  return buildEventDayPinHtml(color, opts.sizePx);
}

export { PIN_SVG_PATH };
