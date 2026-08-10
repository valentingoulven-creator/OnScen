import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { hasUpcomingEventDate, getPrimaryEventDate } from '../lib/feedEvents';
import { EventCard } from './EventCard';
import { StoryAvatarRing } from './MapStoryRings';
import { UsernameDisplay } from './UsernameDisplay';
import type { FeedPost, MapStory } from '../types';

interface UserEventsSectionProps {
  userId: string;
  onOpenPost?: (post: FeedPost) => void;
  onOpenProfile?: (userId: string) => void;
}

function CalendarEmptyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M8 15h.01M12 15h.01M16 15h.01" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

export function UserEventsSection({ userId, onOpenPost, onOpenProfile }: UserEventsSectionProps) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [taggedStories, setTaggedStories] = useState<MapStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPosts([]);
    setTaggedStories([]);

    Promise.all([
      api.getFeedPosts(token, {
        eventsOnly: true,
        userEventsOnly: true,
        profileUserId: userId,
        limit: 100,
      }),
      api.getProfileTaggedStories(token, userId),
    ])
      .then(([feedData, storiesData]) => {
        if (ctrl.signal.aborted) return;

        const upcoming = feedData.posts
          .filter((p) => hasUpcomingEventDate(p))
          .sort((a, b) => {
            const da = getPrimaryEventDate(a);
            const db_ = getPrimaryEventDate(b);
            if (!da) return 1;
            if (!db_) return -1;
            return new Date(da).getTime() - new Date(db_).getTime();
          });

        setPosts(upcoming);
        setTaggedStories(storiesData.stories ?? []);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => {
      ctrl.abort();
    };
  }, [userId, token]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-purple-500/20 bg-[#12121a] overflow-hidden animate-pulse"
          >
            <div className="h-24 bg-purple-950/40" />
            <div className="p-3 space-y-2">
              <div className="h-2.5 w-24 rounded bg-purple-900/50" />
              <div className="h-2 w-40 rounded bg-[#1e1e2f]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <CalendarEmptyIcon className="w-10 h-10 text-red-400/60" />
        <p className="text-sm text-red-400/80">{error}</p>
      </div>
    );
  }

  const hasEvents = posts.length > 0;
  const hasStories = taggedStories.length > 0;

  if (!hasEvents && !hasStories) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <CalendarEmptyIcon className="w-12 h-12 text-purple-500/30" />
        <p className="text-sm text-gray-500">{t('profile.noUpcomingEvents')}</p>
      </div>
    );
  }

  const handleOpen = (post: FeedPost) => {
    onOpenPost?.(post);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">
      {hasStories ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-bold text-purple-300 uppercase tracking-wide px-0.5">
            {t('profile.taggedPublications')}
          </h3>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-2 w-max pb-1">
              {taggedStories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => onOpenProfile?.(story.userId)}
                  className="flex items-center gap-2 min-h-[44px] max-w-[min(100%,16rem)] rounded-xl border border-purple-500/25 bg-purple-950/30 px-2.5 py-2 hover:border-purple-400/40 transition text-left"
                >
                  <StoryAvatarRing
                    hasActiveStory
                    storyImageUrl={story.imageUrl}
                    avatarUrl={story.author.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400">{t('profile.taggedInStory')}</p>
                    <UsernameDisplay
                      username={story.author.username}
                      usernameColor={story.author.usernameColor}
                      usernameWaveFrom={story.author.usernameWaveFrom}
                      usernameWaveTo={story.author.usernameWaveTo}
                      className="text-xs font-semibold truncate block"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasEvents ? (
        <section className="flex flex-col gap-3">
          {hasStories ? (
            <h3 className="text-[11px] font-bold text-purple-300 uppercase tracking-wide px-0.5">
              {t('profile.taggedEventsSection')}
            </h3>
          ) : null}
          {posts.map((post) => {
            const isGuest = post.userId !== userId;
            return (
              <EventCard
                key={post.id}
                post={post}
                layout="vertical"
                compact
                onOpen={handleOpen}
                onOpenProfile={onOpenProfile}
                onOpenTaggedUser={onOpenProfile}
                onPostChange={(patch) =>
                  setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...patch } : p)))
                }
                extraBadges={
                  isGuest ? (
                    <>
                      <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-200 border border-sky-500/30">
                        {t('profile.eventGuestBadge')}
                      </span>
                      <span className="text-[9px] text-gray-400 truncate max-w-[10rem]">
                        {t('profile.eventByOrganizer', { username: post.author.username })}
                      </span>
                    </>
                  ) : null
                }
              />
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
