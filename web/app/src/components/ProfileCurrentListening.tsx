import { PlatformListeningIcon } from './PlatformListeningIcon';
import type { CurrentListening } from '../types';

interface ProfileCurrentListeningProps {
  listening: CurrentListening;
  /** Affiche « En pause » si la lecture est arrêtée. */
  showPaused?: boolean;
  compact?: boolean;
  /** Chip carte mobile — plus petit, sans icône plateforme. */
  mapChip?: boolean;
  /** Salon actif : ouvre le salon au clic. */
  onClick?: () => void;
  clickAriaLabel?: string;
  /** Remplace « En écoute » / « En pause » (ex. live : « En direct »). */
  statusActiveLabel?: string;
  statusPausedLabel?: string;
  statusLabelClassName?: string;
}

export function ProfileCurrentListening({
  listening,
  showPaused = true,
  compact = false,
  mapChip = false,
  onClick,
  clickAriaLabel = 'Ouvrir le salon',
  statusActiveLabel = 'En écoute',
  statusPausedLabel = 'En pause',
  statusLabelClassName = 'text-purple-400',
}: ProfileCurrentListeningProps) {
  const paused = showPaused && listening.isPlaying === false;

  const pad = mapChip ? 'p-1.5' : compact ? 'p-2.5' : 'p-3';
  const artSize = mapChip ? 'w-8 h-8' : compact ? 'w-11 h-11' : 'w-14 h-14';
  const gap = mapChip ? 'gap-2' : 'gap-3';
  const className = `flex items-center ${gap} rounded-xl border border-purple-500/25 bg-purple-950/30 ${pad}${
    onClick
      ? ' cursor-pointer hover:border-purple-400/45 hover:bg-purple-950/45 transition-colors w-full text-left'
      : ''
  }`;

  const content = (
    <>
      {listening.albumArtUrl ? (
        <img
          src={listening.albumArtUrl}
          alt=""
          className={`rounded-lg object-cover shrink-0 ring-1 ring-white/10 ${artSize}`}
        />
      ) : (
        <div
          className={`rounded-lg shrink-0 bg-[#1e1e2f] flex items-center justify-center ${
            mapChip ? 'text-sm' : 'text-lg'
          } ${artSize}`}
          aria-hidden
        >
          🎵
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`font-bold uppercase tracking-wider ${statusLabelClassName} ${
            mapChip ? 'text-[9px] leading-tight' : 'text-[10px]'
          }`}
        >
          {paused ? statusPausedLabel : statusActiveLabel}
        </p>
        <p
          className={`font-semibold text-white truncate ${
            mapChip ? 'text-xs leading-snug' : compact ? 'text-sm' : 'text-base'
          }`}
        >
          {listening.title}
        </p>
        {!mapChip && (
          <p className={`text-[#8b8baf] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {listening.artist}
          </p>
        )}
      </div>
      {!mapChip && <PlatformListeningIcon platform={listening.platform} size={compact ? 'sm' : 'md'} />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={clickAriaLabel}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
