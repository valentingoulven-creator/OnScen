import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe';
import { api } from '../lib/api';
import type { MapStoryEntry } from '../lib/mapStoriesFeed';
import {
  buildYouTubeEmbedUrl,
  computePlaybackPositionMs,
  resolveSalonYoutubeTrackId,
} from '../lib/salonPlayback';
import type { Salon } from '../types';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';

export interface StorySalonPreviewViewerProps {
  entry: MapStoryEntry;
  salonId: string;
  token: string;
  onClose: () => void;
  onJoin?: (salonId: string, salonTitle?: string) => void;
  onOpenProfile?: (userId: string) => void;
}

export function StorySalonPreviewViewer({
  entry,
  salonId,
  token,
  onClose,
  onJoin,
  onOpenProfile,
}: StorySalonPreviewViewerProps) {
  const { t } = useTranslation();
  const [salon, setSalon] = useState<Salon | null>(null);
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

  const verticalSwipe = useVerticalSwipe({
    enabled: true,
    onSwipeDown: onClose,
    threshold: 80,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .getSalon(token, salonId)
      .then(({ salon: fetched }) => {
        if (cancelled) return;
        setSalon(fetched);
        if (fetched.canJoin === false) setJoinBlocked(true);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le salon.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, salonId]);

  const hostName = salon?.hostName ?? entry.username;
  const salonTitle = salon?.title ?? entry.salonTitle ?? hostName;
  const listenersCount = salon?.listenersCount ?? 0;
  const listenersLabel =
    listenersCount > 0
      ? `${listenersCount} auditeur${listenersCount !== 1 ? 's' : ''}`
      : null;

  const track = salon?.playbackState;
  const videoId = track ? resolveSalonYoutubeTrackId(track) : undefined;
  const positionSec = videoId && track ? computePlaybackPositionMs(track) / 1000 : 0;
  const embedSrc = videoId
    ? buildYouTubeEmbedUrl(videoId, positionSec, true, { controls: true, mute: false })
    : null;

  const nowPlaying =
    track?.title?.trim() && track?.artist?.trim()
      ? `${track.title} — ${track.artist}`
      : track?.title?.trim() || null;

  const handleJoin = useCallback(() => {
    if (joinBlocked || loading || !onJoin) return;
    onJoin(salonId, salonTitle);
    onClose();
  }, [joinBlocked, loading, onJoin, salonId, salonTitle, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-black sm:bg-black/90 sm:backdrop-blur-sm p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Salon de ${hostName}`}
      onClick={onClose}
      onTouchStart={verticalSwipe.onTouchStart}
      onTouchMove={verticalSwipe.onTouchMove}
      onTouchEnd={verticalSwipe.onTouchEnd}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:w-full sm:max-w-3xl sm:aspect-video sm:max-h-[min(calc(100dvh-2rem),90dvh)] overflow-hidden sm:rounded-2xl bg-black sm:border sm:border-[#2d2d3d]/80 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center bg-[#0a0a12] overflow-hidden">
          {loading ? (
            <div className="h-8 w-8 rounded-full border-2 border-white/25 border-t-violet-400 animate-spin" />
          ) : embedSrc ? (
            <iframe
              src={embedSrc}
              title={salonTitle}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="px-6 text-center text-sm text-gray-400">
              {error ?? 'Aperçu indisponible — vous pouvez quand même rejoindre le salon.'}
            </div>
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 sm:h-32 bg-gradient-to-b from-black/80 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-44 sm:h-48 bg-gradient-to-t from-black/95 via-black/50 to-transparent"
          aria-hidden
        />

        <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 pt-2 pb-8 ms-safe-area-top pointer-events-auto">
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
                avatarUrl={entry.avatarUrl ?? salon?.hostAvatarUrl}
                size="sm"
                isSalon
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-violet-300 bg-violet-950/70 px-1.5 py-0.5 rounded border border-violet-500/35 shrink-0">
                    Salon
                  </span>
                  <UsernameDisplay
                    username={hostName}
                    usernameColor={salon?.hostUsernameColor}
                    usernameWaveFrom={salon?.hostUsernameWaveFrom}
                    usernameWaveTo={salon?.hostUsernameWaveTo}
                    className="text-sm font-semibold truncate block text-white"
                  />
                </div>
                <p className="text-[11px] text-white/75 truncate mt-0.5">{salonTitle}</p>
                {nowPlaying ? (
                  <p className="text-[10px] text-violet-200/80 truncate mt-0.5">{nowPlaying}</p>
                ) : null}
                {listenersLabel ? (
                  <p className="text-[11px] text-white/60 tabular-nums mt-0.5">{listenersLabel}</p>
                ) : null}
              </div>
            </button>
          ) : (
            <>
          <UserAvatarOnline
            userId={entry.userId}
            username={hostName}
            avatarUrl={entry.avatarUrl ?? salon?.hostAvatarUrl}
            size="sm"
            isSalon
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-violet-300 bg-violet-950/70 px-1.5 py-0.5 rounded border border-violet-500/35 shrink-0">
                Salon
              </span>
              <UsernameDisplay
                username={hostName}
                usernameColor={salon?.hostUsernameColor}
                usernameWaveFrom={salon?.hostUsernameWaveFrom}
                usernameWaveTo={salon?.hostUsernameWaveTo}
                className="text-sm font-semibold truncate block text-white"
              />
            </div>
            <p className="text-[11px] text-white/75 truncate mt-0.5">{salonTitle}</p>
            {nowPlaying ? (
              <p className="text-[10px] text-violet-200/80 truncate mt-0.5">{nowPlaying}</p>
            ) : null}
            {listenersLabel ? (
              <p className="text-[11px] text-white/60 tabular-nums mt-0.5">{listenersLabel}</p>
            ) : null}
          </div>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 shrink-0 min-w-11 min-h-11 flex items-center justify-center"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-10 px-4 ms-safe-area-bottom pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12">
          {error && !loading ? (
            <p className="text-sm text-center text-amber-200/95 bg-black/45 border border-amber-500/25 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinBlocked || loading || !onJoin}
            className="w-full min-h-11 py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-purple-900/40"
          >
            Rejoindre le salon
          </button>
        </div>
      </div>
    </div>
  );
}
