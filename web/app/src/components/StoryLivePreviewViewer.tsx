import { useEffect, useState } from 'react';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe';
import { api } from '../lib/api';
import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import { resolveStoryLivePreviewCoverUrl } from '../lib/storyLivePreviewCover';
import type { Live } from '../types';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';

export interface StoryLivePreviewViewerProps {
  entry: MapStoryEntry;
  liveId: string;
  token: string;
  onClose: () => void;
  onJoin?: (liveId: string) => void;
}

export function StoryLivePreviewViewer({
  entry,
  liveId,
  token,
  onClose,
  onJoin,
}: StoryLivePreviewViewerProps) {
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinBlocked, setJoinBlocked] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
    setJoinBlocked(false);
    setLive(null);

    api
      .getLive(token, liveId)
      .then(({ live: fetched }) => {
        if (cancelled) return;
        if (!fetched.isActive) {
          setError('Ce live est terminé.');
          setJoinBlocked(true);
          return;
        }
        setLive(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Impossible de charger ce live.';
        setError(message);
        if (err instanceof Error && 'liveBanned' in err && (err as { liveBanned?: boolean }).liveBanned) {
          setJoinBlocked(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, liveId]);

  const verticalSwipe = useVerticalSwipe({
    enabled: true,
    onSwipeDown: onClose,
    threshold: 80,
  });

  const coverUrl = resolveStoryLivePreviewCoverUrl(live, entry);
  const hostName = live?.hostName ?? entry.username;
  const viewersCount = live?.viewersCount ?? entry.liveViewersCount ?? 0;
  const viewersLabel =
    viewersCount > 0
      ? `${viewersCount} spectateur${viewersCount !== 1 ? 's' : ''}`
      : null;

  const handleJoin = () => {
    if (joinBlocked || loading || !onJoin) return;
    onJoin(liveId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-black sm:bg-black/90 sm:backdrop-blur-sm p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Live de ${hostName}`}
      onClick={onClose}
      {...verticalSwipe}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-md sm:aspect-[9/16] sm:max-h-[min(calc(100dvh-2rem),calc((100vw-2rem)*16/9))] overflow-hidden sm:rounded-2xl bg-[#0b0b0f] sm:border sm:border-[#2d2d3d]/80 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/75" />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="h-8 w-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
        ) : null}

        <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 ms-safe-area-top pb-8">
          <UserAvatarOnline
            userId={entry.userId}
            username={hostName}
            avatarUrl={entry.avatarUrl}
            size="sm"
            isLive
            liveViewersCount={viewersCount > 0 ? viewersCount : undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/30 shrink-0">
                Live
              </span>
              <UsernameDisplay
                username={hostName}
                usernameColor={live?.hostUsernameColor}
                usernameWaveFrom={live?.hostUsernameWaveFrom}
                usernameWaveTo={live?.hostUsernameWaveTo}
                className="text-sm font-semibold truncate block text-white"
              />
            </div>
            {viewersLabel ? (
              <p className="text-[11px] text-white/70 tabular-nums mt-0.5">{viewersLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-10 px-4 ms-safe-area-bottom pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 space-y-3">
          {error ? (
            <p className="text-sm text-center text-amber-200/95 bg-black/45 border border-amber-500/25 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinBlocked || loading || !onJoin}
            className="w-full py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:via-rose-500 hover:to-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-red-900/40"
          >
            Rejoindre
          </button>
        </div>
      </div>
    </div>
  );
}
