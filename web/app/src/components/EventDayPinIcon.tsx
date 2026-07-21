import { clampMapEventDayIndex, getMapEventDayColor, PIN_SVG_PATH } from '../lib/mapEventDayColors';

export function EventDayPinIcon({
  dayIndex,
  className = 'w-4 h-4 shrink-0',
}: {
  dayIndex: number;
  className?: string;
}) {
  const idx = clampMapEventDayIndex(dayIndex);
  const color = getMapEventDayColor(idx);
  const stroke = idx >= 3 ? 'rgba(255,255,255,0.85)' : '#ffffff';

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
