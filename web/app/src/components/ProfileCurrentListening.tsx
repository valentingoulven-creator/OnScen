import { PlatformListeningIcon } from './PlatformListeningIcon';
import { formatCompactCount } from '../lib/formatCount';
import type { CurrentListening } from '../types';

export type ProfileListeningVariant = 'default' | 'live' | 'salon';

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
  /** Profil : carte live ou salon (CTA mis en avant). */
  variant?: ProfileListeningVariant;
  viewersCount?: number;
  /** Libellé du bouton d’action à droite (ex. « Rejoindre »). */
  actionLabel?: string;
}

function LivePulseDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className}`} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function SessionActionPill({
  label,
  tone,
}: {
  label: string;
  tone: 'live' | 'salon';
}) {
  const live = tone === 'live';
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full text-xs font-bold ${
        live
          ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
          : 'bg-purple-600/90 text-white shadow-md shadow-purple-900/30'
      }`}
    >
      {label}
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </span>
  );
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
  variant = 'default',
  viewersCount,
  actionLabel,
}: ProfileCurrentListeningProps) {
  const paused = showPaused && listening.isPlaying === false;
  const statusLabel = paused ? statusPausedLabel : statusActiveLabel;
  const useSessionCard = Boolean(onClick && !mapChip && !compact && (variant === 'live' || variant === 'salon'));

  if (useSessionCard && variant === 'live') {
    const artSize = 'w-14 h-14 sm:w-16 sm:h-16';
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={clickAriaLabel}
        className="group w-full min-h-[44px] flex items-center gap-3 sm:gap-3.5 rounded-2xl border border-red-500/35 bg-gradient-to-br from-red-950/90 via-[#141018] to-rose-950/50 p-3 sm:p-3.5 text-left cursor-pointer transition active:scale-[0.99] hover:border-red-400/50 hover:shadow-lg hover:shadow-red-950/40"
      >
        <div className="relative shrink-0">
          {listening.albumArtUrl ? (
            <img
              src={listening.albumArtUrl}
              alt=""
              className={`rounded-xl object-cover ring-2 ring-red-500/40 ${artSize}`}
            />
          ) : (
            <div
              className={`rounded-xl bg-[#1e1e2f] flex items-center justify-center text-lg ring-2 ring-red-500/40 ${artSize}`}
              aria-hidden
            >
              🎵
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0b0b0f] ring-1 ring-red-500/50">
            <LivePulseDot />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <LivePulseDot className="h-1.5 w-1.5 [&_span]:h-1.5 [&_span]:w-1.5 [&_span:last-child]:h-1.5 [&_span:last-child]:w-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">{statusLabel}</span>
            {viewersCount != null && viewersCount > 0 ? (
              <span className="text-[10px] font-semibold text-red-200/70">
                · {formatCompactCount(viewersCount)} spectateurs
              </span>
            ) : null}
          </div>
          <p className="font-bold text-white truncate text-sm sm:text-base leading-snug">{listening.title}</p>
          <p className="text-xs sm:text-sm text-red-100/60 truncate">{listening.artist}</p>
        </div>
        {actionLabel ? <SessionActionPill label={actionLabel} tone="live" /> : null}
      </button>
    );
  }

  if (useSessionCard && variant === 'salon') {
    const artSize = 'w-14 h-14 sm:w-16 sm:h-16';
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={clickAriaLabel}
        className="group w-full min-h-[44px] flex items-center gap-3 sm:gap-3.5 rounded-2xl border border-purple-500/35 bg-gradient-to-br from-purple-950/80 via-[#12121a] to-[#16162a] p-3 sm:p-3.5 text-left cursor-pointer transition active:scale-[0.99] hover:border-purple-400/45 hover:shadow-lg hover:shadow-purple-950/30"
      >
        {listening.albumArtUrl ? (
          <img
            src={listening.albumArtUrl}
            alt=""
            className={`rounded-xl object-cover shrink-0 ring-2 ring-purple-500/30 ${artSize}`}
          />
        ) : (
          <div
            className={`rounded-xl shrink-0 bg-[#1e1e2f] flex items-center justify-center text-lg ring-2 ring-purple-500/30 ${artSize}`}
            aria-hidden
          >
            🎵
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">{statusLabel}</p>
          <p className="font-bold text-white truncate text-sm sm:text-base leading-snug">{listening.title}</p>
          <p className="text-xs sm:text-sm text-[#8b8baf] truncate">{listening.artist}</p>
        </div>
        {actionLabel ? (
          <SessionActionPill label={actionLabel} tone="salon" />
        ) : (
          <PlatformListeningIcon platform={listening.platform} size="md" />
        )}
      </button>
    );
  }

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
          {statusLabel}
        </p>
        <p
          className={`font-semibold text-white truncate ${
            mapChip ? 'text-xs leading-snug' : compact ? 'text-sm' : 'text-base'
          }`}
        >
          {listening.title}
        </p>
        {!mapChip && (
          <p className={`text-[#8b8baf] truncate ${compact ? 'text-xs' : 'text-sm'}`}>{listening.artist}</p>
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
