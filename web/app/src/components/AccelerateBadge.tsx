import { HOLD_ACCELERATE_RATE } from '../hooks/useHoldToAccelerate';

interface AccelerateBadgeProps {
  visible: boolean;
  rate?: number;
  className?: string;
}

/** Badge discret affiché pendant l’accélération au maintien. */
export function AccelerateBadge({ visible, rate = HOLD_ACCELERATE_RATE, className }: AccelerateBadgeProps) {
  if (!visible) return null;
  const label = Number.isInteger(rate) ? `${rate}×` : `${rate.toFixed(1)}×`;
  return (
    <span
      className={
        className ??
        'absolute top-4 right-4 z-20 pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white/90 tabular-nums shadow-sm'
      }
      aria-live="polite"
      aria-label={`Lecture accélérée ${label}`}
    >
      {label}
    </span>
  );
}
