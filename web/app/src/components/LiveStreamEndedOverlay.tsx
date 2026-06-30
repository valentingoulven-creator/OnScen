import { LiveVideoStagePlaceholder } from './LiveVideoStagePlaceholder';

type LiveStreamEndedOverlayProps = {
  title: string;
  hint?: string;
};

/** Centered overlay when a live stream has ended (viewers). */
export function LiveStreamEndedOverlay({ title, hint }: LiveStreamEndedOverlayProps) {
  return (
    <LiveVideoStagePlaceholder
      className="z-40"
      title={title}
      icon={
        <span className="text-4xl leading-none" aria-hidden>
          📡
        </span>
      }
      footer={
        hint ? (
          <p className="text-center text-xs text-gray-400 leading-relaxed max-w-xs">{hint}</p>
        ) : null
      }
    />
  );
}
