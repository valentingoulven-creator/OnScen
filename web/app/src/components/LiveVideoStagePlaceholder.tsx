import type { ReactNode } from 'react';

export type LiveVideoStagePlaceholderProps = {
  title: string;
  artist?: string;
  albumArtUrl?: string;
  loading?: boolean;
  /** Icône centrale à la place de la pochette (ex. OBS / CDN). */
  icon?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Placeholder théâtre live — glass card + fond flou (style salon match-hero). */
export function LiveVideoStagePlaceholder({
  title,
  artist,
  albumArtUrl,
  loading = false,
  icon,
  badge,
  footer,
  className = '',
}: LiveVideoStagePlaceholderProps) {
  return (
    <div
      className={`live-video-stage-overlay live-video-stage-overlay--theater z-0${className ? ` ${className}` : ''}`}
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
