import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import { memo, type ReactNode } from 'react';
import { UserAvatarOnline } from './UserAvatarOnline';

export const STORY_ACTIVE_RING_CLASS =
  'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 p-[2.5px]';

export const STORY_RING_ITEM_CLASS =
  'shrink-0 flex flex-col items-center gap-1.5 w-[4.75rem] snap-start touch-manipulation';

const STORY_AVATAR_SIZE = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
} as const;

const STORY_RING_SIZE = 56;

function displayUsername(username: string): string {
  return username.replace(/^🤖\s*/, '').trim();
}

function isSalonEntry(entry: MapStoryEntry): boolean {
  return Boolean(
    entry.salonId?.trim() &&
      !entry.isLive &&
      !entry.hasActiveStory &&
      !entry.reelId
  );
}

export function StoryAvatarRing({
  hasActiveStory,
  storyImageUrl,
  avatarUrl,
  size = 'md',
  alt = '',
}: {
  hasActiveStory: boolean;
  storyImageUrl?: string;
  avatarUrl?: string;
  size?: keyof typeof STORY_AVATAR_SIZE;
  alt?: string;
}) {
  const sizeClass = STORY_AVATAR_SIZE[size];
  const avatar = (
    <img
      src={storyImageUrl ?? avatarUrl ?? '/icon.svg'}
      alt={alt}
      loading="lazy"
      className={`${sizeClass} rounded-full object-cover bg-[#1e1e2f]`}
    />
  );

  if (!hasActiveStory) return avatar;

  return (
    <div className={`rounded-full shrink-0 ${STORY_ACTIVE_RING_CLASS}`}>
      <div className="rounded-full bg-[#0b0b0f] p-[2px]">{avatar}</div>
    </div>
  );
}

function segmentRingPath(
  index: number,
  total: number,
  radius: number,
  cx: number,
  cy: number,
  gapDeg = 4
): string {
  const slice = 360 / total;
  const start = index * slice + gapDeg / 2 - 90;
  const end = (index + 1) * slice - gapDeg / 2 - 90;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(toRad(start));
  const y1 = cy + radius * Math.sin(toRad(start));
  const x2 = cx + radius * Math.cos(toRad(end));
  const y2 = cy + radius * Math.sin(toRad(end));
  const large = slice - gapDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

function StoryRingLabel({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: 'live' | 'salon' | 'mine' | 'default';
}) {
  const tone =
    accent === 'live'
      ? 'text-red-300 font-semibold'
      : accent === 'salon'
        ? 'text-violet-300 font-semibold'
      : accent === 'mine'
        ? 'text-purple-300 font-semibold'
        : 'text-gray-300';
  return (
    <span className={`text-[10px] truncate w-full text-center leading-tight ${tone}`}>{children}</span>
  );
}

export function StorySegmentRing({
  segmentCount,
  seenSegmentCount = 0,
  size = STORY_RING_SIZE,
  children,
}: {
  segmentCount: number;
  seenSegmentCount?: number;
  size?: number;
  children: ReactNode;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 w-full h-full -rotate-90"
        aria-hidden
      >
        {Array.from({ length: segmentCount }, (_, i) => (
          <path
            key={i}
            d={segmentRingPath(i, segmentCount, radius, cx, cy)}
            fill="none"
            stroke={i < seenSegmentCount ? '#6b7280' : 'url(#storySegGrad)'}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        <defs>
          <linearGradient id="storySegGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d946ef" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-[3px] rounded-full bg-[#0b0b0f] flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ringClassForEntry(entry: MapStoryEntry, isSeen?: boolean): string {
  if (entry.isLive) {
    return 'bg-gradient-to-tr from-red-500 via-pink-500 to-orange-400 p-[2.5px]';
  }
  if (isSalonEntry(entry)) {
    return 'bg-gradient-to-tr from-violet-500 via-purple-500 to-fuchsia-400 p-[2.5px]';
  }
  if (entry.hasActiveStory && (entry.storyCount ?? 1) > 1) {
    return '';
  }
  if (entry.hasActiveStory && isSeen) {
    return 'bg-[#4a4a5a] p-[2.5px]';
  }
  if (entry.hasActiveStory) {
    return STORY_ACTIVE_RING_CLASS;
  }
  if (entry.reelId) {
    return 'bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 p-[2.5px]';
  }
  if (entry.isFavorite) {
    return 'bg-gradient-to-tr from-amber-400 via-orange-400 to-yellow-300 p-[2.5px]';
  }
  return 'bg-[#2d2d3d] p-[2.5px]';
}

function ringInnerMedia(entry: MapStoryEntry) {
  const preview = entry.storyImageUrl ?? (entry.reelId ? entry.posterUrl : undefined);
  if (preview) {
    return (
      <img
        src={preview}
        alt=""
        className="w-full h-full rounded-full object-cover bg-[#1a1a26]"
      />
    );
  }
  return (
    <UserAvatarOnline
      userId={entry.userId}
      username={entry.username}
      avatarUrl={entry.avatarUrl}
      size="sm"
      isLive={entry.isLive}
      isSalon={isSalonEntry(entry)}
    />
  );
}

function countSeenSegments(storyIds: string[] | undefined, seenIds: Set<string>): number {
  if (!storyIds?.length) return 0;
  return storyIds.filter((id) => seenIds.has(id)).length;
}

/** Anneau « Créer ma story » — premier slot quand l'utilisateur n'a pas encore publié. */
export function StoryCreateRing({
  avatarUrl,
  userId,
  username,
  label,
  onClick,
}: {
  userId: string;
  username: string;
  avatarUrl?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={STORY_RING_ITEM_CLASS}
      aria-label={label}
    >
      <div className="relative w-[3.75rem] h-[3.75rem]">
        <div className="absolute inset-0 rounded-full bg-[#1a1a26] overflow-hidden opacity-40">
          <UserAvatarOnline userId={userId} username={username} avatarUrl={avatarUrl} size="md" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-purple-400/60 bg-purple-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-purple-300" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
        </div>
      </div>
      <StoryRingLabel accent="mine">{label}</StoryRingLabel>
    </button>
  );
}

/** Anneau « Ma story » — aperçu + bouton ajouter séparé. */
export function MyMapStoryRing({
  username,
  avatarUrl,
  userId,
  hasActiveStory,
  storyImageUrl,
  storyCount = 0,
  viewLabel = 'Ma story',
  addLabel = 'Publier',
  onClick,
  onAddClick,
}: {
  userId: string;
  username: string;
  avatarUrl?: string;
  hasActiveStory: boolean;
  storyImageUrl?: string;
  storyCount?: number;
  viewLabel?: string;
  addLabel?: string;
  onClick: () => void;
  onAddClick?: () => void;
}) {
  const segmentCount = storyCount > 0 ? storyCount : hasActiveStory ? 1 : 0;
  const useSegmentRing = hasActiveStory && segmentCount > 1;

  const avatarInner =
    hasActiveStory && storyImageUrl ? (
      <img
        src={storyImageUrl}
        alt=""
        className="w-full h-full rounded-full object-cover bg-[#1a1a26]"
      />
    ) : (
      <UserAvatarOnline userId={userId} username={username} avatarUrl={avatarUrl} size="sm" />
    );

  const ringClass =
    hasActiveStory && !useSegmentRing ? STORY_ACTIVE_RING_CLASS : 'bg-[#3d3d4d] p-[2.5px]';

  return (
    <div className={`${STORY_RING_ITEM_CLASS} relative`}>
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 w-full"
        aria-label={viewLabel}
      >
        {useSegmentRing ? (
          <StorySegmentRing segmentCount={segmentCount}>
            <div className="w-12 h-12">{avatarInner}</div>
          </StorySegmentRing>
        ) : (
          <div className={`rounded-full relative ${ringClass}`}>
            <div className="rounded-full bg-[#0b0b0f] p-[2.5px] w-[3.75rem] h-[3.75rem] flex items-center justify-center overflow-hidden">
              {avatarInner}
            </div>
          </div>
        )}
        <StoryRingLabel accent="mine">{viewLabel}</StoryRingLabel>
      </button>
      {onAddClick ? (
        <button
          type="button"
          onClick={onAddClick}
          className="absolute top-0 right-0 min-w-8 min-h-8 flex items-center justify-center rounded-full bg-purple-600 border-2 border-[var(--ms-bg,#0b0b0f)] text-white shadow-md hover:bg-purple-500 transition z-10"
          aria-label={addLabel}
          title={addLabel}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export const MapStoryRing = memo(function MapStoryRing({
  entry,
  onClick,
  isSeen,
  storyIds,
  seenStoryIds,
}: {
  entry: MapStoryEntry;
  onClick: () => void;
  isSeen?: boolean;
  storyIds?: string[];
  seenStoryIds?: Set<string>;
}) {
  const segmentCount = entry.storyCount ?? 1;
  const useSegmentRing =
    entry.hasActiveStory && segmentCount > 1 && !entry.isLive && !isSalonEntry(entry);
  const seenSegments =
    useSegmentRing && seenStoryIds ? countSeenSegments(storyIds, seenStoryIds) : 0;
  const allSeen = useSegmentRing && seenSegments >= segmentCount;
  const ringInner = ringInnerMedia(entry);
  const name = displayUsername(entry.username);

  const visibilityHint =
    entry.hasActiveStory && entry.storyVisibility === 'public'
      ? ' · public'
      : entry.hasActiveStory && entry.storyVisibility === 'followers'
        ? ' · abonnés'
        : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={STORY_RING_ITEM_CLASS}
      title={`${name}${visibilityHint}`}
      aria-label={
        entry.isLive
          ? `Live de ${name}`
          : isSalonEntry(entry)
            ? `Salon de ${name}`
          : `Story de ${name}${segmentCount > 1 ? ` (${segmentCount})` : ''}`
      }
    >
      {useSegmentRing ? (
        <StorySegmentRing
          segmentCount={segmentCount}
          seenSegmentCount={allSeen ? segmentCount : seenSegments}
        >
          <div className="w-12 h-12">{ringInner}</div>
        </StorySegmentRing>
      ) : (
        <div className={`rounded-full relative ${ringClassForEntry(entry, isSeen)}`}>
          <div className="rounded-full bg-[#0b0b0f] p-[2.5px] w-[3.75rem] h-[3.75rem] flex items-center justify-center overflow-hidden">
            {ringInner}
          </div>
          {entry.isLive ? (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-red-600 text-white leading-none">
              Live
            </span>
          ) : isSalonEntry(entry) ? (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-violet-600 text-white leading-none">
              Salon
            </span>
          ) : null}
        </div>
      )}
      <StoryRingLabel
        accent={entry.isLive ? 'live' : isSalonEntry(entry) ? 'salon' : 'default'}
      >
        {name}
      </StoryRingLabel>
    </button>
  );
});
