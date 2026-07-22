import {
  clampMapEventDayIndex,
  getBrowseSectionDayColor,
  getBrowseSectionDayStroke,
  getMapEventDayColor,
  PIN_SVG_PATH,
} from '../lib/mapEventDayColors';

export function EventDayPinIcon({
  dayIndex,
  sectionIndex,
  className = 'w-4 h-4 shrink-0',
}: {
  dayIndex?: number;
  /** Index dans la liste browse — couleur distincte par section. */
  sectionIndex?: number;
  className?: string;
}) {
  const color =
    sectionIndex != null
      ? getBrowseSectionDayColor(sectionIndex)
      : getMapEventDayColor(clampMapEventDayIndex(dayIndex ?? 0));
  const stroke = getBrowseSectionDayStroke(color);

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path fill={color} stroke={stroke} strokeWidth="1.25" d={PIN_SVG_PATH} />
    </svg>
  );
}
