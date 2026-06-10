import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  formatEventDate,
  formatWeekRangeLabel,
  getCurrentWeekRange,
  isEventDateInWeek,
} from '../lib/feedEvents';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { FeedPost } from '../types';

interface MapEventsSheetProps {
  token: string;
  onClose: () => void;
  onSelectPost: (postId: string) => void;
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function EventRow({ post, onSelect }: { post: FeedPost; onSelect: () => void }) {
  const title = post.content.trim() || 'Événement';
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-2 hover:border-purple-400/50 hover:bg-purple-950/35 transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-2.5">
        <UserAvatarOnline
          userId={post.author.id}
          avatarUrl={post.author.avatarUrl}
          username={post.author.username}
          size="sm"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <UsernameDisplay
            username={post.author.username}
            usernameColor={post.author.usernameColor}
            usernameWaveFrom={post.author.usernameWaveFrom}
            usernameWaveTo={post.author.usernameWaveTo}
            className="text-sm font-semibold truncate block"
          />
          <p className="text-sm text-gray-100 line-clamp-2 leading-snug">{title}</p>
        </div>
      </div>
      {post.eventDate && (
        <div className="flex items-start gap-2 pl-0.5">
          <CalendarIcon className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <span className="text-xs text-purple-100 capitalize leading-snug">{formatEventDate(post.eventDate)}</span>
        </div>
      )}
      {post.eventLocation && (
        <div className="flex items-start gap-2 pl-0.5">
          <MapPinIcon className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
          <span className="text-xs text-gray-300 line-clamp-2">{post.eventLocation}</span>
        </div>
      )}
    </button>
  );
}

export function MapEventsSheet({ token, onClose, onSelectPost }: MapEventsSheetProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekRange = useMemo(() => getCurrentWeekRange(), []);
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekRange), [weekRange]);

  const weekEvents = useMemo(
    () =>
      posts
        .filter((p) => p.isEvent && p.eventDate && isEventDateInWeek(p.eventDate, weekRange))
        .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime()),
    [posts, weekRange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFeedPosts(token, { eventsOnly: true, limit: 50 })
      .then((r) => {
        if (!cancelled) setPosts(r.posts);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Impossible de charger les événements');
          setPosts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-events-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[min(85dvh,36rem)] flex flex-col bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-4 border-b border-[#1e1e2f] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="map-events-title" className="font-bold text-white flex items-center gap-2">
              <span aria-hidden>📅</span>
              Évènements
            </h2>
            <p className="text-[11px] text-purple-300/80 mt-0.5 truncate">Cette semaine · {weekLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-400">
              <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
              <p className="text-sm">Chargement des événements…</p>
            </div>
          )}
          {!loading && error && <p className="text-sm text-red-400 text-center py-6">{error}</p>}
          {!loading && !error && weekEvents.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">Aucun événement cette semaine</p>
          )}
          {!loading &&
            !error &&
            weekEvents.map((post) => (
              <EventRow
                key={post.id}
                post={post}
                onSelect={() => {
                  onClose();
                  onSelectPost(post.id);
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
