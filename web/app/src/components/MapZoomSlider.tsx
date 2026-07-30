import { memo, useCallback, useRef } from 'react';
import type { MapStyle } from './MapView';
import type { MapZoomMode } from '../lib/mapZoomControl';

interface MapZoomSliderProps {
  value: number;
  mode: MapZoomMode;
  onChange: (norm: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  disabled?: boolean;
  className?: string;
  /** Bascule carte 2D / globe — affiché au-dessus du zoom +. */
  mapStyle?: MapStyle;
  onToggleMapStyle?: () => void;
  mapStyleFlatLabel?: string;
  mapStyleGlobeLabel?: string;
}

const BTN_CLASS =
  'w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-[var(--ms-surface)] border border-[var(--ms-border)] text-indigo-300 hover:border-indigo-500/60 hover:text-indigo-200 shadow-lg active:scale-95 transition shrink-0 disabled:opacity-40';

export const MapZoomSlider = memo(function MapZoomSlider({
  value,
  mode,
  onChange,
  onInteractionStart,
  onInteractionEnd,
  disabled = false,
  className = '',
  mapStyle,
  onToggleMapStyle,
  mapStyleFlatLabel = 'Vue globe satellite',
  mapStyleGlobeLabel = 'Vue carte sombre',
}: MapZoomSliderProps) {
  const draggingRef = useRef(false);

  const clampNorm = (n: number) => Math.max(0, Math.min(1, n));

  const bump = useCallback(
    (delta: number) => {
      if (disabled) return;
      onChange(clampNorm(value + delta));
    },
    [disabled, onChange, value]
  );

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
    onInteractionStart?.();
  }, [onInteractionStart]);

  const endInteraction = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onInteractionEnd?.();
  }, [onInteractionEnd]);

  const label =
    mode === 'globe'
      ? 'Zoom globe'
      : 'Zoom carte';

  const showMapStyleToggle = Boolean(onToggleMapStyle && mapStyle);
  const mapStyleToggleTitle =
    mapStyle === 'globe' ? mapStyleGlobeLabel : mapStyleFlatLabel;

  return (
    <div
      className={`ms-map-zoom-slider flex flex-col items-center gap-1.5 pointer-events-auto ${className}`}
      aria-label={label}
    >
      {showMapStyleToggle ? (
        <button
          type="button"
          onClick={onToggleMapStyle}
          title={mapStyleToggleTitle}
          aria-label={mapStyleToggleTitle}
          className={`${BTN_CLASS} text-sm leading-none ${
            mapStyle === 'globe'
              ? 'border-indigo-500 text-indigo-300'
              : 'hover:border-indigo-500/60 text-white/70 hover:text-white'
          }`}
        >
          {mapStyle === 'globe' ? '🗺️' : '🌐'}
        </button>
      ) : null}

      <button
        type="button"
        disabled={disabled || value >= 1}
        aria-label="Zoom avant"
        className={BTN_CLASS}
        onClick={() => bump(0.08)}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      <div className="ms-map-zoom-slider__track relative flex items-center justify-center py-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(value * 100)}
          disabled={disabled}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={`${Math.round(value * 100)} %`}
          className="ms-map-zoom-slider__range"
          onPointerDown={handlePointerDown}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onBlur={endInteraction}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
        />
      </div>

      <button
        type="button"
        disabled={disabled || value <= 0}
        aria-label="Zoom arrière"
        className={BTN_CLASS}
        onClick={() => bump(-0.08)}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
});
