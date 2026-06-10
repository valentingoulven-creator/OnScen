import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import type { ReactNode } from 'react';
import { UserAvatarOnline } from './UserAvatarOnline';

export const STORY_ACTIVE_RING_CLASS =
  'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 p-[2px]';

const STORY_AVATAR_SIZE = {
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
} as const;

const STORY_RING_SIZE = 52;

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

function ringClassForEntry(entry: MapStoryEntry, isSeen?: boolean): string {
  if (entry.isLive) {
    return 'bg-gradient-to-tr from-red-500 via-pink-500 to-orange-400 p-[2px]';
  }
  if (entry.hasActiveStory && (entry.storyCount ?? 1) > 1) {
    return '';
  }
  if (entry.hasActiveStory && isSeen) {
    return 'bg-[#4a4a5a] p-[2px]';
  }
  if (entry.hasActiveStory) {
    return STORY_ACTIVE_RING_CLASS;
  }
  if (entry.reelId) {
    return 'bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 p-[2px]';
  }
  return 'bg-[#2d2d3d] p-[2px]';
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
    />
  );
}

function countSeenSegments(storyIds: string[] | undefined, seenIds: Set<string>): number {
  if (!storyIds?.length) return 0;
  return storyIds.filter((id) => seenIds.has(id)).length;
}

export function MapStoryRing({
  entry,
  onClick,
  isSeen,
  storyIds,
  seenStoryIds,
}: {
  entry: MapStoryEntry;
  onClick: () => void;
  isSeen?: boolean;
  /** IDs des stories de l'utilisateur (ordre chronologique) pour segments vus */
  storyIds?: string[];
  seenStoryIds?: Set<string>;
}) {
  const visibilityBadge =
    entry.hasActiveStory && entry.storyVisibility === 'public' ? '🌍' :
    entry.hasActiveStory && entry.storyVisibility === 'followers' ? '👥' : null;

  const segmentCount = entry.storyCount ?? 1;
  const useSegmentRing = entry.hasActiveStory && segmentCount > 1 && !entry.isLive;
  const seenSegments = useSegmentRing && seenStoryIds
    ? countSeenSegments(storyIds, seenStoryIds)
    : 0;
  const allSeen = useSegmentRing && seenSegments >= segmentCount;

  const ringInner = ringInnerMedia(entry);

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 w-[4.5rem] snap-start"
      title={entry.username}
      aria-label={`Story de ${entry.username}${segmentCount > 1 ? ` (${segmentCount})` : ''}`}
    >
      {useSegmentRing ? (
        <div className="relative">
          <StorySegmentRing
            segmentCount={segmentCount}
            seenSegmentCount={allSeen ? segmentCount : seenSegments}
          >
            <div className="w-11 h-11">{ringInner}</div>
          </StorySegmentRing>
          {visibilityBadge ? (
            <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none" aria-hidden>
              {visibilityBadge}
            </span>
          ) : null}
        </div>
      ) : (
        <div className={`rounded-full relative ${ringClassForEntry(entry, isSeen)}`}>
          <div className="rounded-full bg-[#0b0b0f] p-[2px] w-12 h-12 flex items-center justify-center overflow-hidden">
            {ringInner}
          </div>
          {visibilityBadge ? (
            <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none" aria-hidden>
              {visibilityBadge}
            </span>
          ) : null}
        </div>
      )}
      <span className="text-[9px] text-gray-300 truncate w-full text-center leading-tight">
        {entry.isFavorite ? '★ ' : ''}
        {entry.username}
      </span>
    </button>
  );
}

export function MyMapStoryRing({
  username,
  avatarUrl,
  userId,
  hasActiveStory,
  storyImageUrl,
  storyCount = 0,
  onClick,
  onAddClick,
}: {
  userId: string;
  username: string;
  avatarUrl?: string;
  hasActiveStory: boolean;
  storyImageUrl?: string;
  storyCount?: number;
  onClick: () => void;
  /** Bouton + style IG pour publier une nouvelle story */
  onAddClick?: () => void;
}) {
  const segmentCount = storyCount > 0 ? storyCount : hasActiveStory ? 1 : 0;
  const useSegmentRing = hasActiveStory && segmentCount > 1;

  const avatarInner = hasActiveStory && storyImageUrl ? (
    <img
      src={storyImageUrl}
      alt=""
      className="w-full h-full rounded-full object-cover bg-[#1a1a26]"
    />
  ) : (
    <UserAvatarOnline userId={userId} username={username} avatarUrl={avatarUrl} size="sm" />
  );

  const ringClass = hasActiveStory && !useSegmentRing
    ? STORY_ACTIVE_RING_CLASS
    : !hasActiveStory
      ? 'bg-[#3d3d4d] p-[2px] border border-dashed border-purple-500/40'
      : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 w-[4.5rem] snap-start"
      title={hasActiveStory ? 'Ma story' : 'Ajouter une story'}
      aria-label={hasActiveStory ? `Ma story${segmentCount > 1 ? ` (${segmentCount})` : ''}` : 'Créer une story'}
    >
      <div className="relative">
        {useSegmentRing ? (
          <StorySegmentRing segmentCount={segmentCount}>
            <div className="w-11 h-11">{avatarInner}</div>
          </StorySegmentRing>
        ) : (
          <div className={`rounded-full relative ${ringClass}`}>
            <div className="rounded-full bg-[#0b0b0f] p-[2px] w-12 h-12 flex items-center justify-center overflow-hidden">
              {avatarInner}
            </div>
          </div>
        )}
        {onAddClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-purple-600 border-2 border-[#0b0b0f] flex items-center justify-center text-white text-xs font-bold leading-none hover:bg-purple-500 z-10"
            aria-label="Publier une nouvelle story"
            title="Publier une nouvelle story"
          >
            +
          </button>
        ) : null}
      </div>
      <span className="text-[9px] text-purple-300 truncate w-full text-center leading-tight font-semibold">
        Ma story
      </span>
    </button>
  );
}
