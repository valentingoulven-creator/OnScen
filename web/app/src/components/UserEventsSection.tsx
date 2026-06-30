import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { hasUpcomingEventDate, getPrimaryEventDate } from '../lib/feedEvents';
import { EventCard } from './EventCard';
import type { FeedPost } from '../types';

interface UserEventsSectionProps {
  userId: string;
  onOpenPost?: (post: FeedPost) => void;
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

export function UserEventsSection({ userId, onOpenPost }: UserEventsSectionProps) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [posts, setPosts] = useState<FeedPost[]>([]);
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

    api
      .getFeedPosts(token, {
        eventsOnly: true,
        userEventsOnly: true,
        authorId: userId,
        limit: 100,
      })
      .then((data) => {
        if (ctrl.signal.aborted) return;

        const upcoming = data.posts
          .filter((p) => hasUpcomingEventDate(p))
          .sort((a, b) => {
            const da = getPrimaryEventDate(a);
            const db_ = getPrimaryEventDate(b);
            if (!da) return 1;
            if (!db_) return -1;
            return new Date(da).getTime() - new Date(db_).getTime();
          });

        setPosts(upcoming);
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

  if (posts.length === 0) {
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
    <div className="flex flex-col gap-3 p-4 max-w-lg mx-auto w-full">
      {posts.map((post) => (
        <EventCard
          key={post.id}
          post={post}
          layout="vertical"
          compact
          showUpcomingBadge
          onOpen={handleOpen}
        />
      ))}
    </div>
  );
}
