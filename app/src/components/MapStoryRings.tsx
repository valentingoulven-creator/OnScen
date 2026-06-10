import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import { UserAvatarOnline } from './UserAvatarOnline';

export const STORY_ACTIVE_RING_CLASS =
  'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 p-[2px]';

const STORY_AVATAR_SIZE = {
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
} as const;

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
        className="w-12 h-12 rounded-full object-cover bg-[#1a1a26]"
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

export function MapStoryRing({
  entry,
  onClick,
  isSeen,
}: {
  entry: MapStoryEntry;
  onClick: () => void;
  isSeen?: boolean;
}) {
  const visibilityBadge =
    entry.hasActiveStory && entry.storyVisibility === 'public' ? '🌍' :
    entry.hasActiveStory && entry.storyVisibility === 'followers' ? '👥' : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 w-[4.5rem] snap-start"
      title={entry.username}
      aria-label={`Story de ${entry.username}`}
    >
      <div className={`rounded-full relative ${ringClassForEntry(entry, isSeen)}`}>
        <div className="rounded-full bg-[#0b0b0f] p-[2px]">{ringInnerMedia(entry)}</div>
        {visibilityBadge ? (
          <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none" aria-hidden>
            {visibilityBadge}
          </span>
        ) : null}
      </div>
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
  onClick,
  onAddClick,
}: {
  userId: string;
  username: string;
  avatarUrl?: string;
  hasActiveStory: boolean;
  storyImageUrl?: string;
  onClick: () => void;
  /** Bouton + style IG pour publier une nouvelle story */
  onAddClick?: () => void;
}) {
  const ringClass = hasActiveStory
    ? STORY_ACTIVE_RING_CLASS
    : 'bg-[#3d3d4d] p-[2px] border border-dashed border-purple-500/40';

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 w-[4.5rem] snap-start"
      title={hasActiveStory ? 'Ma story' : 'Ajouter une story'}
      aria-label={hasActiveStory ? 'Voir ma story' : 'Créer une story'}
    >
      <div className={`rounded-full relative ${ringClass}`}>
        <div className="rounded-full bg-[#0b0b0f] p-[2px]">
          {hasActiveStory && storyImageUrl ? (
            <img
              src={storyImageUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover bg-[#1a1a26]"
            />
          ) : (
            <UserAvatarOnline userId={userId} username={username} avatarUrl={avatarUrl} size="sm" />
          )}
        </div>
        {onAddClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-purple-600 border-2 border-[#0b0b0f] flex items-center justify-center text-white text-xs font-bold leading-none hover:bg-purple-500"
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
