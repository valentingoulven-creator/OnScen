import type { ReactNode } from 'react';

const CHROME_BTN =
  'live-theater-chrome-btn flex items-center justify-center gap-1 min-h-10 min-w-10 px-2 py-1 rounded-full border border-white/12 bg-[#14141c]/90 text-white text-[11px] font-semibold backdrop-blur-md hover:bg-[#1c1c28]/95 hover:border-white/20 active:scale-95 transition touch-manipulation';

export function LiveVideoGoalIcon({ active }: { active?: boolean }) {
  return (
    <svg
      aria-hidden
      className={`w-4 h-4 shrink-0${active ? ' text-purple-300' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

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
