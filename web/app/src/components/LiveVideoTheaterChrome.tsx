import type { ReactNode } from 'react';

export const LIVE_THEATER_CHROME_BTN_CLASS =
  'live-theater-chrome-btn flex items-center justify-center gap-1 min-h-10 min-w-10 px-2 py-1 rounded-full border border-white/12 bg-[#14141c]/90 text-white text-[11px] font-semibold backdrop-blur-md hover:bg-[#1c1c28]/95 hover:border-white/20 active:scale-95 transition touch-manipulation';

const CHROME_BTN = LIVE_THEATER_CHROME_BTN_CLASS;

export function LiveVideoGiftIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M12 8V21M3 12h18M12 8c-2-3-5-3-5 0s3 3 5 0M12 8c2-3 5-3 5 0s-3 3-5 0" />
      <path d="M7.5 8H16.5C17.9 8 19 6.9 19 5.5S17.9 3 16.5 3C14 3 12 8 12 8S10 3 7.5 3 4 3.6 4 5.5 4 8 7.5 8Z" />
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
