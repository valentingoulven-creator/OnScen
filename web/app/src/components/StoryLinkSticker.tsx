import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import { dispatchStoryAppLink, parseStoryAppLink } from '../lib/storyAppLink';
import { storyLinkDisplayLabel } from '../lib/storyLink';
import type { StoryLink } from '../types';

function IconLinkSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMusicSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function storyLinkStickerStyle(
  x: number,
  y: number,
  isActive = false
): CSSProperties {
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: 'translate(-50%, -50%)',
    boxShadow: isActive ? '0 0 0 2px rgba(168,85,247,0.9)' : undefined,
  };
}

interface StoryLinkStickerProps {
  link: Pick<StoryLink, 'url' | 'label'>;
  isActive?: boolean;
  className?: string;
  onPointerDown?: (e: PointerEvent) => void;
  onClick?: (e: MouseEvent) => void;
}

export function StoryLinkSticker({
  link,
  isActive = false,
  className = '',
  onPointerDown,
  onClick,
}: StoryLinkStickerProps) {
  const label = storyLinkDisplayLabel(link);
  const previewOnly = !link.url.trim();
  const isAppLink = Boolean(link.url.trim() && parseStoryAppLink(link.url));

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.35)] whitespace-nowrap max-w-[min(72vw,240px)] truncate ${
        isAppLink
          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white'
          : 'bg-white/95 text-[#111111]'
      } ${className}`}
      onPointerDown={onPointerDown}
      onClick={onClick}
      style={isActive ? { boxShadow: '0 0 0 2px rgba(168,85,247,0.9)' } : undefined}
    >
      {isAppLink ? <IconMusicSmall /> : <IconLinkSmall />}
      <span className="truncate">{previewOnly ? 'Lien' : label}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="shrink-0 opacity-70"
      >
        <path
          d="M18 15l-6-6-6 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface StoryLinkOverlayProps {
  link: StoryLink;
  isActive?: boolean;
  interactive?: 'drag' | 'open' | 'none';
  onPointerDown?: (e: PointerEvent) => void;
}

export function StoryLinkOverlay({
  link,
  isActive = false,
  interactive = 'none',
  onPointerDown,
}: StoryLinkOverlayProps) {
  const style = storyLinkStickerStyle(link.x, link.y, isActive);
  const cursor =
    interactive === 'drag'
      ? 'cursor-grab active:cursor-grabbing'
      : interactive === 'open'
        ? 'cursor-pointer'
        : '';

  const handleOpen = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const appTarget = parseStoryAppLink(link.url);
    if (appTarget) {
      dispatchStoryAppLink(appTarget);
      return;
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  if (interactive === 'open') {
    const appTarget = parseStoryAppLink(link.url);
    if (appTarget) {
      return (
        <button
          type="button"
          className={`absolute z-20 ${cursor}`}
          style={style}
          onClick={handleOpen}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Ouvrir : ${storyLinkDisplayLabel(link)}`}
        >
          <StoryLinkSticker link={link} />
        </button>
      );
    }
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`absolute z-20 ${cursor}`}
        style={style}
        onClick={handleOpen}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Ouvrir le lien : ${storyLinkDisplayLabel(link)}`}
      >
        <StoryLinkSticker link={link} />
      </a>
    );
  }

  return (
    <div
      className={`absolute z-[3] ${cursor} ${isActive ? 'z-10' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <StoryLinkSticker link={link} isActive={isActive} />
    </div>
  );
}
