import { useTranslation } from 'react-i18next';

type FeedPostVideoControlsProps = {
  playing: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  compact?: boolean;
};

/** Contrôles pause + son pour lecteurs vidéo du fil. */
export function FeedPostVideoControls({
  playing,
  muted,
  onTogglePlay,
  onToggleMute,
  compact = false,
}: FeedPostVideoControlsProps) {
  const { t } = useTranslation();
  const btnClass = compact
    ? 'w-9 h-9 min-w-9 min-h-9'
    : 'w-11 h-11 min-w-11 min-h-11';

  return (
    <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        className={`${btnClass} flex items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-sm hover:bg-black/75 active:scale-95 transition`}
        aria-label={
          playing
            ? t('feed.videoPause', { defaultValue: 'Pause' })
            : t('feed.videoPlay', { defaultValue: 'Lecture' })
        }
      >
        <span aria-hidden className={compact ? 'text-sm' : 'text-base'}>
          {playing ? '⏸' : '▶'}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className={`${btnClass} flex items-center justify-center rounded-full bg-black/60 text-white border border-white/20 backdrop-blur-sm hover:bg-black/75 active:scale-95 transition`}
        aria-label={
          muted
            ? t('feed.videoUnmute', { defaultValue: 'Activer le son' })
            : t('feed.videoMute', { defaultValue: 'Couper le son' })
        }
        aria-pressed={!muted}
      >
        <span aria-hidden className={compact ? 'text-sm' : 'text-base'}>
          {muted ? '🔇' : '🔊'}
        </span>
      </button>
    </div>
  );
}
