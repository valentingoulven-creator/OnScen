import { buildPlatformTrackUrl, buildTrackUrlAtPosition } from '../lib/salonPlayback';

const BASE_CLASS =
  'inline-flex items-center justify-center gap-1 text-xs py-1 px-2 rounded-lg border border-[#2a2a3a] text-gray-400 hover:text-red-300 hover:border-red-500/35 bg-transparent transition shrink-0';

export const YOUTUBE_RED_LINK_CLASS =
  'inline-flex items-center justify-center gap-1.5 text-sm py-1.5 px-3 rounded-full bg-[#FF0000] text-white hover:bg-[#CC0000] active:bg-[#e62117] transition shrink-0 font-medium shadow-sm';

interface OpenOnYoutubeButtonProps {
  trackId: string;
  /** Position synchronisée (paramètre `t=` sur YouTube). */
  positionMs?: number;
  className?: string;
  label?: string;
  variant?: 'default' | 'youtube-red';
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icône officielle YouTube (rect blanc arrondi + triangle rouge) — adaptée bouton rouge. */
function YouTubeLogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" className={className} aria-hidden>
      <rect x="0" y="0" width="20" height="14" rx="3.5" fill="white" />
      <polygon points="7.5,3.5 7.5,10.5 14.5,7" fill="#e62117" />
    </svg>
  );
}

/** Lien secondaire compact vers youtube.com/watch?v=… */
export function OpenOnYoutubeButton({
  trackId,
  positionMs,
  className = '',
  label = 'Ouvrir sur YouTube',
  variant = 'default',
}: OpenOnYoutubeButtonProps) {
  if (!trackId || trackId === 'demo') return null;

  const href =
    positionMs != null && positionMs > 0
      ? buildTrackUrlAtPosition('youtube', trackId, positionMs)
      : buildPlatformTrackUrl('youtube', trackId);

  const variantClass = variant === 'youtube-red' ? YOUTUBE_RED_LINK_CLASS : BASE_CLASS;
  const iconClass = variant === 'youtube-red' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5';

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${variantClass} ${className}`.trim()}
      title="Ouvrir sur YouTube dans un nouvel onglet"
    >
      {variant === 'youtube-red' ? (
        <YouTubeLogoIcon className="w-[18px] h-[13px] shrink-0" />
      ) : null}
      {label}
      {variant === 'default' && <ExternalLinkIcon className={iconClass} />}
    </a>
  );
}
