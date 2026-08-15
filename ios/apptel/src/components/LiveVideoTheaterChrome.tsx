/**
 * Fichier override mobile — ios/apptel/src/components\LiveVideoTheaterChrome.tsx
 * Créé via: npm run mobile:override -- create components\LiveVideoTheaterChrome.tsx
 * Ne pas modifier web/app/src/components\LiveVideoTheaterChrome.tsx pour ce comportement mobile-only.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './LiveVideoTheaterChrome.css';

export const LIVE_THEATER_CHROME_BTN_CLASS =
  'live-theater-chrome-btn flex items-center justify-center gap-1 min-h-10 min-w-10 px-2 py-1 rounded-full border border-white/12 bg-[#14141c]/90 text-white text-[11px] font-semibold backdrop-blur-md hover:bg-[#1c1c28]/95 hover:border-white/20 active:scale-95 transition touch-manipulation';

/** Bouton don spectateur — dégradé wave OnScen (purple → pink). */
export const LIVE_THEATER_DONATE_BTN_CLASS =
  'live-theater-chrome-btn--onscen-wave text-white border-purple-400/45 shadow-lg shadow-purple-900/45 hover:border-pink-300/55 hover:shadow-pink-900/35 ring-1 ring-inset ring-white/20 min-h-11 min-w-11 backdrop-blur-sm';

const CHROME_BTN = LIVE_THEATER_CHROME_BTN_CLASS;

export function LiveVideoGiftIcon() {
  return (
    <span aria-hidden className="text-base leading-none shrink-0">
      🎁
    </span>
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

/** Titre du live + lien profil hôte (haut droite). */
export function LiveTheaterLiveMetaBar({
  liveTitle,
  hostName,
  hostAvatarUrl,
  hostId,
  onOpenHostProfile,
  visible,
}: {
  liveTitle: string;
  hostName: string;
  hostAvatarUrl?: string;
  hostId?: string;
  onOpenHostProfile?: (userId: string) => void;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const title = liveTitle.trim();
  const name = hostName.trim();
  if (!title) return null;

  const profileEnabled = Boolean(hostId && name && onOpenHostProfile);

  const avatarEl = hostAvatarUrl ? (
    <img
      src={hostAvatarUrl}
      alt=""
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-2 ring-white/25"
    />
  ) : (
    <div
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-700 flex items-center justify-center shrink-0 text-white font-bold text-sm ring-2 ring-white/20"
      aria-hidden
    >
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );

  const titleEl = (
    <span className="text-xs sm:text-sm font-medium text-gray-200 truncate leading-tight drop-shadow-md block">
      {title}
    </span>
  );

  const nameEl = (interactive: boolean) =>
    interactive ? (
      <span className="text-sm sm:text-base font-semibold text-white truncate group-hover:text-purple-100 underline-offset-2 group-hover:underline drop-shadow-md block">
        {name}
      </span>
    ) : (
      <span className="text-sm sm:text-base font-semibold text-white truncate drop-shadow-md block">{name}</span>
    );

  const metaBlock =
    name && profileEnabled ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenHostProfile!(hostId!);
        }}
        className="flex items-start justify-start gap-2 min-h-11 min-w-0 max-w-full text-left touch-manipulation group"
        aria-label={t('live.theaterMetaOpenHostProfile', { name })}
      >
        {avatarEl}
        <span className="flex flex-col items-start gap-0 min-w-0 pt-0.5">
          {nameEl(true)}
          {titleEl}
        </span>
      </button>
    ) : name ? (
      <div className="flex items-start justify-start gap-2 min-w-0 max-w-full text-left">
        {avatarEl}
        <span className="flex flex-col gap-0 min-w-0 pt-0.5">
          {nameEl(false)}
          {titleEl}
        </span>
      </div>
    ) : (
      titleEl
    );

  return (
    <div
      className={`live-theater-live-meta live-theater-live-meta--top-left absolute top-2 left-2 z-[28] max-w-[min(82%,20rem)] px-2 py-1.5 pointer-events-none transition-opacity duration-300 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ top: '0.5rem', left: '0.5rem', right: 'auto', bottom: 'auto' }}
      aria-hidden={!visible}
    >
      <div className="live-theater-live-meta__inner pointer-events-auto min-w-0 max-w-full mr-auto text-left flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{metaBlock}</div>
        <div className="live-theater-live-meta__like shrink-0 self-center" />
      </div>
    </div>
  );
}
