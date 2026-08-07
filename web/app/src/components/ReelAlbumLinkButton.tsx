import type { MouseEvent, PointerEvent } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { detectAlbumLinkPlatform, type AlbumLinkPlatformStyle } from '../lib/reelAlbumLinkPlatform';
import { dispatchStoryAppLink, parseStoryAppLink } from '../lib/storyAppLink';

function ReelVinylIcon({ style, gradientId }: { style: AlbumLinkPlatformStyle; gradientId: string }) {
  const [light, mid, dark] = style.gradientStops;
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#0a0a0a" stroke={style.ringColor} strokeWidth="1.25" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.75" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.75" />
      <circle cx="24" cy="24" r="8.5" fill={`url(#${gradientId})`} />
      <circle cx="24" cy="24" r="2.2" fill="#050505" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <defs>
        <radialGradient id={gradientId} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
    </svg>
  );
}

interface ReelAlbumLinkButtonProps {
  url: string;
  className?: string;
  /** fixed = position absolue sur la slide ; inline = dans un rail empilé. */
  variant?: 'fixed' | 'inline';
}

/** Below ReelsSearchBar overlay (top-3 + h-9) — left rail, clear of header controls. */
const REEL_ALBUM_LINK_POSITION =
  'absolute top-14 left-4 z-[15]';

export function ReelAlbumLinkButton({ url, className = '', variant = 'fixed' }: ReelAlbumLinkButtonProps) {
  const { t } = useTranslation();
  const gradientId = useId().replace(/:/g, '');
  const trimmed = url.trim();
  if (!trimmed) return null;

  const appTarget = parseStoryAppLink(trimmed);
  const platformStyle = detectAlbumLinkPlatform(trimmed);
  const ariaLabel = t('reels.albumLinkAria', {
    defaultValue: 'Ouvrir l’album',
    platform: platformStyle.label,
  });

  const openLink = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (appTarget) {
      dispatchStoryAppLink(appTarget);
      return;
    }
    window.open(trimmed, '_blank', 'noopener,noreferrer');
  };

  const stopBubble = (e: PointerEvent) => {
    e.stopPropagation();
  };

  const disc = (
    <span className="reel-album-link__disc flex h-11 w-11 items-center justify-center rounded-full bg-black/45 p-1 shadow-[0_4px_16px_rgba(0,0,0,0.45)] ring-1 ring-white/15 backdrop-blur-sm">
      <ReelVinylIcon style={platformStyle} gradientId={gradientId} />
    </span>
  );

  const label = (
    <span
      className="reel-album-link__platform pointer-events-none mt-0.5 max-w-[3.5rem] truncate text-center text-[9px] font-semibold leading-none tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[10px]"
      aria-hidden
    >
      {platformStyle.label}
    </span>
  );

  const sharedProps = {
    className: `reel-album-link__hit flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation active:scale-95 transition-transform`,
    onClick: openLink,
    onPointerDown: stopBubble,
    onPointerUp: stopBubble,
    'aria-label': ariaLabel,
  };

  return (
    <div
      className={`reel-album-link reel-album-link--${platformStyle.platform} ${
        variant === 'fixed' ? REEL_ALBUM_LINK_POSITION : 'relative'
      } flex w-11 flex-col items-center ${className}`}
    >
      {appTarget ? (
        <button type="button" {...sharedProps}>
          {disc}
        </button>
      ) : (
        <a href={trimmed} target="_blank" rel="noopener noreferrer" {...sharedProps}>
          {disc}
        </a>
      )}
      {label}
    </div>
  );
}
