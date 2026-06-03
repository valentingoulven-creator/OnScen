import { useCallback, useEffect, useRef, useState } from 'react';
import { usePauseMediaOnPageHidden } from '../hooks/usePauseMediaOnPageHidden';
import { REELS_DEMO_VIDEO_COUNT, type MusicReel } from '../content/reels';
import { isMsdevEnvironment } from '../lib/liveCameraSupport';
import { formatReelDuration } from '../lib/reelDuration';
import {
  buildReelsFeed,
  fallbackPosterForReel,
  normalizeProfileReelFromApi,
  reelHasPlayableAudio,
  resolveReelsFeed,
} from '../content/reelsFeed';
import { useAuth } from '../context/AuthContext';
import { ShareLinkMenu } from '../components/ShareLinkMenu';
import { api } from '../lib/api';
import { getFeedAlgorithmPreferences } from '../lib/reelFeedAlgorithm';
import {
  applyClientFeedRanking,
  clearLastTabStartReelId,
  pickNextStartIndex,
  readLastTabStartReelId,
  rememberTabStartReelId,
} from '../lib/reelFeedRankingClient';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import { pauseAllReelsMediaInDom } from '../lib/reelsMedia';
import { getSocket } from '../lib/socket';
import type { ReelComment, ReelStats } from '../types';

const SWIPE_THRESHOLD_PX = 22;
const SWIPE_VELOCITY_PX_MS = 0.32;
const REELS_UNMUTED_KEY = 'melosong_reels_unmuted';
/** Zone centrale (tap) : pause / lecture — 30 %–70 % de la largeur et hauteur. */
const CENTER_TAP_MIN = 0.3;
const CENTER_TAP_MAX = 0.7;
const TAP_MOVE_THRESHOLD_PX = 14;

function isCenterTap(clientX: number, clientY: number, rect: DOMRect): boolean {
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  return relX >= CENTER_TAP_MIN && relX <= CENTER_TAP_MAX && relY >= CENTER_TAP_MIN && relY <= CENTER_TAP_MAX;
}

function readReelsUnmutedPreference(): boolean {
  try {
    return sessionStorage.getItem(REELS_UNMUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistReelsUnmutedPreference(unmuted: boolean) {
  try {
    sessionStorage.setItem(REELS_UNMUTED_KEY, unmuted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function applyVideoAudio(video: HTMLVideoElement, muted: boolean, separateAudio = false) {
  const videoMuted = separateAudio || muted;
  video.muted = videoMuted;
  video.volume = videoMuted ? 0 : 1;
}

function applyReelAudio(audio: HTMLAudioElement, muted: boolean) {
  audio.muted = muted;
  audio.volume = muted ? 0 : 1;
}

function seekToStart(...elements: (HTMLMediaElement | null | undefined)[]) {
  for (const el of elements) {
    if (!el) continue;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}

async function playMediaElement(el: HTMLMediaElement, wantMuted: boolean): Promise<void> {
  el.muted = wantMuted;
  el.volume = wantMuted ? 0 : 1;
  try {
    await el.play();
  } catch {
    if (!wantMuted) {
      el.muted = true;
      try {
        await el.play();
      } catch {
        /* ignore */
      }
    }
  }
}

/** One active reel: Mixkit b-roll (muted) + optional MP3 started together at 0. */
async function playActiveReelMedia(
  reel: MusicReel,
  video: HTMLVideoElement,
  audio: HTMLAudioElement | null,
  wantMuted: boolean,
  isStale: () => boolean
) {
  if (isStale()) return;
  const separateAudio = !!reel.audioUrl?.trim();
  video.pause();
  audio?.pause();
  seekToStart(video, audio);
  applyVideoAudio(video, wantMuted, separateAudio);
  if (audio) applyReelAudio(audio, wantMuted);
  await playMediaElement(video, separateAudio || wantMuted);
  if (isStale()) {
    video.pause();
    audio?.pause();
    return;
  }
  if (separateAudio && audio) {
    await playMediaElement(audio, wantMuted);
    if (isStale()) {
      video.pause();
      audio.pause();
    }
  }
}

const FALLBACK_REELS = buildReelsFeed([]);

function findReelIndex(feed: MusicReel[], reelId: string): number {
  const i = feed.findIndex((r) => r.id === reelId);
  return i >= 0 ? i : 0;
}

const DEFAULT_STATS: ReelStats = {
  heartCount: 0,
  commentCount: 0,
  shareCount: 0,
  likedByMe: false,
  sharedByMe: false,
  commentedByMe: false,
};

interface ReelsTabPageProps {
  onOpenLive?: (liveId: string) => void;
  initialReelId?: string;
  onIntentHandled?: () => void;
  /** False when leaving the Reels tab or opening profile — stops all media. */
  isActive?: boolean;
}

export function ReelsTabPage({
  onOpenLive: _onOpenLive,
  initialReelId,
  onIntentHandled,
  isActive = true,
}: ReelsTabPageProps) {
  const { token } = useAuth();
  const [feedReels, setFeedReels] = useState<MusicReel[]>(FALLBACK_REELS);
  const [feedLoading, setFeedLoading] = useState(false);
  const reels = feedReels;
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRefsById = useRef(new Map<string, HTMLVideoElement>());
  const audioRefsById = useRef(new Map<string, HTMLAudioElement>());
  const playRetryRef = useRef<number | null>(null);
  const playGenerationRef = useRef(0);
  const playScheduleRef = useRef<number | null>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const [scrollSnapDuringTouch, setScrollSnapDuringTouch] = useState(false);
  const reelsRef = useRef(reels);
  reelsRef.current = reels;
  const feedReelsRef = useRef(feedReels);
  feedReelsRef.current = feedReels;
  const wasTabActiveRef = useRef(isActive);
  const hasLoadedFeedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef(0);
  const touchActive = useRef(false);
  const activeIndexRef = useRef(0);
  const pausedByPageHiddenRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(() => !readReelsUnmutedPreference());
  const mutedRef = useRef(muted);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const playbackPausedRef = useRef(false);
  const [stats, setStats] = useState<ReelStats>(DEFAULT_STATS);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const initialScrollDone = useRef(false);
  const viewedReelsThisSession = useRef(new Set<string>());

  const activeReel = reels[activeIndex];

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    playbackPausedRef.current = false;
    setPlaybackPaused(false);
  }, [activeReel?.id]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    initialScrollDone.current = false;
  }, [initialReelId]);

  useEffect(() => {
    if (!initialReelId || initialScrollDone.current || reels.length === 0) return;
    const found = reels.some((r) => r.id === initialReelId);
    if (!found && token) {
      api
        .getReel(token, initialReelId)
        .then((r) => {
          const extra = normalizeProfileReelFromApi(r.reel);
          if (!extra) return;
          setFeedReels((prev) => {
            if (prev.some((reel) => reel.id === extra.id)) return prev;
            return [extra, ...prev];
          });
        })
        .catch(() => undefined);
      return;
    }
    const index = findReelIndex(reels, initialReelId);
    initialScrollDone.current = true;
    setActiveIndex(index);
    const el = scrollRef.current;
    if (el && el.clientWidth > 0) {
      el.scrollTo({ left: index * el.clientWidth, behavior: 'auto' });
    }
    onIntentHandled?.();
  }, [initialReelId, reels, onIntentHandled, token]);

  const activeHasSound =
    !!activeReel &&
    activeReel.mediaType !== 'image' &&
    (!!activeReel.videoUrl || !!activeReel.audioUrl) &&
    reelHasPlayableAudio(activeReel);

  const applyAlgorithmStartIndex = useCallback((feed: MusicReel[]) => {
    if (feed.length === 0) return;
    const start = pickNextStartIndex(feed, readLastTabStartReelId());
    setActiveIndex(start);
    initialScrollDone.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.clientWidth > 0) {
        el.scrollTo({ left: start * el.clientWidth, behavior: 'auto' });
      }
    });
    rememberTabStartReelId(feed[start]!.id);
  }, []);

  const refreshFeedWithStart = useCallback(
    async (options?: { skipStartIndex?: boolean; silent?: boolean }) => {
      const prefs = getFeedAlgorithmPreferences();
      const skipStart = options?.skipStartIndex === true || !!initialReelId;
      const showLoading = !options?.silent || feedReelsRef.current.length === 0;

      if (!token) {
        const feed = applyClientFeedRanking(buildReelsFeed([]), prefs);
        setFeedReels(feed);
        if (!skipStart) applyAlgorithmStartIndex(feed);
        setFeedLoading(false);
        return;
      }

      if (showLoading) setFeedLoading(true);
      try {
        const r = await api.getReelsFeed(token, prefs);
        const feed = resolveReelsFeed(r.reels);
        setFeedReels(feed);
        if (!skipStart) applyAlgorithmStartIndex(feed);
      } catch {
        const feed = applyClientFeedRanking(buildReelsFeed([]), prefs);
        setFeedReels(feed);
        if (!skipStart) applyAlgorithmStartIndex(feed);
      } finally {
        setFeedLoading(false);
      }
    },
    [token, initialReelId, applyAlgorithmStartIndex]
  );

  useEffect(() => {
    const entered = isActive && !wasTabActiveRef.current;
    wasTabActiveRef.current = isActive;
    if (!isActive) return;

    if (!hasLoadedFeedRef.current) {
      hasLoadedFeedRef.current = true;
      void refreshFeedWithStart({
        skipStartIndex: !!initialReelId,
        silent: false,
      });
      return;
    }

    if (entered) {
      if (!initialReelId && feedReelsRef.current.length > 0) {
        applyAlgorithmStartIndex(feedReelsRef.current);
      }
      void refreshFeedWithStart({
        skipStartIndex: true,
        silent: true,
      });
    }
  }, [isActive, initialReelId, refreshFeedWithStart, applyAlgorithmStartIndex]);

  useEffect(() => {
    const onSettings = () => {
      clearLastTabStartReelId();
      if (!isActive) return;
      void refreshFeedWithStart({ skipStartIndex: !!initialReelId });
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettings);
  }, [isActive, initialReelId, refreshFeedWithStart]);

  useEffect(() => {
    if (!token || !isActive || !activeReel?.id) return;
    const reelId = activeReel.id;
    if (viewedReelsThisSession.current.has(reelId)) return;
    viewedReelsThisSession.current.add(reelId);
    api.recordReelView(token, reelId).catch(() => undefined);
  }, [token, isActive, activeReel?.id]);

  const goToIndex = useCallback((index: number, scrollBehavior: ScrollBehavior = 'smooth') => {
    const clamped = Math.max(0, Math.min(reels.length - 1, index));
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: clamped * w, behavior: scrollBehavior });
    setActiveIndex(clamped);
  }, [reels.length]);

  const settleScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el || touchActive.current || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(reelsRef.current.length - 1, index));
    const targetLeft = clamped * el.clientWidth;
    if (Math.abs(el.scrollLeft - targetLeft) > 2) {
      el.scrollTo({ left: targetLeft, behavior: 'auto' });
    }
    if (clamped !== activeIndexRef.current) {
      setActiveIndex(clamped);
    }
  }, []);

  const syncIndexFromScroll = useCallback(() => {
    if (touchActive.current) return;
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(reels.length - 1, index));
    if (clamped !== activeIndexRef.current) {
      playGenerationRef.current += 1;
      if (playScheduleRef.current) {
        clearTimeout(playScheduleRef.current);
        playScheduleRef.current = null;
      }
      pauseAllReelsMediaInDom();
    }
    setActiveIndex(clamped);
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = window.setTimeout(() => {
      scrollSettleTimerRef.current = null;
      settleScrollPosition();
    }, 140);
  }, [reels.length, settleScrollPosition]);

  const snapIndexFromScroll = useCallback((): number => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return activeIndexRef.current;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    return Math.max(0, Math.min(reels.length - 1, index));
  }, [reels.length]);

  const finishTouchGesture = useCallback(
    (endX: number) => {
      touchActive.current = false;
      const start = touchStartX.current;
      touchStartX.current = null;

      const resumeAfterSwipe = (targetIndex: number) => {
        goToIndex(targetIndex, 'auto');
      };

      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) {
        return;
      }

      const scrollSnap = snapIndexFromScroll();
      const baseIndex = activeIndexRef.current;

      if (start == null) {
        resumeAfterSwipe(scrollSnap);
        return;
      }

      const delta = start - endX;
      const dt = Math.max(1, Date.now() - touchStartTime.current);
      const velocity = delta / dt;

      // Reels UX (Instagram/TikTok): swipe LEFT (finger ←) reveals the next reel;
      // swipe RIGHT (finger →) goes back to the previous reel.
      const wantNext = delta > SWIPE_THRESHOLD_PX || velocity > SWIPE_VELOCITY_PX_MS;
      const wantPrev = delta < -SWIPE_THRESHOLD_PX || velocity < -SWIPE_VELOCITY_PX_MS;

      let targetIndex = scrollSnap;
      if (wantNext) targetIndex = baseIndex + 1;
      else if (wantPrev) targetIndex = baseIndex - 1;

      resumeAfterSwipe(targetIndex);
    },
    [goToIndex, snapIndexFromScroll]
  );

  const loadStats = useCallback(
    async (reelId: string) => {
      if (!token) {
        setStats(DEFAULT_STATS);
        return;
      }
      try {
        const r = await api.getReelStats(token, reelId);
        setStats(r.stats);
      } catch {
        setStats(DEFAULT_STATS);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!activeReel) return;
    void loadStats(activeReel.id);
    setCommentsOpen(false);
  }, [activeReel?.id, loadStats]);

  useEffect(() => {
    if (!activeReel || !token) return;
    const socket = getSocket();
    socket.emit('join_reel', { reelId: activeReel.id });
    const onComment = (comment: ReelComment) => {
      if (comment.reelId !== activeReel.id) return;
      void loadStats(activeReel.id);
    };
    socket.on('reel_comment', onComment);
    return () => {
      socket.emit('leave_reel', { reelId: activeReel.id });
      socket.off('reel_comment', onComment);
    };
  }, [activeReel?.id, token]);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const reelHasSeparateAudio = useCallback((reel: MusicReel | undefined) => !!reel?.audioUrl?.trim(), []);

  const applyMuteStateToAllRefs = useCallback((wantMuted: boolean) => {
    const list = reelsRef.current;
    const activeId = list[activeIndexRef.current]?.id;
    videoRefsById.current.forEach((video, reelId) => {
      const reel = list.find((r) => r.id === reelId);
      const separateAudio = reelHasSeparateAudio(reel);
      const forActive = reelId === activeId;
      applyVideoAudio(video, forActive ? wantMuted : true, separateAudio);
    });
    audioRefsById.current.forEach((audio, reelId) => {
      applyReelAudio(audio, reelId === activeId ? wantMuted : true);
    });
  }, [reelHasSeparateAudio]);

  const cancelPlayRetry = useCallback(() => {
    if (playRetryRef.current != null) {
      cancelAnimationFrame(playRetryRef.current);
      playRetryRef.current = null;
    }
  }, []);

  const stopAllReelsMedia = useCallback(() => {
    cancelPlayRetry();
    const list = reelsRef.current;
    videoRefsById.current.forEach((video, reelId) => {
      const reel = list.find((r) => r.id === reelId);
      const separateAudio = reelHasSeparateAudio(reel);
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      applyVideoAudio(video, true, separateAudio);
    });
    audioRefsById.current.forEach((audio) => {
      audio.pause();
      audio.playbackRate = 1;
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      applyReelAudio(audio, true);
    });
    pauseAllReelsMediaInDom();
  }, [reelHasSeparateAudio, cancelPlayRetry]);

  const pauseInactiveReelsMedia = useCallback(
    (activeId: string) => {
      const list = reelsRef.current;
      videoRefsById.current.forEach((video, reelId) => {
        if (reelId === activeId) return;
        const reel = list.find((r) => r.id === reelId);
        const reelSeparateAudio = reelHasSeparateAudio(reel);
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
        applyVideoAudio(video, true, reelSeparateAudio);
      });
      audioRefsById.current.forEach((audio, reelId) => {
        if (reelId === activeId) return;
        audio.pause();
        audio.playbackRate = 1;
        try {
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        applyReelAudio(audio, true);
      });
    },
    [reelHasSeparateAudio]
  );

  const playActiveReel = useCallback(
    (index: number, wantMuted: boolean) => {
      if (!isActiveRef.current) {
        stopAllReelsMedia();
        return;
      }

      const generation = ++playGenerationRef.current;
      const isStale = () => generation !== playGenerationRef.current || !isActiveRef.current;

      const list = reelsRef.current;
      const active = list[index];
      if (!active) {
        stopAllReelsMedia();
        return;
      }

      const separateAudio = reelHasSeparateAudio(active);

      const video = videoRefsById.current.get(active.id);
      const audio = audioRefsById.current.get(active.id);

      if (playbackPausedRef.current) {
        pauseInactiveReelsMedia(active.id);
        video?.pause();
        audio?.pause();
        return;
      }

      pauseInactiveReelsMedia(active.id);

      if (!video || (separateAudio && !audio)) {
        cancelPlayRetry();
        playRetryRef.current = requestAnimationFrame(() => {
          playRetryRef.current = null;
          if (isStale()) return;
          playActiveReel(index, wantMuted);
        });
        return;
      }

      cancelPlayRetry();
      void playActiveReelMedia(active, video, separateAudio ? audio ?? null : null, wantMuted, isStale);
    },
    [reelHasSeparateAudio, stopAllReelsMedia, cancelPlayRetry, pauseInactiveReelsMedia]
  );

  const schedulePlayActiveReel = useCallback(
    (delayMs = 48) => {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
      playScheduleRef.current = window.setTimeout(() => {
        playScheduleRef.current = null;
        if (!isActiveRef.current) return;
        playActiveReel(activeIndexRef.current, mutedRef.current);
      }, delayMs);
    },
    [playActiveReel]
  );

  usePauseMediaOnPageHidden({
    onPageHidden: () => {
      pausedByPageHiddenRef.current = true;
      stopAllReelsMedia();
    },
    onPageVisible: () => {
      if (!pausedByPageHiddenRef.current) return;
      pausedByPageHiddenRef.current = false;
      if (!isActiveRef.current) return;
      playActiveReel(activeIndexRef.current, mutedRef.current);
    },
  });

  const enableSound = useCallback(() => {
    persistReelsUnmutedPreference(true);
    mutedRef.current = false;
    setMuted(false);
    applyMuteStateToAllRefs(false);
    playActiveReel(activeIndexRef.current, false);
  }, [applyMuteStateToAllRefs, playActiveReel]);

  const disableSound = useCallback(() => {
    persistReelsUnmutedPreference(false);
    mutedRef.current = true;
    setMuted(true);
    applyMuteStateToAllRefs(true);
    playActiveReel(activeIndexRef.current, true);
  }, [applyMuteStateToAllRefs, playActiveReel]);

  const tapVideoForSound = useCallback(() => {
    if (muted) enableSound();
  }, [muted, enableSound]);

  const pauseActiveReelMedia = useCallback(() => {
    const active = reelsRef.current[activeIndexRef.current];
    if (!active) return;
    cancelPlayRetry();
    if (playScheduleRef.current) {
      clearTimeout(playScheduleRef.current);
      playScheduleRef.current = null;
    }
    playGenerationRef.current += 1;
    videoRefsById.current.get(active.id)?.pause();
    audioRefsById.current.get(active.id)?.pause();
  }, [cancelPlayRetry]);

  const togglePlaybackPause = useCallback(() => {
    const next = !playbackPausedRef.current;
    playbackPausedRef.current = next;
    setPlaybackPaused(next);
    if (next) {
      pauseActiveReelMedia();
      return;
    }
    playActiveReel(activeIndexRef.current, mutedRef.current);
  }, [pauseActiveReelMedia, playActiveReel]);

  const toggleMute = useCallback(() => {
    if (muted) enableSound();
    else disableSound();
  }, [muted, enableSound, disableSound]);

  useEffect(() => {
    if (!isActive) {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
      playbackPausedRef.current = false;
      setPlaybackPaused(false);
      stopAllReelsMedia();
      return;
    }
    if (playbackPausedRef.current) return;
    playGenerationRef.current += 1;
    pauseAllReelsMediaInDom();
    schedulePlayActiveReel();
    return () => {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
    };
  }, [activeIndex, activeReel?.id, isActive, schedulePlayActiveReel, stopAllReelsMedia]);

  useEffect(() => {
    if (!isActive) return;
    if (playbackPausedRef.current) return;
    playGenerationRef.current += 1;
    pauseAllReelsMediaInDom();
    playActiveReel(activeIndexRef.current, mutedRef.current);
  }, [muted, isActive, playActiveReel]);

  useEffect(() => {
    return () => {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
      if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
      stopAllReelsMedia();
      videoRefsById.current.clear();
      audioRefsById.current.clear();
    };
  }, [stopAllReelsMedia]);

  const resolveMuted = useCallback(() => mutedRef.current, []);

  useEffect(() => {
    const onResize = () => goToIndex(activeIndex);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex, goToIndex]);

  useEffect(() => {
    if (!shareToast) return;
    const t = window.setTimeout(() => setShareToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [shareToast]);

  const onTouchStart = (e: React.TouchEvent) => {
    playGenerationRef.current += 1;
    cancelPlayRetry();
    if (playScheduleRef.current) {
      clearTimeout(playScheduleRef.current);
      playScheduleRef.current = null;
    }
    pauseAllReelsMediaInDom();
    touchActive.current = true;
    setScrollSnapDuringTouch(true);
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current ?? 0;
    finishTouchGesture(endX);
    setScrollSnapDuringTouch(false);
  };

  const onTouchCancel = () => {
    finishTouchGesture(touchStartX.current ?? 0);
    setScrollSnapDuringTouch(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') goToIndex(activeIndex + 1);
    if (e.key === 'ArrowLeft') goToIndex(activeIndex - 1);
  };

  const toggleHeart = async () => {
    if (!token || !activeReel) return;
    try {
      const r = await api.toggleReelHeart(token, activeReel.id);
      setStats((s) => ({ ...s, likedByMe: r.liked, heartCount: r.heartCount }));
    } catch {
      /* ignore */
    }
  };

  const reelShareUrl = activeReel
    ? `${window.location.origin}${window.location.pathname}?reel=${activeReel.id}`
    : '';

  const recordReelShare = async () => {
    if (!token || !activeReel || stats.sharedByMe) return;
    try {
      const r = await api.shareReel(token, activeReel.id);
      setStats((s) => ({ ...s, shareCount: r.shareCount, sharedByMe: true }));
    } catch {
      /* ignore */
    }
  };

  const onCommentPosted = (commentCount: number) => {
    setStats((s) => ({ ...s, commentCount, commentedByMe: true }));
  };

  return (
    <div
      data-reels-root
      className="relative flex flex-col flex-1 min-h-0 w-full bg-black outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-label="Reels musicaux"
    >
      {feedLoading && reels.length === 0 && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 text-xs text-gray-300">
          Chargement…
        </div>
      )}
      <div
        ref={scrollRef}
        className={`reels-track flex-1 min-h-0 w-full flex items-stretch overflow-x-auto overflow-y-hidden self-stretch touch-pan-x ${
          scrollSnapDuringTouch ? 'snap-none' : 'snap-x snap-mandatory'
        }`}
        onScroll={syncIndexFromScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {reels.map((reel, index) => (
          <ReelSlide
            key={reel.id}
            reel={reel}
            isActive={index === activeIndex}
            muted={index === activeIndex ? muted : true}
            videoRef={(el) => {
              if (el) videoRefsById.current.set(reel.id, el);
              else videoRefsById.current.delete(reel.id);
            }}
            audioRef={(el) => {
              if (el) audioRefsById.current.set(reel.id, el);
              else audioRefsById.current.delete(reel.id);
            }}
            onTapForSound={index === activeIndex ? tapVideoForSound : undefined}
            onTapCenter={index === activeIndex ? togglePlaybackPause : undefined}
            showPlaybackPaused={index === activeIndex && playbackPaused}
            resolveMuted={resolveMuted}
            devCatalogVideoCount={
              isMsdevEnvironment() && index === activeIndex ? REELS_DEMO_VIDEO_COUNT : undefined
            }
          />
        ))}
      </div>

      {activeReel && (
        <ReelActions
          stats={stats}
          disabled={!token}
          onHeart={toggleHeart}
          onComment={() => setCommentsOpen(true)}
          onShare={() => setShareMenuOpen(true)}
        />
      )}

      {shareMenuOpen && activeReel && (
        <ShareLinkMenu
          open
          onClose={() => setShareMenuOpen(false)}
          url={reelShareUrl}
          title={`${activeReel.title} — ${activeReel.artist}`}
          text={activeReel.genre}
          onToast={setShareToast}
          onShared={recordReelShare}
        />
      )}

      {commentsOpen && activeReel && token && (
        <ReelCommentsSheet
          reelId={activeReel.id}
          reelTitle={activeReel.title}
          token={token}
          onClose={() => setCommentsOpen(false)}
          onCommentPosted={onCommentPosted}
        />
      )}

      {shareToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/80 border border-white/15 text-sm text-white backdrop-blur">
          {shareToast}
        </div>
      )}

      {activeHasSound && (
        <div className="absolute bottom-4 right-4 z-30 pointer-events-auto flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className={`w-11 h-11 rounded-full text-white text-sm backdrop-blur shadow-lg transition-colors ${
              muted
                ? 'bg-pink-600/90 border-2 border-pink-400 text-base'
                : 'bg-emerald-900/70 border-2 border-emerald-400/80'
            }`}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            aria-pressed={!muted}
            title={muted ? 'Son coupé' : 'Son activé'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="text-[10px] font-semibold text-white/90 drop-shadow pointer-events-none">
            {muted ? 'Muet' : 'Son'}
          </span>
        </div>
      )}
    </div>
  );
}

function ReelActions({
  stats,
  disabled,
  onHeart,
  onComment,
  onShare,
}: {
  stats: ReelStats;
  disabled: boolean;
  onHeart: () => void;
  onComment: () => void;
  onShare: () => void;
}) {
  const [heartAnim, setHeartAnim] = useState(false);

  const handleHeart = () => {
    if (disabled) return;
    setHeartAnim(true);
    window.setTimeout(() => setHeartAnim(false), 350);
    void onHeart();
  };

  return (
    <div className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-5">
      <ActionButton
        label={stats.likedByMe ? 'Retirer le like' : 'Aimer'}
        count={stats.heartCount}
        disabled={disabled}
        onClick={handleHeart}
      >
        <span className={`text-2xl leading-none ${heartAnim ? 'reel-heart-pop' : ''} ${stats.likedByMe ? 'text-pink-500' : 'text-white'}`}>
          {stats.likedByMe ? '♥' : '♡'}
        </span>
      </ActionButton>
      <ActionButton
        label="Commentaires"
        count={stats.commentCount}
        disabled={disabled}
        onClick={onComment}
        bubbleClassName={stats.commentedByMe ? 'border-green-500' : undefined}
      >
        <span className={`text-xl leading-none ${stats.commentedByMe ? 'text-green-400' : 'text-white'}`}>💬</span>
      </ActionButton>
      <ActionButton
        label={stats.sharedByMe ? 'Déjà partagé' : 'Partager'}
        count={stats.shareCount}
        onClick={onShare}
      >
        <span className={`text-xl leading-none ${stats.sharedByMe ? 'text-emerald-400' : 'text-white'}`}>↗</span>
      </ActionButton>
    </div>
  );
}

function ActionButton({
  label,
  count,
  disabled,
  onClick,
  bubbleClassName,
  children,
}: {
  label: string;
  count?: number;
  disabled?: boolean;
  onClick: () => void;
  bubbleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 disabled:opacity-40"
      aria-label={label}
    >
      <span
        className={`w-11 h-11 rounded-full bg-black/45 border border-white/15 flex items-center justify-center backdrop-blur hover:bg-black/60 transition-colors${bubbleClassName ? ` ${bubbleClassName}` : ''}`}
      >
        {children}
      </span>
      {count != null && count > 0 && (
        <span className="text-[11px] font-semibold text-white drop-shadow">{formatCount(count)}</span>
      )}
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ReelCommentsSheet({
  reelId,
  reelTitle,
  token,
  onClose,
  onCommentPosted,
}: {
  reelId: string;
  reelTitle: string;
  token: string;
  onClose: () => void;
  onCommentPosted: (commentCount: number) => void;
}) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getReelComments(token, reelId)
      .then((r) => setComments(r.comments))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [token, reelId]);

  useEffect(() => {
    const socket = getSocket();
    const onComment = (comment: ReelComment) => {
      if (comment.reelId !== reelId) return;
      setComments((list) => (list.some((c) => c.id === comment.id) ? list : [...list, comment]));
    };
    socket.on('reel_comment', onComment);
    return () => {
      socket.off('reel_comment', onComment);
    };
  }, [reelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const r = await api.postReelComment(token, reelId, content);
      setComments((list) => (list.some((c) => c.id === r.comment.id) ? list : [...list, r.comment]));
      setText('');
      onCommentPosted(r.commentCount);
    } catch {
      /* ignore */
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reel-comments-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative w-full max-h-[70dvh] bg-[#12121a] border-t border-[#2d2d3d] rounded-t-2xl flex flex-col safe-area-pb">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f]">
          <h2 id="reel-comments-title" className="font-bold text-white text-sm">
            Commentaires · {reelTitle}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white px-2" aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[120px]">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-6">Chargement…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Soyez le premier à commenter 🎵</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <img
                    src={c.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.userId}`}
                    alt=""
                    className="w-8 h-8 rounded-full shrink-0 bg-[#1e1e2f]"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-pink-300">{c.username}</p>
                    <p className="text-sm text-gray-200 break-words">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={submit} className="flex gap-2 px-4 py-3 border-t border-[#1e1e2f]">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un commentaire…"
            maxLength={500}
            className="flex-1 min-w-0 rounded-full bg-[#1a1a28] border border-[#2d2d3d] px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50"
          />
          <button
            type="submit"
            disabled={!text.trim() || posting}
            className="shrink-0 px-4 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}

function ReelSlide({
  reel,
  isActive,
  muted,
  videoRef,
  audioRef,
  onTapForSound,
  onTapCenter,
  showPlaybackPaused,
  resolveMuted,
  devCatalogVideoCount,
}: {
  reel: MusicReel;
  isActive: boolean;
  muted: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
  audioRef: (el: HTMLAudioElement | null) => void;
  onTapForSound?: () => void;
  onTapCenter?: () => void;
  showPlaybackPaused?: boolean;
  resolveMuted?: () => boolean;
  /** msdev : total de vidéos du catalogue, affiché en haut à gauche */
  devCatalogVideoCount?: number;
}) {
  const separateAudio = !!reel.audioUrl?.trim();
  const wantMuted = () => resolveMuted?.() ?? muted;
  const isImageOnly = reel.mediaType === 'image' || !reel.videoUrl;
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const pairedAudioRef = useRef<HTMLAudioElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const centerTouchRef = useRef(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterSrc, setPosterSrc] = useState(reel.posterUrl);
  const [durationSec, setDurationSec] = useState<number | undefined>(reel.durationSec);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const showPosterOnly = isImageOnly || videoFailed;
  const showDurationBadge = !isImageOnly && !videoFailed && durationSec != null && durationSec > 0;
  const durationBadgeText =
    showDurationBadge && isActive
      ? `${formatReelDuration(currentTimeSec)} / ${formatReelDuration(durationSec)}`
      : showDurationBadge
        ? formatReelDuration(durationSec)
        : null;

  useEffect(() => {
    setVideoFailed(false);
    setPosterSrc(reel.posterUrl);
    setDurationSec(reel.durationSec);
    setCurrentTimeSec(0);
  }, [reel.id, reel.posterUrl, reel.durationSec]);

  useEffect(() => {
    if (!isActive) setCurrentTimeSec(0);
  }, [isActive]);

  useEffect(() => {
    const m = wantMuted();
    if (localVideoRef.current) applyVideoAudio(localVideoRef.current, m, separateAudio);
    if (pairedAudioRef.current) applyReelAudio(pairedAudioRef.current, m);
  }, [muted, separateAudio, isActive]);

  useEffect(() => {
    if (isActive) {
      setVideoFailed(false);
      return;
    }
    localVideoRef.current?.pause();
    pairedAudioRef.current?.pause();
    if (localVideoRef.current) applyVideoAudio(localVideoRef.current, true, separateAudio);
    if (pairedAudioRef.current) applyReelAudio(pairedAudioRef.current, true);
  }, [isActive, separateAudio, reel.id]);

  const applyVideoDuration = (video: HTMLVideoElement) => {
    const d = video.duration;
    if (Number.isFinite(d) && d > 0) {
      setDurationSec(Math.round(d));
    }
  };

  useEffect(() => {
    if (showPosterOnly) videoRef(null);
  }, [showPosterOnly, videoRef]);

  useEffect(() => {
    if (!separateAudio) audioRef(null);
  }, [separateAudio, audioRef]);

  const onPosterError = () => {
    const fallback = fallbackPosterForReel(reel.id);
    if (fallback && fallback !== posterSrc) {
      setPosterSrc(fallback);
    }
  };

  const onVideoTimeUpdate = (video: HTMLVideoElement) => {
    if (!isActive) return;
    const sec = Math.floor(video.currentTime);
    setCurrentTimeSec((prev) => (prev === sec ? prev : sec));
  };

  const handleVideoPointerDown = (e: React.PointerEvent<HTMLVideoElement>) => {
    if (!isActive) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    centerTouchRef.current = isCenterTap(e.clientX, e.clientY, rect);
    if (centerTouchRef.current) {
      e.stopPropagation();
    }
  };

  const handleVideoPointerUp = (e: React.PointerEvent<HTMLVideoElement>) => {
    if (!isActive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    const inCenter = centerTouchRef.current || isCenterTap(e.clientX, e.clientY, rect);
    centerTouchRef.current = false;

    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > TAP_MOVE_THRESHOLD_PX || dy > TAP_MOVE_THRESHOLD_PX) return;
    }

    if (inCenter && onTapCenter) {
      e.stopPropagation();
      onTapCenter();
      return;
    }

    if (onTapForSound) onTapForSound();
  };

  return (
    <section
      className="reel-slide relative snap-start snap-always bg-black self-stretch"
      aria-label={`${reel.title} — ${reel.artist}`}
    >
      {showPosterOnly ? (
        <img
          src={posterSrc}
          alt={`${reel.title}, ${reel.artist}`}
          className="absolute inset-0 w-full h-full object-cover"
          loading={isActive ? 'eager' : 'lazy'}
          decoding="async"
          onError={onPosterError}
        />
      ) : (
        <>
          <video
            key={reel.id}
            ref={(el) => {
              localVideoRef.current = el;
              videoRef(el);
              if (el) applyVideoAudio(el, wantMuted(), separateAudio);
            }}
            src={reel.videoUrl}
            poster={posterSrc || undefined}
            className="absolute inset-0 w-full h-full object-cover cursor-pointer"
            style={{ willChange: 'transform' }}
            playsInline
            autoPlay={false}
            muted={separateAudio || muted}
            loop
            preload={isActive ? 'auto' : 'none'}
            onPointerDown={handleVideoPointerDown}
            onPointerUp={handleVideoPointerUp}
            onTouchStart={(e) => {
              if (!isActive) return;
              const touch = e.touches[0];
              if (!touch) return;
              const rect = e.currentTarget.getBoundingClientRect();
              if (isCenterTap(touch.clientX, touch.clientY, rect)) {
                centerTouchRef.current = true;
                e.stopPropagation();
              }
            }}
            onLoadedMetadata={(e) => applyVideoDuration(e.currentTarget)}
            onDurationChange={(e) => applyVideoDuration(e.currentTarget)}
            onCanPlay={(e) => {
              applyVideoDuration(e.currentTarget);
            }}
            onTimeUpdate={(e) => onVideoTimeUpdate(e.currentTarget)}
            onSeeked={(e) => onVideoTimeUpdate(e.currentTarget)}
            onError={() => {
              if (!isActive) return;
              const fallback = fallbackPosterForReel(reel.id);
              if (fallback && fallback !== posterSrc) {
                setPosterSrc(fallback);
              }
              setVideoFailed(true);
            }}
          />
          {separateAudio && (
            <audio
              key={reel.id}
              ref={(el) => {
                audioRef(el);
                pairedAudioRef.current = el;
                if (el) applyReelAudio(el, wantMuted());
              }}
              src={reel.audioUrl}
              loop
              preload={isActive ? 'auto' : 'none'}
              className="hidden"
              aria-hidden
            />
          )}
        </>
      )}
      {showPlaybackPaused && isActive && !showPosterOnly && (
        <div
          className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center"
          aria-hidden
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-3xl text-white shadow-lg">
            ▶
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />
      {devCatalogVideoCount != null && !showPosterOnly && (
        <span
          className="absolute top-4 left-4 z-10 pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white/90 tabular-nums shadow-sm"
          aria-label={`${devCatalogVideoCount} vidéos dans le catalogue`}
        >
          {devCatalogVideoCount} vidéos
        </span>
      )}
      {durationBadgeText != null && (
        <span
          className="absolute bottom-5 left-4 z-10 pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white tabular-nums shadow-sm"
          aria-label={
            isActive
              ? `Lecture ${formatReelDuration(currentTimeSec)} sur ${formatReelDuration(durationSec!)}`
              : `Durée ${formatReelDuration(durationSec!)}`
          }
        >
          {durationBadgeText}
        </span>
      )}
      <div className="absolute bottom-20 left-4 right-24 z-10 pointer-events-none">
        <div className="max-w-[85%] rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 px-4 py-3 shadow-xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-pink-300 font-bold">{reel.genre}</p>
          <p className="mt-1 text-2xl font-extrabold text-white leading-tight drop-shadow-md">{reel.title}</p>
          <p className="mt-0.5 text-base font-medium text-white/90">{reel.artist}</p>
        </div>
      </div>
    </section>
  );
}
