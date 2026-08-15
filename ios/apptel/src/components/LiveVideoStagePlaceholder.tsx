/**
 * Override mobile — bouton Quitter dans le flux (plus d'absolute),
 * pour que le haut du placeholder live ne soit plus coupé.
 */
import type { ReactNode } from 'react';

import './LiveVideoStagePlaceholder.css';

export type LiveVideoStagePlaceholderProps = {
  title: string;
  artist?: string;
  albumArtUrl?: string;
  loading?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  topTrailing?: ReactNode;
  className?: string;
};

export function LiveVideoStagePlaceholder({
  title,
  artist,
  albumArtUrl,
  loading = false,
  icon,
  badge,
  footer,
  topTrailing,
  className = '',
}: LiveVideoStagePlaceholderProps) {
  return (
    <div
      className={`live-video-stage-overlay live-video-stage-overlay--theater live-video-stage-overlay--apptel relative z-0${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {albumArtUrl ? (
        <div
          className="live-video-stage-overlay__bg"
          style={{ backgroundImage: `url(${albumArtUrl})` }}
          aria-hidden
        />
      ) : null}
      <div className="live-video-stage-overlay__scrim" aria-hidden />

      {topTrailing ? (
        <div className="live-video-stage-overlay__top-bar">{topTrailing}</div>
      ) : (
        <div className="live-video-stage-overlay__top-bar" aria-hidden />
      )}

      <div className="live-video-stage-overlay__body">
        <div className="live-video-stage-overlay__card">
          {badge ? <div className="live-video-stage-overlay__badge">{badge}</div> : null}

          {icon ? (
            <div className="live-video-stage-overlay__icon-ring">{icon}</div>
          ) : (
            <div className="live-video-stage-overlay__art-ring">
              {albumArtUrl ? (
                <img src={albumArtUrl} alt="" className="live-video-stage-overlay__art" />
              ) : (
                <div className="live-video-stage-overlay__art live-video-stage-overlay__art--fallback">
                  <span aria-hidden>🎵</span>
                </div>
              )}
            </div>
          )}

          <div className="live-video-stage-overlay__meta min-w-0 w-full">
            <p className="live-video-stage-overlay__title truncate">{title}</p>
            {artist ? (
              <p className="live-video-stage-overlay__artist truncate">{artist}</p>
            ) : null}
          </div>

          {loading ? (
            <div className="live-video-stage-overlay__loading" aria-hidden>
              <div className="live-video-stage-overlay__spinner" />
              <span className="sr-only">Chargement…</span>
            </div>
          ) : null}

          {footer ? <div className="live-video-stage-overlay__footer w-full">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LiveVideoStageOverlayLeaveButton({
  onClick,
  label,
  shortLabel,
}: {
  onClick: () => void;
  label: string;
  shortLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center px-3 py-2 min-h-11 rounded-full text-xs font-bold bg-black/55 backdrop-blur-sm border border-white/20 text-white hover:bg-black/70 active:scale-[0.98] transition touch-manipulation"
    >
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function LiveTheaterLiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-red-500/40 bg-red-950/50 text-[10px] font-bold uppercase tracking-widest text-red-300">
      <span className="live-video-stage-overlay__live-dot" aria-hidden />
      {label}
    </span>
  );
}
