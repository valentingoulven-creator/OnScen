import { useCallback, useEffect, useRef, useState } from 'react';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe';
import { api } from '../lib/api';
import { STORY_APP_LINK_EVENT } from '../lib/storyAppLink';
import { STORY_VIEW_DURATION_MS, formatStoryTimeAgo } from '../lib/storyViewerNav';
import { storyViewDurationMs } from '../lib/storyVideo';
import { getDisplayDurationMs } from '../lib/sponsorDisplaySpec';
import { handleSponsorCta } from '../lib/sponsorAds';
import { SPONSOR_ACCENT_GRADIENTS, sponsorKindBadgeLabel } from '../lib/sponsorDisplaySpec';
import type { MapStory, ReelsSponsorAd } from '../types';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { StoryLinkOverlay } from './StoryLinkSticker';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';

export interface StoryViewerProps {
  story?: MapStory;
  /** Stories de l'utilisateur courant (pile), du plus ancien au plus récent. */
  stack?: MapStory[];
  stackIndex?: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  canNext: boolean;
  canPrev: boolean;
  /** Story de l'utilisateur connecté — affiche la suppression. */
  isOwn?: boolean;
  token?: string;
  onDeleted?: (story: MapStory) => void;
  /** Plein écran sponsorisé (visionneuse stories). */
  sponsorAd?: ReelsSponsorAd;
}

export function StoryViewer({
  story,
  stack,
  stackIndex,
  onClose,
  onNext,
  onPrev,
  canNext,
  canPrev,
  isOwn = false,
  token,
  onDeleted,
  sponsorAd,
}: StoryViewerProps) {
  const isSponsorSlide = Boolean(sponsorAd);
  const activeStory = story;
  const activeStack = stack ?? [];
  const activeStackIndex = stackIndex ?? 0;
  const segmentDurationMs = isSponsorSlide
    ? getDisplayDurationMs(sponsorAd?.displayDurationSec)
    : activeStory
      ? storyViewDurationMs(activeStory)
      : STORY_VIEW_DURATION_MS;
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const segmentStartRef = useRef(Date.now());
  const storyVideoRef = useRef<HTMLVideoElement>(null);
  const onNextRef = useRef(onNext);
  const onCloseRef = useRef(onClose);
  const canNextRef = useRef(canNext);

  useEffect(() => {
    onNextRef.current = onNext;
    onCloseRef.current = onClose;
    canNextRef.current = canNext;
  }, [onNext, onClose, canNext]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onAppLink = () => onCloseRef.current();
    window.addEventListener(STORY_APP_LINK_EVENT, onAppLink);
    return () => window.removeEventListener(STORY_APP_LINK_EVENT, onAppLink);
  }, []);

  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    segmentStartRef.current = Date.now();
    setPaused(false);
    setShowDeleteConfirm(false);
    setDeleteError(null);
  }, [activeStory?.id, sponsorAd?.id]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video || !activeStory?.videoUrl) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [activeStory?.id, activeStory?.videoUrl]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video || !activeStory?.videoUrl) return;
    if (paused) video.pause();
    else void video.play().catch(() => undefined);
  }, [paused, activeStory?.id, activeStory?.videoUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') {
        if (canNext) onNext();
        else onClose();
      } else if (e.key === 'ArrowLeft' && canPrev) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev, canNext, canPrev]);

  useEffect(() => {
    if (paused) return;
    let lastPaint = 0;
    const tick = (now: number) => {
      const elapsed = Date.now() - segmentStartRef.current;
      const p = Math.min(1, elapsed / segmentDurationMs);
      if (now - lastPaint >= 50 || p >= 1) {
        setProgress(p);
        progressRef.current = p;
        lastPaint = now;
      }
      if (p >= 1) {
        if (canNextRef.current) onNextRef.current();
        else onCloseRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeStory?.id, sponsorAd?.id, paused, segmentDurationMs]);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    const elapsed = progressRef.current * segmentDurationMs;
    segmentStartRef.current = Date.now() - elapsed;
    setPaused(false);
  }, [segmentDurationMs]);

  const horizontalSwipe = useHorizontalSwipe({
    enabled: true,
    onSwipeLeft: canNext ? onNext : undefined,
    onSwipeRight: canPrev ? onPrev : undefined,
    threshold: 50,
  });

  const verticalSwipe = useVerticalSwipe({
    enabled: true,
    onSwipeDown: onClose,
    threshold: 80,
  });

  const mergeTouch = {
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
      if (canPrev) onPrev();
      return;
    }
    if (canNext) onNext();
    else onClose();
  };

  const handleBackdropClose = () => {
    onClose();
  };

  const canDelete = !isSponsorSlide && isOwn && Boolean(token) && Boolean(onDeleted);

  const confirmDelete = useCallback(async () => {
    if (!token || !onDeleted || !activeStory) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteStory(token, activeStory.id);
      setShowDeleteConfirm(false);
      onDeleted(activeStory);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setDeleting(false);
    }
  }, [token, onDeleted, activeStory]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-black sm:bg-black/70 sm:backdrop-blur-sm p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={isSponsorSlide ? `Publicité ${sponsorAd?.title ?? ''}` : `Story de ${activeStory?.author.username ?? ''}`}
      onClick={handleBackdropClose}
      {...mergeTouch}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-md sm:max-h-[85dvh] flex flex-col overflow-hidden sm:rounded-2xl bg-[#12121a] sm:border sm:border-[#2d2d3d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barres de progression */}
        <div className="flex gap-1 px-3 ms-safe-area-top sm:pt-3 shrink-0">
          {isSponsorSlide ? (
            <div className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-300 transition-none"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          ) : (
            activeStack.map((seg, i) => {
              let fill = 0;
              if (i < activeStackIndex) fill = 1;
              else if (i === activeStackIndex) fill = progress;
              return (
                <div key={seg.id} className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white transition-none"
                    style={{ width: `${fill * 100}%` }}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0">
          {isSponsorSlide && sponsorAd ? (
            <div className="flex items-center gap-2 min-w-0">
              {sponsorAd.logoUrl?.trim() ? (
                <img
                  src={sponsorAd.logoUrl.trim()}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover bg-[#1a1a26] shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#1a1a26] flex items-center justify-center text-[9px] text-gray-500 shrink-0">
                  AD
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                  {sponsorKindBadgeLabel(sponsorAd.kind ?? 'sponsored')}
                </p>
                <p className="text-sm font-semibold text-white truncate">
                  {sponsorAd.sponsor?.trim() || sponsorAd.title}
                </p>
              </div>
            </div>
          ) : activeStory ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatarOnline
                userId={activeStory.author.id}
                username={activeStory.author.username}
                avatarUrl={activeStory.author.avatarUrl}
                size="sm"
              />
              <div className="min-w-0">
                <UsernameDisplay
                  username={activeStory.author.username}
                  usernameColor={activeStory.author.usernameColor}
                  usernameWaveFrom={activeStory.author.usernameWaveFrom}
                  usernameWaveTo={activeStory.author.usernameWaveTo}
                  className="text-sm font-semibold truncate block text-white"
                />
                <p className="text-[11px] text-gray-400">{formatStoryTimeAgo(activeStory.createdAt)}</p>
              </div>
              {activeStory.visibility ? (
                <span className="text-xs shrink-0" title={activeStory.visibility === 'public' ? 'Public' : 'Abonnés'}>
                  {activeStory.visibility === 'public' ? '🌍' : '👥'}
                </span>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteConfirm(true);
                }}
                className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                aria-label="Supprimer la story"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Fermer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Media ajusté (object-contain, plein écran sur mobile) */}
        <div className="relative flex-1 min-h-0 sm:min-h-[200px] sm:max-h-[55dvh] flex items-center justify-center bg-[#0b0b0f]">
          <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
            {isSponsorSlide && sponsorAd ? (
              <>
                {sponsorAd.videoUrl?.trim() ? (
                  <video
                    key={sponsorAd.id}
                    src={sponsorAd.videoUrl}
                    poster={sponsorAd.posterUrl?.trim() || sponsorAd.logoUrl?.trim()}
                    className="max-w-full max-h-full object-contain block"
                    playsInline
                    autoPlay
                    muted
                    loop
                  />
                ) : sponsorAd.posterUrl?.trim() || sponsorAd.logoUrl?.trim() ? (
                  <img
                    src={(sponsorAd.posterUrl || sponsorAd.logoUrl)!.trim()}
                    alt=""
                    className="max-w-full max-h-full object-contain block"
                    draggable={false}
                  />
                ) : (
                  <div
                    className={`w-full h-full min-h-[200px] bg-gradient-to-b ${SPONSOR_ACCENT_GRADIENTS[sponsorAd.accent ?? 'purple']}`}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
                  <div className="pointer-events-auto">
                    <p className="text-lg font-bold text-white leading-tight">{sponsorAd.title}</p>
                    <p className="text-sm text-white/85 mt-1 line-clamp-3">{sponsorAd.subtitle}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSponsorCta({
                          id: sponsorAd.id,
                          title: sponsorAd.title,
                          subtitle: sponsorAd.subtitle,
                          cta: sponsorAd.cta,
                          href: sponsorAd.href,
                          accent: sponsorAd.accent,
                          sponsor: sponsorAd.sponsor,
                          kind: sponsorAd.kind,
                          logoUrl: sponsorAd.logoUrl,
                          displayDurationSec: sponsorAd.displayDurationSec,
                        });
                      }}
                      className="mt-3 px-4 py-2.5 min-h-[44px] rounded-xl bg-white/15 border border-white/25 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
                    >
                      {sponsorAd.cta}
                    </button>
                  </div>
                </div>
              </>
            ) : activeStory?.videoUrl ? (
              <video
                ref={storyVideoRef}
                key={activeStory.id}
                src={activeStory.videoUrl}
                poster={activeStory.imageUrl}
                className="max-w-full max-h-full object-contain block"
                playsInline
                preload="auto"
                draggable={false}
              />
            ) : activeStory?.imageUrl ? (
              <img
                src={activeStory.imageUrl}
                alt=""
                className="max-w-full max-h-full object-contain block"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full min-h-[200px] bg-gradient-to-b from-[#1a1028] via-[#0b0b0f] to-[#12121a]" />
            )}

            {/* Zones tactiles gauche / droite + pause au maintien (sous le lien cliquable) */}
            <div className="absolute inset-0 z-10 flex pointer-events-none">
              <button
                type="button"
                className="w-[30%] h-full cursor-default pointer-events-auto"
                aria-label="Story précédente"
                onClick={() => handleTapZone('left')}
                onPointerDown={pause}
                onPointerUp={resume}
                onPointerLeave={resume}
                onPointerCancel={resume}
              />
              <button
                type="button"
                className="flex-1 h-full cursor-default pointer-events-auto"
                aria-label="Pause"
                onPointerDown={pause}
                onPointerUp={resume}
                onPointerLeave={resume}
                onPointerCancel={resume}
              />
              <button
                type="button"
                className="w-[30%] h-full cursor-default pointer-events-auto"
                aria-label="Story suivante"
                onClick={() => handleTapZone('right')}
                onPointerDown={pause}
                onPointerUp={resume}
                onPointerLeave={resume}
                onPointerCancel={resume}
              />
            </div>

            {!isSponsorSlide && activeStory?.link?.url ? (
              <StoryLinkOverlay link={activeStory.link} interactive="open" />
            ) : null}
          </div>
        </div>

        {!isSponsorSlide &&
        activeStory &&
        (activeStory.content ||
          activeStory.musicTrack ||
          activeStory.link?.url ||
          (activeStory.taggedUsers && activeStory.taggedUsers.length > 0)) && (
          <div className="shrink-0 px-4 py-3 ms-safe-area-bottom pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 overflow-y-auto max-h-[22dvh] border-t border-[#1e1e2f]">
            {activeStory.content ? (
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{activeStory.content}</p>
            ) : null}

            {activeStory.musicTrack ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 max-w-sm">
                <span className="text-lg" aria-hidden>
                  🎵
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-medium truncate">{activeStory.musicTrack.title}</p>
                  {activeStory.musicTrack.artist ? (
                    <p className="text-[10px] text-gray-500 truncate">{activeStory.musicTrack.artist}</p>
                  ) : null}
                </div>
                {activeStory.musicTrack.videoId ? (
                  <OpenOnYoutubeButton trackId={activeStory.musicTrack.videoId} variant="youtube-red" label="Écouter" />
                ) : activeStory.musicTrack.url ? (
                  <a
                    href={activeStory.musicTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                  >
                    Écouter
                  </a>
                ) : null}
              </div>
            ) : null}

            {activeStory.link?.url ? (
              <a
                href={activeStory.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 text-xs text-purple-300 hover:text-purple-200 max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden>🔗</span>
                <span className="truncate">{activeStory.link.label?.trim() || activeStory.link.url}</span>
              </a>
            ) : null}

            {activeStory.taggedUsers && activeStory.taggedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeStory.taggedUsers.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#1a1a28] border border-[#2d2d3d] pl-1 pr-2 py-0.5"
                  >
                    <UserAvatarOnline userId={t.id} username={t.username} avatarUrl={t.avatarUrl} size="sm" />
                    <UsernameDisplay
                      username={t.username}
                      usernameColor={t.usernameColor}
                      usernameWaveFrom={t.usernameWaveFrom}
                      usernameWaveTo={t.usernameWaveTo}
                      className="text-[10px] font-medium text-white"
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showDeleteConfirm ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="story-delete-title"
          onClick={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <p id="story-delete-title" className="text-lg font-bold text-white">
                Supprimer cette story ?
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Cette action est définitive. La story ne sera plus visible par vos abonnés.
              </p>
              {deleteError ? (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {deleteError}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="flex-1 py-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
