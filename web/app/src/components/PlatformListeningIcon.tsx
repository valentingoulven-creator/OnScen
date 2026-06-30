import type { MusicPlatform } from '../lib/platformConnect';

interface PlatformListeningIconProps {
  platform: MusicPlatform;
  /** sm = badge sur avatar ; md = légèrement plus grand */
  size?: 'sm' | 'md';
  className?: string;
}

function YoutubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.94C18.24 5 12 5 12 5s-6.24 0-7.64.25a2.75 2.75 0 0 0-1.94 1.94C2.17 8.59 2.17 12 2.17 12s0 3.41.25 4.81a2.75 2.75 0 0 0 1.94 1.94C5.76 19 12 19 12 19s6.24 0 7.64-.25a2.75 2.75 0 0 0 1.94-1.94c.25-1.4.25-4.81.25-4.81s0-3.41-.25-4.81zM10 15.02V8.98L15.5 12 10 15.02z"
      />
    </svg>
  );
}

export function PlatformListeningIcon({ platform: _platform, size = 'sm', className = '' }: PlatformListeningIconProps) {
  const box = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const icon = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  const label = 'Écoute sur YouTube';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#12121a] text-white bg-[#FF0000] ${box} ${className}`}
      title={label}
      aria-label={label}
    >
      <YoutubeMark className={icon} />
    </span>
  );
}
