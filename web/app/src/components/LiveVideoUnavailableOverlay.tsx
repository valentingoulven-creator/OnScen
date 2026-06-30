import type { ReactNode } from 'react';
import { LiveVideoStagePlaceholder } from './LiveVideoStagePlaceholder';

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
    <LiveVideoStagePlaceholder
      className="z-30"
      title={title}
      icon={
        <span className="text-4xl leading-none" aria-hidden>
          ⚠️
        </span>
      }
      footer={
        <>
          {hint ? (
            <p className="text-center text-xs text-gray-400 leading-relaxed max-w-xs">{hint}</p>
          ) : null}
          {actions ? <div className="flex flex-col items-center gap-2 w-full">{actions}</div> : null}
        </>
      }
    />
  );
}
