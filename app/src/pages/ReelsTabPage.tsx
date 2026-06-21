import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePauseMediaOnPageHidden } from '../hooks/usePauseMediaOnPageHidden';
import { type MusicReel } from '../content/reels';
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
import { ReelsSearchBar } from '../components/ReelsSearchBar';
import { ShareLinkMenu } from '../components/ShareLinkMenu';
import { UserAvatarOnline } from '../components/UserAvatarOnline';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { api } from '../lib/api';
import { buildReelShareText } from '../lib/shareLink';
import { getFeedAlgorithmPreferences } from '../lib/reelFeedAlgorithm';
import {
  applyClientFeedRanking,
  clearLastTabStartReelId,
  pickNextStartIndex,
  readLastTabStartReelId,
  rememberTabStartReelId,
  shuffleReelsFeedIfNeeded,
  refreshReelsShuffleSeed,
  shouldShuffleReelsFeed,
} from '../lib/reelFeedRankingClient';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import { AccelerateBadge } from '../components/AccelerateBadge';
import {
  applyReelsUserPrefsFilter,
  DEFAULT_REELS_USER_PREFS,
  readReelsUserPrefs,
  REEL_GENRES_LIST,
  writeReelsUserPrefs,
  type ReelsUserPrefs,
} from '../lib/reelsUserPrefs';
import { useHoldToAccelerate } from '../hooks/useHoldToAccelerate';
import {
  getAppMediaOwner,
  releaseAppMediaFocus,
  requestAppMediaFocus,
  subscribeAppMediaFocus,
} from '../lib/appMediaFocus';
import { pauseAllReelsMediaInDom, pauseInactiveReelsMediaInDom } from '../lib/reelsMedia';
import { filterReelsBySearch } from '../lib/reelsSearch';
import { ReelsSponsoredSlide } from '../components/ReelsSponsoredSlide';
import {
  DEFAULT_REELS_SPONSOR_CONFIG,
  interleaveReelsSponsors,
  type ReelsFeedDisplayItem,
} from '../lib/reelsSponsorFeed';
import type { ReelsSponsorAd } from '../types';
import { getSocket } from '../lib/socket';
import type { ReelComment, ReelStats } from '../types';
import { ReportContentModal } from '../components/ReportContentModal';

const SWIPE_THRESHOLD_PX = 22;
const SWIPE_VELOCITY_PX_MS = 0.32;
const REELS_UNMUTED_KEY = 'melosong_reels_unmuted';
/** Zone centrale (tap) : pause / lecture — 30 %–70 % de la largeur et hauteur. */
const CENTER_TAP_MIN = 0.3;
const CENTER_TAP_MAX = 0.7;
const TAP_MOVE_THRESHOLD_PX = 14;
/** Fenêtre double-tap (like IG/TikTok) — le simple tap est différé jusqu'à expiration. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 28;

function isCenterTap(clientX: number, clientY: number, rect: DOMRect): boolean {
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  return relX >= CENTER_TAP_MIN && relX <= CENTER_TAP_MAX && relY >= CENTER_TAP_MIN && relY <= CENTER_TAP_MAX;
}

/** Préférence persistante (localStorage) : absent = son activé par défaut ; '0' = muet ; '1' = son activé.
 *  Si l'autoplay sans son est bloqué par le navigateur, playMediaElement() bascule en muet automatiquement. */
function readReelsUnmutedPreference(): boolean {
  try {
    const stored = localStorage.getItem(REELS_UNMUTED_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

function persistReelsUnmutedPreference(unmuted: boolean) {
  try {
    localStorage.setItem(REELS_UNMUTED_KEY, unmuted ? '1' : '0');
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

/** Autoplay avec son souvent bloqué : repli muet, puis unmute au tap / swipe / onglet Reels.
 *  Retourne true si le navigateur a forcé le mode muet (autoplay policy). */
async function playMediaElement(el: HTMLMediaElement, wantMuted: boolean): Promise<boolean> {
  el.muted = wantMuted;
  el.volume = wantMuted ? 0 : 1;
  try {
    await el.play();
    return false;
  } catch {
    if (!wantMuted) {
      el.muted = true;
      el.volume = 0;
      try {
        await el.play();
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  }
}

/** Unmute + play synchronously in the user-gesture stack (autoplay policy). */
function unmuteActiveReelMediaFromGesture(
  video: HTMLVideoElement,
  audio: HTMLAudioElement | null,
  separateAudio: boolean
): void {
  applyVideoAudio(video, false, separateAudio);
  if (separateAudio && audio) {
    applyReelAudio(audio, false);
    try {
      void audio.play();
    } catch {
      /* ignore */
    }
  }
  if (video.paused) {
    try {
      void video.play();
    } catch {
      /* ignore */
    }
  }
}

/** One active reel: Mixkit b-roll (muted) + optional MP3. fromStart=false reprend la position courante.
 *  Retourne true si le navigateur a forcé le mode muet (autoplay policy bloqué). */
async function playActiveReelMedia(
  reel: MusicReel,
  video: HTMLVideoElement,
  audio: HTMLAudioElement | null,
  wantMuted: boolean,
  isStale: () => boolean,
  fromStart: boolean
): Promise<boolean> {
  if (isStale()) return false;
  const separateAudio = !!reel.audioUrl?.trim();
  const videoMuted = separateAudio || wantMuted;
  const videoAlreadyPlaying = !fromStart && !video.paused && video.currentTime > 0.05;

  if (videoAlreadyPlaying) {
    applyVideoAudio(video, wantMuted, separateAudio);
    if (audio) {
      applyReelAudio(audio, wantMuted);
      if (separateAudio && !wantMuted && audio.paused) {
        try {
          void audio.play();
        } catch {
          /* ignore */
        }
      }
    }
    return false;
  }

  video.pause();
  audio?.pause();
  if (fromStart) seekToStart(video, audio);
  applyVideoAudio(video, wantMuted, separateAudio);
  if (audio) applyReelAudio(audio, wantMuted);
  const videoForcedMuted = await playMediaElement(video, videoMuted);
  if (isStale()) {
    video.pause();
    audio?.pause();
    return false;
  }
  if (separateAudio && audio) {
    const audioForcedMuted = await playMediaElement(audio, wantMuted);
    if (isStale()) {
      video.pause();
      audio.pause();
      return false;
    }
    // Pour les reels avec piste audio séparée, le son passe par l'audio element
    return audioForcedMuted;
  }
  // Pour les reels sans piste séparée, le son passe par la vidéo
  return videoForcedMuted;
}

const FALLBACK_REELS = buildReelsFeed([]);

function findReelIndex(feed: ReelsFeedDisplayItem[], reelId: string): number {
  const i = feed.findIndex((item) => item.kind === 'reel' && item.reel.id === reelId);
  return i >= 0 ? i : 0;
}

function displayItemOrganicReel(item: ReelsFeedDisplayItem | undefined): MusicReel | undefined {
  return item?.kind === 'reel' ? item.reel : undefined;
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
  onOpenProfile?: (userId: string) => void;
  initialReelId?: string;
  onIntentHandled?: () => void;
  /** False when leaving the Reels tab or opening profile — stops all media. */
  isActive?: boolean;
}

export function ReelsTabPage({
  onOpenLive: _onOpenLive,
  onOpenProfile,
  initialReelId,
  onIntentHandled,
  isActive = true,
}: ReelsTabPageProps) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [feedReels, setFeedReels] = useState<MusicReel[]>(FALLBACK_REELS);
  const [reelsSponsorAds, setReelsSponsorAds] = useState<ReelsSponsorAd[]>([]);
  const [reelsSponsorConfig, setReelsSponsorConfig] = useState(DEFAULT_REELS_SPONSOR_CONFIG);
  const [feedLoading, setFeedLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const searchActive = deferredSearchQuery.trim().length > 0;
  const organicReels = useMemo(
    () => filterReelsBySearch(feedReels, deferredSearchQuery),
    [feedReels, deferredSearchQuery]
  );
  const displayItems = useMemo(
    () =>
      searchActive
        ? organicReels.map((reel) => ({ kind: 'reel' as const, reel, key: reel.id }))
        : interleaveReelsSponsors(organicReels, reelsSponsorAds, reelsSponsorConfig),
    [organicReels, reelsSponsorAds, reelsSponsorConfig, searchActive]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRefsById = useRef(new Map<string, HTMLVideoElement>());
  const audioRefsById = useRef(new Map<string, HTMLAudioElement>());
  const playRetryRef = useRef<number | null>(null);
  const playGenerationRef = useRef(0);
  const playScheduleRef = useRef<number | null>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const lastScheduledReelIdRef = useRef<string | null>(null);
  const [scrollSnapDuringTouch, setScrollSnapDuringTouch] = useState(false);
  const reelsRef = useRef(displayItems);
  reelsRef.current = displayItems;
  const feedReelsRef = useRef(feedReels);
  feedReelsRef.current = feedReels;
  const wasTabActiveRef = useRef(isActive);
  const hasLoadedFeedRef = useRef(false);
  const touchStartY = useRef<number | null>(null);
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
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [reportReelOpen, setReportReelOpen] = useState(false);
  const initialScrollDone = useRef(false);
  const viewedReelsThisSession = useRef(new Set<string>());
  const [algoSheetOpen, setAlgoSheetOpen] = useState(false);

  const activeItem = displayItems[activeIndex];
  const activeReel = displayItemOrganicReel(activeItem);
  const searchEmpty = searchActive && !feedLoading && displayItems.length === 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
    activeIndexRef.current = 0;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'auto' });
  }, [deferredSearchQuery]);

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
    if (!initialReelId || initialScrollDone.current || displayItems.length === 0) return;
    const found = displayItems.some((item) => item.kind === 'reel' && item.reel.id === initialReelId);
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
    const index = findReelIndex(displayItems, initialReelId);
    initialScrollDone.current = true;
    setActiveIndex(index);
    const el = scrollRef.current;
    if (el && el.clientHeight > 0) {
      el.scrollTo({ top: index * el.clientHeight, behavior: 'auto' });
    }
    onIntentHandled?.();
  }, [initialReelId, displayItems, onIntentHandled, token]);

  useEffect(() => {
    if (!isActive) return;
    api
      .getReelsSponsors()
      .then((r) => {
        setReelsSponsorAds(r.items);
        setReelsSponsorConfig(r.config);
      })
      .catch(() => undefined);
  }, [isActive]);

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
      if (el && el.clientHeight > 0) {
        el.scrollTo({ top: start * el.clientHeight, behavior: 'auto' });
      }
    });
    rememberTabStartReelId(feed[start]!.id);
  }, []);

  const refreshFeedWithStart = useCallback(
    async (options?: { skipStartIndex?: boolean; silent?: boolean; refreshShuffle?: boolean }) => {
      const prefs = getFeedAlgorithmPreferences();
      const msdev = isMsdevEnvironment();
      const skipStart = options?.skipStartIndex === true || !!initialReelId;
      const showLoading = !options?.silent || feedReelsRef.current.length === 0;

      const finalizeFeed = (raw: MusicReel[]) => {
        const userPrefs = readReelsUserPrefs();
        const filtered = applyReelsUserPrefsFilter(raw, userPrefs);
        const feed = shuffleReelsFeedIfNeeded(filtered, prefs, msdev, {
          refreshSeed: options?.refreshShuffle === true,
        });
        setFeedReels(feed);
        if (!skipStart) applyAlgorithmStartIndex(feed);
      };

      if (!token) {
        let feed = buildReelsFeed([]);
        if (!shouldShuffleReelsFeed(prefs, msdev)) {
          feed = applyClientFeedRanking(feed, prefs);
        }
        finalizeFeed(feed);
        setFeedLoading(false);
        return;
      }

      if (showLoading) setFeedLoading(true);
      try {
        const r = await api.getReelsFeed(token, prefs);
        finalizeFeed(resolveReelsFeed(r.reels));
      } catch {
        let feed = buildReelsFeed([]);
        if (!shouldShuffleReelsFeed(prefs, msdev)) {
          feed = applyClientFeedRanking(feed, prefs);
        }
        finalizeFeed(feed);
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
      if (isMsdevEnvironment()) refreshReelsShuffleSeed();
      if (!initialReelId && feedReelsRef.current.length > 0) {
        applyAlgorithmStartIndex(feedReelsRef.current);
      }
      void refreshFeedWithStart({
        skipStartIndex: true,
        silent: true,
        refreshShuffle: isMsdevEnvironment(),
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
    const clamped = Math.max(0, Math.min(displayItems.length - 1, index));
    const el = scrollRef.current;
    if (!el) return;
    const h = el.clientHeight;
    el.scrollTo({ top: clamped * h, behavior: scrollBehavior });
    setActiveIndex(clamped);
  }, [displayItems.length]);

  const settleScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el || touchActive.current || el.clientHeight === 0) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(reelsRef.current.length - 1, index));
    const targetTop = clamped * el.clientHeight;
    if (Math.abs(el.scrollTop - targetTop) > 2) {
      el.scrollTo({ top: targetTop, behavior: 'auto' });
    }
    if (clamped !== activeIndexRef.current) {
      setActiveIndex(clamped);
    }
  }, []);

  const syncIndexFromScroll = useCallback(() => {
    if (touchActive.current) return;
    const el = scrollRef.current;
    if (!el || el.clientHeight === 0) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(displayItems.length - 1, index));
    if (clamped !== activeIndexRef.current) {
      playGenerationRef.current += 1;
      if (playScheduleRef.current) {
        clearTimeout(playScheduleRef.current);
        playScheduleRef.current = null;
      }
      const nextItem = reelsRef.current[clamped];
      const nextReelId = nextItem?.key;
      if (nextReelId) pauseInactiveReelsMediaInDom(nextReelId);
      setActiveIndex(clamped);
    }
    if (scrollSettleTimerRef.current) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = window.setTimeout(() => {
      scrollSettleTimerRef.current = null;
      settleScrollPosition();
    }, 140);
  }, [displayItems.length, settleScrollPosition]);

  const snapIndexFromScroll = useCallback((): number => {
    const el = scrollRef.current;
    if (!el || el.clientHeight === 0) return activeIndexRef.current;
    const index = Math.round(el.scrollTop / el.clientHeight);
    return Math.max(0, Math.min(displayItems.length - 1, index));
  }, [displayItems.length]);

  const finishTouchGesture = useCallback(
    (endY: number) => {
      touchActive.current = false;
      const start = touchStartY.current;
      touchStartY.current = null;

      const resumeAfterSwipe = (targetIndex: number) => {
        goToIndex(targetIndex, 'auto');
      };

      const el = scrollRef.current;
      if (!el || el.clientHeight === 0) {
        return;
      }

      const scrollSnap = snapIndexFromScroll();
      const baseIndex = activeIndexRef.current;

      if (start == null) {
        resumeAfterSwipe(scrollSnap);
        return;
      }

      const delta = start - endY;
      const dt = Math.max(1, Date.now() - touchStartTime.current);
      const velocity = delta / dt;

      // Reels UX (Instagram/TikTok): swipe UP (finger ↑) reveals the next reel;
      // swipe DOWN (finger ↓) goes back to the previous reel.
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

  const loadStatsRef = useRef(loadStats);
  loadStatsRef.current = loadStats;

  useEffect(() => {
    if (!activeReel || !token) return;
    const socket = getSocket();
    if (!socket) return;
    const reelId = activeReel.id;
    socket.emit('join_reel', { reelId });
    const onComment = (comment: ReelComment) => {
      if (comment.reelId !== reelId) return;
      void loadStatsRef.current(reelId);
    };
    socket.on('reel_comment', onComment);
    return () => {
      socket.emit('leave_reel', { reelId });
      socket.off('reel_comment', onComment);
    };
  }, [activeReel?.id, token]);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    if (!isActive) {
      releaseAppMediaFocus('reels');
      return;
    }
    requestAppMediaFocus('reels');
    return () => releaseAppMediaFocus('reels');
  }, [isActive]);

  const reelHasSeparateAudio = useCallback((reel: MusicReel | undefined) => !!reel?.audioUrl?.trim(), []);

  const applyMuteStateToAllRefs = useCallback((wantMuted: boolean) => {
    const list = reelsRef.current;
    const activeKey = list[activeIndexRef.current]?.key;
    videoRefsById.current.forEach((video, mediaKey) => {
      const item = list.find((entry) => entry.key === mediaKey);
      const reel = displayItemOrganicReel(item);
      const separateAudio = reelHasSeparateAudio(reel);
      const forActive = mediaKey === activeKey;
      applyVideoAudio(video, forActive ? wantMuted : true, separateAudio);
    });
    audioRefsById.current.forEach((audio, mediaKey) => {
      applyReelAudio(audio, mediaKey === activeKey ? wantMuted : true);
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
    videoRefsById.current.forEach((video, mediaKey) => {
      const item = list.find((entry) => entry.key === mediaKey);
      const reel = displayItemOrganicReel(item);
      const separateAudio = reelHasSeparateAudio(reel);
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      applyVideoAudio(video, true, separateAudio);
      video.playbackRate = 1;
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

  useEffect(() => {
    return subscribeAppMediaFocus((owner) => {
      if ((owner === 'salon' || owner === 'live') && isActiveRef.current) {
        stopAllReelsMedia();
      }
    });
  }, [stopAllReelsMedia]);

  const pauseInactiveReelsMedia = useCallback(
    (activeId: string) => {
      const list = reelsRef.current;
      videoRefsById.current.forEach((video, mediaKey) => {
        if (mediaKey === activeId) return;
        const item = list.find((entry) => entry.key === mediaKey);
        const reel = displayItemOrganicReel(item);
        const reelSeparateAudio = reelHasSeparateAudio(reel);
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
        applyVideoAudio(video, true, reelSeparateAudio);
        video.playbackRate = 1;
      });
      audioRefsById.current.forEach((audio, mediaKey) => {
        if (mediaKey === activeId) return;
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
    (index: number, wantMuted: boolean, fromStart = false) => {
      if (!isActiveRef.current) {
        stopAllReelsMedia();
        return;
      }

      const owner = getAppMediaOwner();
      if (owner != null && owner !== 'reels') {
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

      const mediaKey = active.key;
      const video = videoRefsById.current.get(mediaKey);
      const audio = audioRefsById.current.get(mediaKey);

      if (playbackPausedRef.current) {
        pauseInactiveReelsMedia(mediaKey);
        video?.pause();
        audio?.pause();
        return;
      }

      pauseInactiveReelsMedia(mediaKey);

      if (active.kind === 'sponsor') {
        if (!video) {
          cancelPlayRetry();
          playRetryRef.current = requestAnimationFrame(() => {
            playRetryRef.current = null;
            if (isStale()) return;
            playActiveReel(index, wantMuted, fromStart);
          });
          return;
        }
        cancelPlayRetry();
        if (fromStart) seekToStart(video);
        void playMediaElement(video, wantMuted).then((forcedMuted) => {
          if (forcedMuted && !wantMuted && !isStale()) {
            mutedRef.current = true;
            setMuted(true);
          }
        });
        return;
      }

      const reel = active.reel;
      const separateAudio = reelHasSeparateAudio(reel);

      if (!video || (separateAudio && !audio)) {
        cancelPlayRetry();
        playRetryRef.current = requestAnimationFrame(() => {
          playRetryRef.current = null;
          if (isStale()) return;
          playActiveReel(index, wantMuted, fromStart);
        });
        return;
      }

      cancelPlayRetry();
      void playActiveReelMedia(
        reel,
        video,
        separateAudio ? audio ?? null : null,
        wantMuted,
        isStale,
        fromStart
      ).then((forcedMuted) => {
        if (forcedMuted && !wantMuted && !isStale()) {
          mutedRef.current = true;
          setMuted(true);
        }
      });
    },
    [reelHasSeparateAudio, stopAllReelsMedia, cancelPlayRetry, pauseInactiveReelsMedia, setMuted]
  );

  const schedulePlayActiveReel = useCallback(
    (delayMs = 48, fromStart = true) => {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
      playScheduleRef.current = window.setTimeout(() => {
        playScheduleRef.current = null;
        if (!isActiveRef.current) return;
        playActiveReel(activeIndexRef.current, mutedRef.current, fromStart);
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

    if (playbackPausedRef.current) return;

    const active = reelsRef.current[activeIndexRef.current];
    if (!active) return;
    const mediaKey = active.key;
    if (active.kind === 'sponsor') {
      const video = videoRefsById.current.get(mediaKey);
      if (!video) {
        playActiveReel(activeIndexRef.current, false);
        return;
      }
      video.muted = false;
      video.volume = 1;
      if (video.paused) {
        try {
          void video.play();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    const separateAudio = reelHasSeparateAudio(active.reel);
    const video = videoRefsById.current.get(mediaKey);
    const audio = audioRefsById.current.get(mediaKey) ?? null;
    if (!video || (separateAudio && !audio)) {
      playActiveReel(activeIndexRef.current, false);
      return;
    }
    // Sync play in click/tap stack — async playActiveReel loses the user gesture.
    unmuteActiveReelMediaFromGesture(video, audio, separateAudio);
  }, [applyMuteStateToAllRefs, playActiveReel, reelHasSeparateAudio]);

  const disableSound = useCallback(() => {
    persistReelsUnmutedPreference(false);
    mutedRef.current = true;
    setMuted(true);
    applyMuteStateToAllRefs(true);
  }, [applyMuteStateToAllRefs]);

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
    videoRefsById.current.get(active.key)?.pause();
    audioRefsById.current.get(active.key)?.pause();
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
    const reelId = activeReel?.id ?? null;
    const fromStart = reelId != null && lastScheduledReelIdRef.current !== reelId;
    lastScheduledReelIdRef.current = reelId;
    schedulePlayActiveReel(48, fromStart);
    return () => {
      if (playScheduleRef.current) clearTimeout(playScheduleRef.current);
    };
  }, [activeIndex, activeReel?.id, isActive, schedulePlayActiveReel, stopAllReelsMedia]);

  useEffect(() => {
    if (!isActive) return;
    applyMuteStateToAllRefs(mutedRef.current);
  }, [muted, isActive, applyMuteStateToAllRefs]);

  const wasReelsTabActiveRef = useRef(isActive);
  useEffect(() => {
    const entered = isActive && !wasReelsTabActiveRef.current;
    wasReelsTabActiveRef.current = isActive;
    if (!entered || mutedRef.current || playbackPausedRef.current) return;
    playActiveReel(activeIndexRef.current, false);
  }, [isActive, playActiveReel]);

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
    const onResize = () => goToIndex(activeIndexRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [goToIndex]);

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
    touchActive.current = true;
    setScrollSnapDuringTouch(true);
    touchStartY.current = e.touches[0]?.clientY ?? null;
    touchStartTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current ?? 0;
    const startY = touchStartY.current;
    const movedPx = startY != null ? Math.abs(startY - endY) : 0;
    const wasSwipe = movedPx > TAP_MOVE_THRESHOLD_PX;
    finishTouchGesture(endY);
    setScrollSnapDuringTouch(false);
    if (wasSwipe && !mutedRef.current && isActive && !playbackPausedRef.current) {
      playActiveReel(activeIndexRef.current, false, false);
    }
  };

  const onTouchCancel = () => {
    finishTouchGesture(touchStartY.current ?? 0);
    setScrollSnapDuringTouch(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goToIndex(activeIndex + 1);
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goToIndex(activeIndex - 1);
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

  /** Double-tap : like uniquement (pas de unlike si déjà aimé — comportement Instagram). */
  const likeReelOnDoubleTap = useCallback(async () => {
    if (!token || !activeReel) return;
    if (statsRef.current.likedByMe) return;
    try {
      const r = await api.toggleReelHeart(token, activeReel.id);
      setStats((s) => ({ ...s, likedByMe: r.liked, heartCount: r.heartCount }));
    } catch {
      /* ignore */
    }
  }, [token, activeReel?.id]);

  const reelShareUrl = activeReel
    ? `${window.location.origin}${window.location.pathname}?reel=${activeReel.id}`
    : '';
  const reelShareText = activeReel ? buildReelShareText(activeReel) : undefined;
  const reelShareTitle = activeReel
    ? t('share.reelTitle', { title: activeReel.title })
    : undefined;

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
      className="ms-reels-root relative flex flex-col flex-1 min-h-0 w-full bg-black outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-label="Reels musicaux"
    >
      {feedLoading && displayItems.length === 0 && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/70 text-xs text-gray-300">
          Chargement…
        </div>
      )}
      <div className="reels-viewport flex flex-1 min-h-0 w-full justify-center">
        <div className="relative flex flex-1 min-h-0 w-full max-w-lg">
          <ReelsSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className="absolute top-3 left-3 right-14 z-20"
          />

          {searchEmpty && (
            <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center px-8">
              <p className="rounded-2xl bg-black/70 border border-purple-500/30 px-5 py-4 text-center text-sm text-gray-200 backdrop-blur-md shadow-xl">
                {t('reels.searchNoResults', { query: deferredSearchQuery.trim() })}
              </p>
            </div>
          )}

          <div
            ref={scrollRef}
            className={`reels-track flex-1 min-h-0 w-full flex flex-col items-stretch overflow-y-auto overflow-x-hidden self-stretch touch-pan-y ${
              scrollSnapDuringTouch ? 'snap-none' : 'snap-y snap-mandatory'
            }`}
            onScroll={syncIndexFromScroll}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
          >
            {displayItems.map((item, index) =>
              item.kind === 'sponsor' ? (
                <ReelsSponsoredSlide
                  key={item.key}
                  ad={item.ad}
                  isActive={index === activeIndex}
                  muted={index === activeIndex ? muted : true}
                  videoRef={(el) => {
                    if (el) videoRefsById.current.set(item.key, el);
                    else videoRefsById.current.delete(item.key);
                  }}
                  onTapCenter={index === activeIndex ? togglePlaybackPause : undefined}
                  showPlaybackPaused={index === activeIndex && playbackPaused}
                  resolveMuted={resolveMuted}
                />
              ) : (
                <ReelSlide
                  key={item.key}
                  reel={item.reel}
                  isActive={index === activeIndex}
                  muted={index === activeIndex ? muted : true}
                  videoRef={(el) => {
                    if (el) videoRefsById.current.set(item.key, el);
                    else videoRefsById.current.delete(item.key);
                  }}
                  audioRef={(el) => {
                    if (el) audioRefsById.current.set(item.key, el);
                    else audioRefsById.current.delete(item.key);
                  }}
                  onTapForSound={index === activeIndex ? tapVideoForSound : undefined}
                  onTapCenter={index === activeIndex ? togglePlaybackPause : undefined}
                  onDoubleTapLike={index === activeIndex ? likeReelOnDoubleTap : undefined}
                  showPlaybackPaused={index === activeIndex && playbackPaused}
                  resolveMuted={resolveMuted}
                  onOpenAuthor={onOpenProfile}
                />
              )
            )}
          </div>

          {activeReel && (
            <ReelActions
              stats={stats}
              disabled={!token}
              onHeart={toggleHeart}
              onComment={() => setCommentsOpen(true)}
              onShare={() => setShareMenuOpen(true)}
              onReport={
                token && activeReel.authorId && activeReel.authorId !== user?.id
                  ? () => setReportReelOpen(true)
                  : undefined
              }
            />
          )}

          {activeReel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAlgoSheetOpen(true);
              }}
              className="absolute top-4 right-3 z-20 w-9 h-9 rounded-full bg-black/50 border border-white/20 backdrop-blur-sm flex items-center justify-center text-base hover:bg-black/70 transition-colors"
              aria-label="Personnaliser le feed"
              title="Personnaliser mon feed"
            >
              ⚙️
            </button>
          )}

          {activeHasSound && (
            <div className="reel-mute-control absolute bottom-4 right-4 z-30 pointer-events-auto flex flex-col items-center gap-1">
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

          {shareToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/80 border border-white/15 text-sm text-white backdrop-blur">
              {shareToast}
            </div>
          )}
        </div>
      </div>

      {shareMenuOpen && activeReel && (
        <ShareLinkMenu
          open
          onClose={() => setShareMenuOpen(false)}
          url={reelShareUrl}
          title={reelShareTitle}
          text={reelShareText}
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

      {reportReelOpen && activeReel && (
        <ReportContentModal
          context={{
            targetUserId: activeReel.authorId,
            targetUsername: activeReel.artist,
            roomType: 'reel',
            roomId: activeReel.id,
          }}
          onClose={() => setReportReelOpen(false)}
        />
      )}

      {algoSheetOpen && (
        <ReelsAlgoSheet
          onClose={() => setAlgoSheetOpen(false)}
          onSaved={() => {
            clearLastTabStartReelId();
            void refreshFeedWithStart({ skipStartIndex: false });
          }}
        />
      )}
    </div>
  );
}

const ReelActions = memo(function ReelActions({
  stats,
  disabled,
  onHeart,
  onComment,
  onShare,
  onReport,
}: {
  stats: ReelStats;
  disabled: boolean;
  onHeart: () => void;
  onComment: () => void;
  onShare: () => void;
  onReport?: () => void;
}) {
  const { t } = useTranslation();
  const [heartAnim, setHeartAnim] = useState(false);

  const handleHeart = () => {
    if (disabled) return;
    setHeartAnim(true);
    window.setTimeout(() => setHeartAnim(false), 350);
    void onHeart();
  };

  return (
    <div className="reel-actions-rail absolute right-3 bottom-28 z-30 flex flex-col items-center gap-5">
      <ActionButton
        label={stats.likedByMe ? t('reels.unlike') : t('reels.like')}
        count={stats.heartCount}
        disabled={disabled}
        onClick={handleHeart}
      >
        <span className={`text-2xl leading-none ${heartAnim ? 'reel-heart-pop' : ''} ${stats.likedByMe ? 'text-pink-500' : 'text-white'}`}>
          {stats.likedByMe ? '♥' : '♡'}
        </span>
      </ActionButton>
      <ActionButton
        label={t('reels.comments')}
        count={stats.commentCount}
        disabled={disabled}
        onClick={onComment}
        bubbleClassName={stats.commentedByMe ? 'border-green-500' : undefined}
      >
        <span className={`text-xl leading-none ${stats.commentedByMe ? 'text-green-400' : 'text-white'}`}>💬</span>
      </ActionButton>
      <ActionButton
        label={stats.sharedByMe ? t('reels.alreadyShared') : t('reels.share')}
        count={stats.shareCount}
        onClick={onShare}
      >
        <span className={`text-xl leading-none ${stats.sharedByMe ? 'text-emerald-400' : 'text-white'}`}>↗</span>
      </ActionButton>
      {onReport && (
        <ActionButton
          label="Signaler ce reel"
          onClick={onReport}
        >
          <span className="text-xl leading-none text-gray-300">⚑</span>
        </ActionButton>
      )}
    </div>
  );
});

const ActionButton = memo(function ActionButton({
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
});

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
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;
    const onComment = (comment: ReelComment) => {
      if (comment.reelId !== reelId) return;
      setComments((list) => (list.some((c) => c.id === comment.id) ? list : [...list, comment]));
    };
    socket.on('reel_comment', onComment);
    return () => {
      socket.off('reel_comment', onComment);
    };
  }, [reelId, token]);

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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reel-comments-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[70dvh] bg-[#12121a] border border-[#2d2d3d] rounded-2xl flex flex-col">
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
                    loading="lazy"
                    decoding="async"
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

const ReelAuthorStack = memo(function ReelAuthorStack({
  reel,
  onOpenAuthor,
}: {
  reel: MusicReel;
  onOpenAuthor?: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const authorId = reel.authorId?.trim();
  const displayName = reel.authorUsername?.trim() || reel.artist.trim() || 'Soundly';
  const avatarUserId = authorId || reel.id;
  const canOpenProfile = !!authorId && !!onOpenAuthor;

  const card = (
    <div className="reel-author-card max-w-[88%] rounded-xl bg-black/55 backdrop-blur-md border border-white/12 px-2.5 py-2 shadow-lg">
      <div className="flex items-start gap-2 min-w-0">
        <UserAvatarOnline
          userId={avatarUserId}
          avatarUrl={reel.authorAvatarUrl}
          username={displayName}
          size="sm"
          className="ring-1 ring-white/20 shadow-sm flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <UsernameDisplay
              username={displayName}
              usernameColor={reel.authorUsernameColor}
              usernameWaveFrom={reel.authorUsernameWaveFrom}
              usernameWaveTo={reel.authorUsernameWaveTo}
              className="text-xs font-semibold drop-shadow truncate max-w-[9rem]"
            />
            {reel.genre ? (
              <span className="reel-genre-badge shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-pink-300 bg-pink-500/15 border border-pink-400/20">
                {reel.genre}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm font-bold text-white leading-snug line-clamp-2 drop-shadow-sm">{reel.title}</p>
        </div>
      </div>
    </div>
  );

  if (!canOpenProfile) {
    return (
      <div className="pointer-events-none" aria-label={displayName}>
        {card}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenAuthor!(authorId);
      }}
      className="pointer-events-auto text-left rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
      aria-label={t('reels.openAuthorProfile', { username: displayName })}
    >
      {card}
    </button>
  );
});

const ReelSlide = memo(
  function ReelSlide({
    reel,
    isActive,
    muted,
    videoRef,
    audioRef,
    onTapForSound,
    onTapCenter,
    onDoubleTapLike,
    showPlaybackPaused,
    resolveMuted,
    onOpenAuthor,
  }: {
    reel: MusicReel;
    isActive: boolean;
    muted: boolean;
    videoRef: (el: HTMLVideoElement | null) => void;
    audioRef: (el: HTMLAudioElement | null) => void;
    onTapForSound?: () => void;
    onTapCenter?: () => void;
    onDoubleTapLike?: () => void;
    showPlaybackPaused?: boolean;
    resolveMuted?: () => boolean;
    onOpenAuthor?: (userId: string) => void;
  }) {
  const { t } = useTranslation();
  const separateAudio = !!reel.audioUrl?.trim();
  const wantMuted = () => resolveMuted?.() ?? muted;
  const isImageOnly = reel.mediaType === 'image' || !reel.videoUrl;
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const pairedAudioRef = useRef<HTMLAudioElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const centerTouchRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
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

  const { accelerating, handlers: holdHandlers, stopAccelerating } = useHoldToAccelerate({
    enabled: isActive && !showPosterOnly,
    getMedia: () => ({
      video: localVideoRef.current,
      audio: separateAudio ? pairedAudioRef.current : null,
    }),
  });

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !accelerating) return;
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, [accelerating]);

  useEffect(() => {
    if (!isActive) stopAccelerating();
  }, [isActive, stopAccelerating]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current != null) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (singleTapTimerRef.current != null) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastTapRef.current = null;
    setDoubleTapHeart(false);
  }, [reel.id, isActive]);

  const clearSingleTapTimer = () => {
    if (singleTapTimerRef.current != null) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  };

  const showDoubleTapHeart = () => {
    setDoubleTapHeart(true);
    window.setTimeout(() => setDoubleTapHeart(false), 900);
  };

  const handleTapEnd = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
    stopPropagation?: () => void
  ) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (
      last &&
      now - last.time <= DOUBLE_TAP_MS &&
      Math.abs(clientX - last.x) <= DOUBLE_TAP_DISTANCE_PX &&
      Math.abs(clientY - last.y) <= DOUBLE_TAP_DISTANCE_PX
    ) {
      clearSingleTapTimer();
      lastTapRef.current = null;
      stopPropagation?.();
      showDoubleTapHeart();
      void onDoubleTapLike?.();
      return;
    }

    lastTapRef.current = { time: now, x: clientX, y: clientY };
    clearSingleTapTimer();

    const inCenter = isCenterTap(clientX, clientY, rect);
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapRef.current = null;
      if (inCenter && onTapCenter) {
        stopPropagation?.();
        onTapCenter();
        return;
      }
      if (onTapForSound) onTapForSound();
    }, DOUBLE_TAP_MS);
  };

  const handleVideoPointerDown = (e: React.PointerEvent<HTMLVideoElement>) => {
    if (!isActive) return;
    holdHandlers.onPointerDown(e);
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

    const wasAccelerating = holdHandlers.onPointerUp();
    if (wasAccelerating) {
      pointerStartRef.current = null;
      centerTouchRef.current = false;
      e.stopPropagation();
      return;
    }

    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    centerTouchRef.current = false;

    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > TAP_MOVE_THRESHOLD_PX || dy > TAP_MOVE_THRESHOLD_PX) return;
    }

    handleTapEnd(e.clientX, e.clientY, rect, () => e.stopPropagation());
  };

  const handlePosterPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isActive) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    centerTouchRef.current = isCenterTap(e.clientX, e.clientY, rect);
    if (centerTouchRef.current) {
      e.stopPropagation();
    }
  };

  const handlePosterPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isActive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    centerTouchRef.current = false;

    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > TAP_MOVE_THRESHOLD_PX || dy > TAP_MOVE_THRESHOLD_PX) return;
    }

    handleTapEnd(e.clientX, e.clientY, rect, () => e.stopPropagation());
  };

  return (
    <section
      className="reel-slide relative shrink-0 snap-start snap-always bg-black self-stretch"
      data-reel-id={reel.id}
      aria-label={`${reel.title} — ${reel.artist}`}
    >
      {showPosterOnly ? (
        <>
          <img
            src={posterSrc}
            alt={`${reel.title}, ${reel.artist}`}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            loading={isActive ? 'eager' : 'lazy'}
            decoding="async"
            onError={onPosterError}
          />
          {isActive && (
            <button
              type="button"
              className="absolute inset-0 z-[4] cursor-pointer bg-transparent border-0 p-0"
              aria-label={t('reels.doubleTapLike')}
              onPointerDown={handlePosterPointerDown}
              onPointerUp={handlePosterPointerUp}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const rect = e.currentTarget.getBoundingClientRect();
                if (isCenterTap(touch.clientX, touch.clientY, rect)) {
                  centerTouchRef.current = true;
                  e.stopPropagation();
                }
              }}
            />
          )}
        </>
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
            onPointerLeave={holdHandlers.onPointerLeave}
            onPointerCancel={holdHandlers.onPointerCancel}
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
      <AccelerateBadge visible={accelerating && isActive && !showPosterOnly} />
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
      {doubleTapHeart && isActive && (
        <div
          className="absolute inset-0 z-[6] pointer-events-none flex items-center justify-center"
          aria-hidden
        >
          <span className="text-7xl text-pink-500 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] reel-double-tap-heart">
            ♥
          </span>
        </div>
      )}
      <div className="reel-slide__scrim absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />
      <div className="reel-meta-stack absolute bottom-14 left-4 right-24 z-10 flex flex-col items-start gap-1.5">
        {durationBadgeText != null && (
          <span
            className="reel-duration-badge pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white tabular-nums shadow-sm"
            aria-label={
              isActive
                ? `Lecture ${formatReelDuration(currentTimeSec)} sur ${formatReelDuration(durationSec!)}`
                : `Durée ${formatReelDuration(durationSec!)}`
            }
          >
            {durationBadgeText}
          </span>
        )}
        <div className="reel-author-stack w-full min-w-0">
          <ReelAuthorStack reel={reel} onOpenAuthor={onOpenAuthor} />
        </div>
      </div>
    </section>
  );
  },
  (prev, next) =>
    prev.reel === next.reel &&
    prev.isActive === next.isActive &&
    prev.muted === next.muted &&
    prev.showPlaybackPaused === next.showPlaybackPaused
);

function ReelsAlgoSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [prefs, setPrefs] = useState<ReelsUserPrefs>(() => readReelsUserPrefs());
  const [showAllGenres, setShowAllGenres] = useState(false);

  const toggleGenre = (genre: string) => {
    setPrefs((p) => ({
      ...p,
      genres: p.genres.includes(genre) ? p.genres.filter((g) => g !== genre) : [...p.genres, genre],
    }));
  };

  const save = () => {
    writeReelsUserPrefs(prefs);
    onSaved();
    onClose();
  };

  const reset = () => {
    const fresh = { ...DEFAULT_REELS_USER_PREFS };
    setPrefs(fresh);
    writeReelsUserPrefs(fresh);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reels-algo-title"
    >
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80dvh] bg-[#12121a] border border-[#2d2d3d] rounded-2xl flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3d3d55]" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f]">
          <h2 id="reels-algo-title" className="font-bold text-white text-sm flex items-center gap-2">
            🎛️ Personnaliser mon feed
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white px-2" aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section className="rounded-xl bg-gradient-to-br from-pink-600/20 to-[#1a1a28] border border-pink-500/40 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Algo Soundly</p>
                <p className="text-xs text-gray-300 mt-0.5">Personnalise ton feed selon tes goûts</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.algoEnabled}
                onClick={() => setPrefs((p) => ({ ...p, algoEnabled: !p.algoEnabled }))}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  prefs.algoEnabled ? 'bg-pink-600' : 'bg-[#3d3d55]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    prefs.algoEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {prefs.algoEnabled && (
            <p className="text-sm text-gray-400 text-center py-2">
              L&apos;algorithme gère automatiquement ton feed 🎵
            </p>
          )}

          <div
            className={`transition-all duration-300 overflow-hidden flex flex-col gap-4 ${
              prefs.algoEnabled ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[500px] opacity-100'
            }`}
          >
            <section>
              <h3 className="text-xs font-semibold text-pink-300 uppercase tracking-widest mb-2">
                Genres musicaux
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Sélectionne tes genres préférés (laisse vide pour tout voir).
              </p>
              <div className="flex flex-wrap gap-2">
                {(showAllGenres ? REEL_GENRES_LIST : REEL_GENRES_LIST.slice(0, 12)).map((genre) => {
                  const active = prefs.genres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-pink-600 border-pink-500 text-white'
                          : 'bg-[#1a1a28] border-[#2d2d3d] text-gray-300 hover:border-pink-500/50'
                      }`}
                      aria-pressed={active}
                    >
                      {genre}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowAllGenres((v) => !v)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-[#2d2d3d] bg-[#2d2d3d] text-gray-300 hover:border-pink-500/50 transition-colors"
                >
                  {showAllGenres ? 'Voir moins' : '···'}
                </button>
              </div>
              {prefs.genres.length > 0 && (
                <p className="text-xs text-pink-400/70 mt-2">
                  {prefs.genres.length} genre{prefs.genres.length > 1 ? 's' : ''} sélectionné
                  {prefs.genres.length > 1 ? 's' : ''}
                </p>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-pink-300 uppercase tracking-widest mb-3">
                Langue des reels
              </h3>
              <div className="flex gap-2">
                {(['all', 'fr', 'en'] as const).map((lang) => {
                  const labels: Record<typeof lang, string> = { all: 'Tout', fr: 'Français', en: 'English' };
                  const active = prefs.language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, language: lang }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-pink-600 border-pink-500 text-white'
                          : 'bg-[#1a1a28] border-[#2d2d3d] text-gray-300 hover:border-pink-500/50'
                      }`}
                      aria-pressed={active}
                    >
                      {labels[lang]}
                    </button>
                  );
                })}
              </div>
            </section>

          <section>
            <div className="rounded-xl bg-[#1a1a28] border border-[#2d2d3d] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">Créateurs proches</p>
                  <p className="text-xs text-gray-400 mt-0.5">Afficher uniquement les créateurs près de moi 📍</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.nearbyOnly}
                  onClick={() => setPrefs((p) => ({ ...p, nearbyOnly: !p.nearbyOnly }))}
                  className={`relative flex-shrink-0 ml-3 w-11 h-6 rounded-full transition-colors ${
                    prefs.nearbyOnly ? 'bg-pink-600' : 'bg-[#3d3d55]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      prefs.nearbyOnly ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  prefs.nearbyOnly ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-4 pb-4 border-t border-[#2d2d3d]">
                  <p className="text-xs text-gray-400 mt-3 mb-2">Distance maximale</p>
                  <div className="flex flex-wrap gap-2">
                    {([10, 30, 50, 100, 200] as const).map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setPrefs((p) => ({ ...p, nearbyDistance: km }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          prefs.nearbyDistance === km
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-[#12121e] text-gray-300 border-[#2d2d3d] hover:border-purple-500/50'
                        }`}
                        aria-pressed={prefs.nearbyDistance === km}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
          </div>
        </div>

        <div className="flex gap-3 px-4 py-4 border-t border-[#1e1e2f]">
          <button
            type="button"
            onClick={reset}
            className="flex-1 py-2.5 rounded-xl border border-[#2d2d3d] text-sm text-gray-400 hover:text-white hover:border-pink-500/50 transition-colors"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
