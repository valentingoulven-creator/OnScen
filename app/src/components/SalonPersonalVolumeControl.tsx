import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SalonPersonalVolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  /** Barre théâtre compacte — bouton + panneau flottant. */
  compact?: boolean;
  buttonClassName?: string;
}

export function SalonPersonalVolumeControl({
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
  compact = false,
  buttonClassName = 'px-2.5 py-1 rounded-full border border-white/10 bg-[#131318] text-xs font-medium text-[#8b8baf] hover:bg-white/5 hover:text-white transition shrink-0',
}: SalonPersonalVolumeControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  const toggleMute = () => onMutedChange(!muted);

  const slider = (
    <input
      type="range"
      min={0}
      max={100}
      value={muted ? 0 : volume}
      onChange={(e) => {
        const v = Number(e.target.value);
        onVolumeChange(v);
        if (v > 0) onMutedChange(false);
      }}
      className="w-full min-w-0 accent-purple-500 h-1"
      aria-label={t('salon.personalVolume.label')}
    />
  );

  if (compact) {
    return (
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${buttonClassName} touch-manipulation${open ? ' border-purple-500/40 text-purple-200' : ''}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('salon.personalVolume.open')}
          title={t('salon.personalVolume.hint')}
        >
          <span aria-hidden>{muted || volume === 0 ? '🔇' : '🔊'}</span>
          <span className="sr-only">{t('salon.personalVolume.label')}</span>
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label={t('salon.personalVolume.label')}
            className="absolute bottom-[calc(100%+0.5rem)] left-0 z-[80] w-[min(100vw-2rem,14rem)] rounded-xl border border-[#2d2d3d] bg-[#14141c]/98 backdrop-blur-md shadow-xl p-3 space-y-2.5"
          >
            <div>
              <p className="text-[11px] font-semibold text-white">{t('salon.personalVolume.label')}</p>
              <p className="text-[10px] text-gray-500 leading-snug mt-0.5">
                {t('salon.personalVolume.hint')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-white/10 bg-[#131318] text-xs text-[#8b8baf] hover:text-white transition"
                aria-label={muted ? t('salon.personalVolume.unmute') : t('salon.personalVolume.mute')}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <div className="flex-1 min-w-0 pt-0.5">{slider}</div>
              <span className="text-[10px] font-mono tabular-nums text-gray-400 w-7 text-right shrink-0">
                {muted ? 0 : volume}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-0 shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={toggleMute}
          className={buttonClassName}
          aria-label={muted ? t('salon.personalVolume.unmute') : t('salon.personalVolume.mute')}
          title={t('salon.personalVolume.hint')}
        >
          {muted ? t('salon.personalVolume.muteShort') : t('salon.personalVolume.unmuteShort')}
        </button>
        {slider}
        <span className="text-[10px] font-mono tabular-nums text-gray-400 w-7 text-right shrink-0">
          {muted ? 0 : volume}
        </span>
      </div>
      <p className="text-[9px] text-gray-500 leading-snug">{t('salon.personalVolume.hint')}</p>
    </div>
  );
}
