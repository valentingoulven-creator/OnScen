import { useCallback, useEffect, useRef, useState } from 'react';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe';
import { STORY_VIEW_DURATION_MS, formatStoryTimeAgo } from '../lib/storyViewerNav';
import type { MapStory } from '../types';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';

export interface StoryViewerProps {
  story: MapStory;
  /** Stories de l'utilisateur courant (pile), du plus ancien au plus récent. */
  stack: MapStory[];
  stackIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  canNext: boolean;
  canPrev: boolean;
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
}: StoryViewerProps) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const segmentStartRef = useRef(Date.now());

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
    segmentStartRef.current = Date.now();
    setPaused(false);
  }, [story.id]);

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
    const tick = () => {
      const elapsed = Date.now() - segmentStartRef.current;
      const p = Math.min(1, elapsed / STORY_VIEW_DURATION_MS);
      setProgress(p);
      progressRef.current = p;
      if (p >= 1) {
        if (canNext) onNext();
        else onClose();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [story.id, paused, canNext, onNext, onClose]);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    const elapsed = progressRef.current * STORY_VIEW_DURATION_MS;
    segmentStartRef.current = Date.now() - elapsed;
    setPaused(false);
  }, []);

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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${story.author.username}`}
      onClick={handleBackdropClose}
      {...mergeTouch}
    >
      <div
        className="relative w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden rounded-2xl bg-[#12121a] border border-[#2d2d3d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barres de progression */}
        <div className="flex gap-1 px-3 pt-3 shrink-0">
          {stack.map((seg, i) => {
            let fill = 0;
            if (i < stackIndex) fill = 1;
            else if (i === stackIndex) fill = progress;
            return (
              <div key={seg.id} className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-none"
                  style={{ width: `${fill * 100}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatarOnline
              userId={story.author.id}
              username={story.author.username}
              avatarUrl={story.author.avatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <UsernameDisplay
                username={story.author.username}
                usernameColor={story.author.usernameColor}
                usernameWaveFrom={story.author.usernameWaveFrom}
                usernameWaveTo={story.author.usernameWaveTo}
                className="text-sm font-semibold truncate block text-white"
              />
              <p className="text-[11px] text-gray-400">{formatStoryTimeAgo(story.createdAt)}</p>
            </div>
            {story.visibility ? (
              <span className="text-xs shrink-0" title={story.visibility === 'public' ? 'Public' : 'Abonnés'}>
                {story.visibility === 'public' ? '🌍' : '👥'}
              </span>
            ) : null}
          </div>
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

        {/* Media ajusté (object-contain, pas plein écran) */}
        <div className="relative flex-1 min-h-[200px] max-h-[50vh] flex items-center justify-center bg-[#0b0b0f]">
          {story.imageUrl ? (
            <img
              src={story.imageUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full min-h-[200px] bg-gradient-to-b from-[#1a1028] via-[#0b0b0f] to-[#12121a]" />
          )}

          {/* Zones tactiles gauche / droite + pause au maintien */}
          <div className="absolute inset-0 z-10 flex">
            <button
              type="button"
              className="w-[30%] h-full cursor-default"
              aria-label="Story précédente"
              onClick={() => handleTapZone('left')}
              onPointerDown={pause}
              onPointerUp={resume}
              onPointerLeave={resume}
              onPointerCancel={resume}
            />
            <button
              type="button"
              className="flex-1 h-full cursor-default"
              aria-label="Pause"
              onPointerDown={pause}
              onPointerUp={resume}
              onPointerLeave={resume}
              onPointerCancel={resume}
            />
            <button
              type="button"
              className="w-[30%] h-full cursor-default"
              aria-label="Story suivante"
              onClick={() => handleTapZone('right')}
              onPointerDown={pause}
              onPointerUp={resume}
              onPointerLeave={resume}
              onPointerCancel={resume}
            />
          </div>
        </div>

        {/* Contenu bas (texte, musique, tags) */}
        {(story.content || story.musicTrack || (story.taggedUsers && story.taggedUsers.length > 0)) && (
          <div className="shrink-0 px-4 py-3 space-y-2 overflow-y-auto max-h-[22vh] border-t border-[#1e1e2f]">
            {story.content ? (
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{story.content}</p>
            ) : null}

            {story.musicTrack ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 max-w-sm">
                <span className="text-lg" aria-hidden>
                  🎵
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-medium truncate">{story.musicTrack.title}</p>
                  {story.musicTrack.artist ? (
                    <p className="text-[10px] text-gray-500 truncate">{story.musicTrack.artist}</p>
                  ) : null}
                </div>
                {story.musicTrack.videoId ? (
                  <OpenOnYoutubeButton trackId={story.musicTrack.videoId} variant="youtube-red" label="Écouter" />
                ) : story.musicTrack.url ? (
                  <a
                    href={story.musicTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                  >
                    Écouter
                  </a>
                ) : null}
              </div>
            ) : null}

            {story.taggedUsers && story.taggedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {story.taggedUsers.map((t) => (
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
    </div>
  );
}
