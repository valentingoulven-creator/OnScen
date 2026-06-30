import type { ReactNode } from 'react';

const CHROME_BTN =
  'live-theater-chrome-btn flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 py-1.5 rounded-full border border-white/12 bg-[#14141c]/90 text-white text-[11px] font-semibold backdrop-blur-md hover:bg-[#1c1c28]/95 hover:border-white/20 active:scale-95 transition touch-manipulation';

export function LiveVideoChromeButton({
  onClick,
  ariaLabel,
  title,
  children,
  className = '',
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHROME_BTN}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      {children}
    </button>
  );
}

export type LiveTheaterStatusTone = 'live' | 'loading' | 'idle' | 'error' | 'ended';

export function LiveTheaterStatusBar({
  children,
  tone = 'idle',
  className = '',
}: {
  children: ReactNode;
  tone?: LiveTheaterStatusTone;
  className?: string;
}) {
  return (
    <div
      className={`live-theater-status-bar live-theater-status-bar--${tone}${className ? ` ${className}` : ''}`}
      aria-live="polite"
    >
      {children}
    </div>
  );
}
