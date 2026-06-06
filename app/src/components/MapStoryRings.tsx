import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import { UserAvatarOnline } from './UserAvatarOnline';

function ringClassForEntry(entry: MapStoryEntry): string {
  if (entry.isLive) {
    return 'bg-gradient-to-tr from-red-500 via-pink-500 to-orange-400 p-[2px]';
  }
  if (entry.hasActiveStory) {
    return 'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 p-[2px]';
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
}: {
  entry: MapStoryEntry;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1 w-[4.5rem] snap-start"
      title={entry.username}
      aria-label={`Story de ${entry.username}`}
    >
      <div className={`rounded-full ${ringClassForEntry(entry)}`}>
        <div className="rounded-full bg-[#0b0b0f] p-[2px]">{ringInnerMedia(entry)}</div>
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
}: {
  userId: string;
  username: string;
  avatarUrl?: string;
  hasActiveStory: boolean;
  storyImageUrl?: string;
  onClick: () => void;
}) {
  const ringClass = hasActiveStory
    ? 'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 p-[2px]'
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
        {!hasActiveStory ? (
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-purple-600 border-2 border-[#0b0b0f] flex items-center justify-center text-white text-xs font-bold leading-none">
            +
          </span>
        ) : null}
      </div>
      <span className="text-[9px] text-purple-300 truncate w-full text-center leading-tight font-semibold">
        Ma story
      </span>
    </button>
  );
}
