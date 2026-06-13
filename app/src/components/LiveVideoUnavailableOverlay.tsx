import type { ReactNode } from 'react';

type LiveVideoUnavailableOverlayProps = {
  title: string;
  hint?: string;
  actions?: ReactNode;
};

/** Centered overlay when live is active but video cannot be displayed. */
export function LiveVideoUnavailableOverlay({
  title,
  hint,
  actions,
}: LiveVideoUnavailableOverlayProps) {
  return (
    <div
      className="live-video-stage-overlay z-30 bg-black/90"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-4xl" aria-hidden>
        ⚠️
      </p>
      <p className="text-white font-bold text-lg">{title}</p>
      {hint ? <p className="text-gray-400 text-sm max-w-sm">{hint}</p> : null}
      {actions ? <div className="mt-1 flex flex-col items-center gap-2">{actions}</div> : null}
    </div>
  );
}
