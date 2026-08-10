import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';
import { useCloudflareHlsPlayback } from '../hooks/useCloudflareHlsPlayback';
import { api } from '../lib/api';
import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import { resolveStoryLivePreviewCoverUrl } from '../lib/storyLivePreviewCover';
import {
  getLiveVideoAspectRatioPreset,
} from '../lib/liveVideoAspectRatio';
import { STORY_LIVE_PREVIEW_DURATION_MS } from '../lib/storyViewerNav';
import type { Live } from '../types';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';
import { StoryProgressBars } from './StoryProgressBars';

export interface StoryLivePreviewViewerProps {
  entry: MapStoryEntry;
  liveId: string;
  token: string;
  onClose: () => void;
  onJoin?: (liveId: string) => void;
  /** Durée d’aperçu avant `onPreviewElapsed` (bandeau stories). */
  previewDurationMs?: number;
  onPreviewElapsed?: () => void;
  onNext?: () => void;
  canNext?: boolean;
  onPrev?: () => void;
  canPrev?: boolean;
  onOpenProfile?: (userId: string) => void;
}

export function StoryLivePreviewViewer({
  entry,
  liveId,
  token,
  onClose,
  onJoin,
  previewDurationMs = STORY_LIVE_PREVIEW_DURATION_MS,
  onPreviewElapsed,
  onNext,
  canNext = Boolean(onNext),
  onPrev,
  canPrev = false,
  onOpenProfile,
}: StoryLivePreviewViewerProps) {
  const { t } = useTranslation();
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinBlocked, setJoinBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const segmentStartRef = useRef(Date.now());
  const rafRef = useRef(0);
  const onPreviewElapsedRef = useRef(onPreviewElapsed);

  useEffect(() => {
    onPreviewElapsedRef.current = onPreviewElapsed;
  }, [onPreviewElapsed]);

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
      else if (e.key === 'ArrowRight' && canNext && onNext) onNext();
      else if (e.key === 'ArrowLeft' && canPrev && onPrev) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev, canNext, canPrev]);

  const goNext = useCallback(() => {
    if (canNext && onNext) onNext();
  }, [canNext, onNext]);

  const goPrev = useCallback(() => {
    if (canPrev && onPrev) onPrev();
  }, [canPrev, onPrev]);

  const horizontalSwipe = useHorizontalSwipe({
    enabled: true,
    onSwipeLeft: canNext && onNext ? goNext : undefined,
    onSwipeRight: canPrev && onPrev ? goPrev : undefined,
  });

  const verticalSwipe = useVerticalSwipe({
    enabled: true,
    onSwipeDown: onClose,
    threshold: 80,
  });

  const touchHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      horizontalSwipe.onTouchStart(e);
      verticalSwipe.onTouchStart(e);
    },
    onTouchMove: (e: React.TouchEvent) => {
      horizontalSwipe.onTouchMove(e);
      verticalSwipe.onTouchMove(e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      horizontalSwipe.onTouchEnd(e);
      verticalSwipe.onTouchEnd(e);
    },
  };

  const handleTapZone = (side: 'left' | 'right') => {
    if (side === 'left') {
      goPrev();
      return;
    }
    goNext();
  };

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

  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    segmentStartRef.current = Date.now();
  }, [liveId]);

  useEffect(() => {
    if (loading || joinBlocked || !live?.isActive || !onPreviewElapsed) return;
    let lastPaint = 0;
    const tick = (now: number) => {
      const elapsed = Date.now() - segmentStartRef.current;
      const p = Math.min(1, elapsed / previewDurationMs);
      if (now - lastPaint >= 50 || p >= 1) {
        setProgress(p);
        progressRef.current = p;
        lastPaint = now;
      }
      if (p >= 1) {
        onPreviewElapsedRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [liveId, loading, joinBlocked, live?.isActive, onPreviewElapsed, previewDurationMs]);

  const coverUrl = resolveStoryLivePreviewCoverUrl(live, entry);
  const hostName = live?.hostName ?? entry.username;
  const viewersCount = live?.viewersCount ?? entry.liveViewersCount ?? 0;
  const viewersLabel =
    viewersCount > 0
      ? `${viewersCount} spectateur${viewersCount !== 1 ? 's' : ''}`
      : null;

  const isCloudflareHls =
    !!live?.isActive &&
    !!live.cloudflarePlaybackUrl?.trim() &&
    (live.streamMode === 'cloudflare' || live.presentationDemoStream === true);

  const hls = useCloudflareHlsPlayback({
    playbackUrl: isCloudflareHls ? live!.cloudflarePlaybackUrl : null,
    active: isCloudflareHls && !loading,
    obsIngestLive: live?.presentationDemoStream === true,
  });

  const showCoverUnderVideo = !isCloudflareHls || !hls.hlsStreamActive;

  const aspectPreset = getLiveVideoAspectRatioPreset(live?.videoAspectRatio);
  const panelAspectClass =
    aspectPreset === '9:16'
      ? 'sm:max-w-md sm:aspect-[9/16] sm:max-h-[min(calc(100dvh-2rem),calc((100vw-2rem)*16/9))]'
      : aspectPreset === '4:3'
        ? 'sm:max-w-xl sm:aspect-[4/3] sm:max-h-[min(calc(100dvh-2rem),90dvh)]'
        : 'sm:max-w-3xl sm:aspect-video sm:max-h-[min(calc(100dvh-2rem),90dvh)]';

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
      {...touchHandlers}
    >
      <div
        className={`relative w-full h-full sm:h-auto sm:w-full ${panelAspectClass} overflow-hidden sm:rounded-2xl bg-black sm:border sm:border-[#2d2d3d]/80 shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <StoryProgressBars
          segments={[{ id: liveId }]}
          activeIndex={0}
          progress={loading || joinBlocked || !live?.isActive ? 0 : progress}
          activeFillClassName="bg-red-400"
        />
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-black overflow-hidden">
          {showCoverUnderVideo ? (
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-90"
              draggable={false}
            />
          ) : null}
          {isCloudflareHls ? (
            <video
              ref={hls.hlsVideoRef}
              autoPlay
              playsInline
              muted
              className="relative z-[1] w-full h-full max-w-full max-h-full object-contain live-cloudflare-stage-video"
              style={{ opacity: hls.hlsStreamActive ? 1 : 0 }}
            />
          ) : null}
          <div className="absolute inset-0 z-[3] flex pointer-events-none">
            <button
              type="button"
              className="w-[30%] h-full pointer-events-auto min-h-[44px]"
              aria-label="Story précédente"
              onClick={() => handleTapZone('left')}
            />
            <div className="flex-1 min-w-0" aria-hidden />
            <button
              type="button"
              className="w-[30%] h-full pointer-events-auto min-h-[44px]"
              aria-label="Story suivante"
              onClick={() => handleTapZone('right')}
            />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 sm:h-32 bg-gradient-to-b from-black/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40 sm:h-44 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
          aria-hidden
        />

        {loading || (isCloudflareHls && !hls.hlsStreamActive && hls.hlsPhase !== 'error') ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
            <div className="h-8 w-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
        ) : null}

        {isCloudflareHls && hls.hlsPhase === 'error' && !hls.hlsStreamActive ? (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-[5] pointer-events-none">
            <p className="text-sm text-center text-amber-200/95 bg-black/55 border border-amber-500/25 rounded-xl px-3 py-2">
              Flux vidéo indisponible — touchez Rejoindre pour réessayer dans le live.
            </p>
          </div>
        ) : null}

        <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 pt-2 pb-8 pointer-events-auto">
          {onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(entry.userId)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg -ml-1 px-1 py-0.5 hover:bg-white/10 active:bg-white/15 transition min-h-[44px]"
              aria-label={t('reels.openAuthorProfile', {
                username: hostName,
                defaultValue: `Voir le profil de ${hostName}`,
              })}
            >
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
            </button>
          ) : (
            <>
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
            </>
          )}
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
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={handleJoin}
              disabled={joinBlocked || loading || !onJoin}
              className="flex-1 min-h-11 py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:via-rose-500 hover:to-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-red-900/40"
            >
              Rejoindre
            </button>
            {canNext && onNext ? (
              <button
                type="button"
                onClick={goNext}
                className="w-11 h-11 min-h-11 shrink-0 flex items-center justify-center rounded-2xl text-white/95 bg-white/10 hover:bg-white/15 border border-white/15 transition"
                aria-label="Story suivante"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
