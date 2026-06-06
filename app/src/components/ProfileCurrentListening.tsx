import { PlatformListeningIcon } from './PlatformListeningIcon';
import type { CurrentListening } from '../types';

interface ProfileCurrentListeningProps {
  listening: CurrentListening;
  /** Affiche « En pause » si la lecture est arrêtée. */
  showPaused?: boolean;
  compact?: boolean;
}

export function ProfileCurrentListening({
  listening,
  showPaused = true,
  compact = false,
}: ProfileCurrentListeningProps) {
  const paused = showPaused && listening.isPlaying === false;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-950/30 ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      {listening.albumArtUrl ? (
        <img
          src={listening.albumArtUrl}
          alt=""
          className={`rounded-lg object-cover shrink-0 ring-1 ring-white/10 ${
            compact ? 'w-11 h-11' : 'w-14 h-14'
          }`}
        />
      ) : (
        <div
          className={`rounded-lg shrink-0 bg-[#1e1e2f] flex items-center justify-center text-lg ${
            compact ? 'w-11 h-11' : 'w-14 h-14'
          }`}
          aria-hidden
        >
          🎵
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
          {paused ? 'En pause' : 'En écoute'}
        </p>
        <p className={`font-semibold text-white truncate ${compact ? 'text-sm' : 'text-base'}`}>
          {listening.title}
        </p>
        <p className={`text-[#8b8baf] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {listening.artist}
        </p>
      </div>
      <PlatformListeningIcon platform={listening.platform} size={compact ? 'sm' : 'md'} />
    </div>
  );
}
