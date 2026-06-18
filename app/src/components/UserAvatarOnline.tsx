import { memo, useEffect, useState } from 'react';
import { formatCompactCount } from '../lib/formatCount';
import { avatarInitialsLabel, dicebearAdventurerAvatar } from '../lib/avatarUrl';

interface UserAvatarOnlineProps {
  userId: string;
  avatarUrl?: string;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'profile' | 'hero';
  isOnline?: boolean;
  isLive?: boolean;
  liveViewersCount?: number;
  className?: string;
}

const SIZES = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
  profile: 'w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20',
  hero: 'w-24 h-24 sm:w-[6.5rem] sm:h-[6.5rem]',
};

const DOT = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-3.5 h-3.5 border-2',
  profile: 'w-4 h-4 border-2',
  hero: 'w-4 h-4 border-2',
};

const LIVE_BADGE = {
  xs: 'text-[5px] px-0.5',
  sm: 'text-[6px] px-0.5',
  md: 'text-[7px] px-1',
  lg: 'text-[8px] px-1',
  xl: 'text-[8px] px-1',
  profile: 'text-[9px] px-1.5',
  hero: 'text-[9px] px-1.5',
};

const VIEWER_COUNT = {
  xs: 'text-[8px] min-w-[1rem]',
  sm: 'text-[9px] min-w-[1.1rem]',
  md: 'text-[10px] min-w-[1.25rem]',
  lg: 'text-[11px] min-w-[1.35rem]',
  xl: 'text-[11px] min-w-[1.4rem]',
  profile: 'text-[11px] min-w-[1.4rem]',
  hero: 'text-[11px] min-w-[1.4rem]',
};

export const UserAvatarOnline = memo(function UserAvatarOnline({
  userId,
  avatarUrl,
  username,
  size = 'md',
  isOnline,
  isLive,
  liveViewersCount,
  className = '',
}: UserAvatarOnlineProps) {
  const fallbackSrc = dicebearAdventurerAvatar(userId);
  const primary = avatarUrl?.trim() || fallbackSrc;
  const [src, setSrc] = useState(primary);
  const [showInitials, setShowInitials] = useState(false);

  useEffect(() => {
    setSrc(primary);
    setShowInitials(false);
  }, [primary]);

  const onImgError = () => {
    if (src !== fallbackSrc) {
      setSrc(fallbackSrc);
      return;
    }
    setShowInitials(true);
  };

  const showViewers = isLive && liveViewersCount != null;
  const viewerLabel = showViewers ? formatCompactCount(liveViewersCount) : '';
  const initials = avatarInitialsLabel(username ?? userId);

  return (
    <div
      className={`flex items-center gap-1 shrink-0 ${className}`}
      title={
        isLive
          ? showViewers
            ? `En live · ${liveViewersCount} spectateurs`
            : 'En live'
          : isOnline
            ? 'En ligne'
            : undefined
      }
    >
      {showViewers && (
        <span
          className={`${VIEWER_COUNT[size]} font-extrabold text-red-400 tabular-nums leading-none text-right`}
          aria-label={`${liveViewersCount} spectateurs`}
        >
          {viewerLabel}
        </span>
      )}
      <div className="relative shrink-0">
        <div
          className={`rounded-full ${
            isLive
              ? 'p-[2.5px] bg-gradient-to-br from-red-500 via-rose-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.55)]'
              : ''
          }`}
        >
          {showInitials ? (
            <div
              className={`${SIZES[size]} rounded-full bg-[#2a2a3d] text-purple-200 font-bold flex items-center justify-center text-xs`}
              aria-hidden
            >
              {initials}
            </div>
          ) : (
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              className={`${SIZES[size]} rounded-full object-cover bg-[#1a1a26] block`}
              onError={onImgError}
            />
          )}
        </div>
        {isLive && (
          <span
            className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 ${LIVE_BADGE[size]} font-extrabold uppercase leading-none bg-red-600 text-white rounded border border-[#12121a] whitespace-nowrap`}
            aria-hidden
          >
            live
          </span>
        )}
        {isOnline && !isLive && (
          <span
            className={`absolute bottom-0 right-0 ${DOT[size]} rounded-full bg-green-500 border-[#12121a]`}
            title="En ligne"
            aria-label="En ligne"
          />
        )}
      </div>
    </div>
  );
});
