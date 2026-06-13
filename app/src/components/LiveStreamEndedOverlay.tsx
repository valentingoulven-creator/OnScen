type LiveStreamEndedOverlayProps = {
  title: string;
  hint?: string;
};

/** Centered overlay when a live stream has ended (viewers). */
export function LiveStreamEndedOverlay({ title, hint }: LiveStreamEndedOverlayProps) {
  return (
    <div
      className="live-video-stage-overlay z-40 bg-[#0a0a0f]"
      role="status"
      aria-live="polite"
    >
      <p className="text-4xl" aria-hidden>
        📡
      </p>
      <p className="text-white font-bold text-lg">{title}</p>
      {hint ? <p className="text-gray-400 text-sm max-w-sm">{hint}</p> : null}
    </div>
  );
}
