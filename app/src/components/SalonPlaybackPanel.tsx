import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { useSalonPlaybackSync } from '../hooks/useSalonPlaybackSync';
import { useSpotifySalonSync } from '../hooks/useSpotifySalonSync';
import {
  buildTrackUrlAtPosition,
  formatPlaybackTime,
  preferredParticipantPlatform,
  resolveSalonYoutubeTrackId,
  type MusicPlatform,
} from '../lib/salonPlayback';
import { openSpotifyApp, buildSpotifyAppUri } from '../lib/spotifyDeepLink';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { SalonYouTubePlayer } from './SalonYouTubePlayer';
import { useDraggableVideoPip } from './DraggableVideoPip';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
import { SalonSpotifySearch } from './SalonSpotifySearch';
import { SalonSpotifyPlaylist } from './SalonSpotifyPlaylist';
import { SalonYouTubePlaylist } from './SalonYouTubePlaylist';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import { PoweredBySpotify } from './PoweredBySpotify';
import { isMusicPlatformLinkedForSalon } from '../lib/platformConnect';
import {
  MAP_INLINE_LISTEN_MAX_MS,
  startMapInlineListenSession,
} from '../lib/mapListenSession';
import { getSalonShowYoutubeVideo, setSalonShowYoutubeVideo } from '../lib/salonYoutubeDisplay';
import { getSalonYoutubeVolume, setSalonYoutubeVolume } from '../lib/salonYoutubeVolume';
import { isYoutubeStrictCompliance } from '../lib/youtubeCompliance';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import {
  clearOpenSalonPipIntent,
  consumeSalonMinimizePipPending,
  consumeSalonOpenIntent,
  getOpenSalonPipIntent,
  getSalonVideoFloatActive,
  peekSalonOpenIntent,
  SALON_OPEN_PIP_EVENT,
  setSalonVideoFloatActive,
  subscribeSalonVideoFloat,
} from '../lib/salonVideoFloat';
import { PlatformConnectCard } from './PlatformConnectCard';
import { SalonAdBanner } from './SalonAdBanner';
import type { User } from '../types';
import type { PlaybackState, ResolvedSalonTrack, Salon, SalonQueueItem, SalonTrackProposal } from '../types';

interface SalonPlaybackPanelProps {
  salon: Salon;
  token: string | null;
  isHost: boolean;
  /** Modérateur VIP (⭐) : contrôle lecture et changement de morceau via le compte hôte. */
  isVipModerator?: boolean;
  userPlatforms?: MusicPlatform[];
  userPlatformLinks?: User['platformLinks'];
  onUserUpdated?: (user: User) => void;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onQueueChange?: (queue: SalonQueueItem[]) => void;
  hostCanControl?: boolean;
  queue?: SalonQueueItem[];
  proposals?: SalonTrackProposal[];
  loadingProposals?: boolean;
  skipping?: boolean;
  onSkip?: () => void;
  onPlayQueueItem?: (id: string) => void;
  onReorderQueue?: (orderedIds: string[]) => void | Promise<void>;
  reordering?: boolean;
  onAcceptProposal?: (proposalId: string, playNow: boolean) => Promise<void>;
  onRejectProposal?: (proposalId: string) => Promise<void>;
  onUpvoteProposal?: (proposalId: string) => Promise<void>;
  currentUserId?: string;
  onProposeTrack?: (body: {
    title: string;
    artist: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  }) => Promise<void>;
  /** Lecteur compact sur la carte (audio par défaut, sans file d'attente). */
  mapInline?: boolean;
  /** Grand salon : vidéo plein cadre + barre de contrôles en overlay. */
  theaterMode?: boolean;
  /** Salon YouTube — chat à gauche : hauteur chat = scène 16:9 uniquement (contrôles en dessous). */
  theaterSideDock?: boolean;
  /** Salon Spotify grand écran : barre de lecture compacte (sans scène théâtre). */
  salonQueueLayout?: boolean;
  /** false = coupe le lecteur (onglet carte masqué, autre audio actif). */
  playbackActive?: boolean;
  /** Grand salon plein écran — jamais de PiP auto au montage. */
  salonFullScreen?: boolean;
  onMapInlineListenCapReached?: () => void;
  /** Appelé quand l'utilisateur ancre la vidéo PiP (↙) — permet d'ouvrir le salon plein écran. */
  onAnchorVideoFloat?: () => void;
  /** Quitter le salon depuis le PiP (salon minimisé / changement d'onglet). */
  onLeaveSalon?: () => void;
}

const PLATFORM_META: Record<MusicPlatform, { label: string; emoji: string; accent: string }> = {
  spotify: { label: 'Spotify', emoji: '🎧', accent: 'text-green-400 border-green-500/40 bg-green-500/10' },
  youtube: { label: 'YouTube', emoji: '▶️', accent: 'text-red-400 border-red-500/40 bg-red-500/10' },
};

function SectionDivider() {
  return <div className="border-t border-[#1e1e2e]" aria-hidden />;
}

export function SalonPlaybackPanel({
  salon,
  token,
  isHost,
  isVipModerator = false,
  userPlatforms,
  userPlatformLinks,
  onUserUpdated,
  onPlaybackStateChange,
  onQueueChange,
  queue = [],
  proposals = [],
  loadingProposals,
  skipping,
  onSkip,
  onPlayQueueItem,
  onReorderQueue,
  reordering,
  onAcceptProposal,
  onRejectProposal,
  onUpvoteProposal,
  currentUserId,
  onProposeTrack,
  mapInline = false,
  theaterMode = false,
  theaterSideDock = false,
  salonQueueLayout = false,
  playbackActive = true,
  salonFullScreen = false,
  onMapInlineListenCapReached,
  onAnchorVideoFloat,
  onLeaveSalon,
}: SalonPlaybackPanelProps) {
  const { t } = useTranslation();
  const hostLinked = isHost && isMusicPlatformLinkedForSalon(salon.platform, userPlatforms, userPlatformLinks);
  const canControlPlayback = Boolean(hostLinked || isVipModerator);

  const [participantPlatform, setParticipantPlatform] = useState<MusicPlatform>(() =>
    preferredParticipantPlatform(userPlatforms, salon.platform)
  );
  const [resolved, setResolved] = useState<ResolvedSalonTrack | null>(null);
  const [resolving, setResolving] = useState(false);

  const [showYoutubeVideo, setShowYoutubeVideo] = useState<boolean>(() => {
    if (salon.platform === 'youtube' && isYoutubeStrictCompliance()) return true;
    if (mapInline) return salon.playbackState.showVideo ?? (salon.platform === 'youtube');
    return salon.playbackState.showVideo ?? (salon.platform === 'youtube' ? true : getSalonShowYoutubeVideo());
  });
  const [theaterYoutubeVolume, setTheaterYoutubeVolume] = useState(() => getSalonYoutubeVolume());
  const [theaterYoutubeMuted, setTheaterYoutubeMuted] = useState(false);
  const [participantSyncTrigger, setParticipantSyncTrigger] = useState(0);
  /** PiP flottant in-app (vidéo seule détachée, salon inchangé). */
  const [floatPipActive, setFloatPipActiveState] = useState(false);
  const floatPipActiveRef = useRef(floatPipActive);
  floatPipActiveRef.current = floatPipActive;
  const theaterHeroWrapRef = useRef<HTMLDivElement>(null);
  const [youtubeIsLive, setYoutubeIsLive] = useState(false);
  const [ytLiveSeekTrigger, setYtLiveSeekTrigger] = useState(0);
  /** Sync global PiP flag outside React updaters — avoids App re-render during child setState (#185). */
  const setFloatPipActive = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const prev = floatPipActiveRef.current;
    const next = typeof value === 'function' ? value(prev) : value;
    if (next === prev) return;
    setSalonVideoFloatActive(next);
    setFloatPipActiveState(next);
  }, []);

  useEffect(
    () =>
      subscribeSalonVideoFloat(() => {
        const next = getSalonVideoFloatActive();
        setFloatPipActiveState((prev) => (prev === next ? prev : next));
      }),
    []
  );

  const isFullScreenSalon = salonFullScreen;

  useEffect(() => {
    if (!isFullScreenSalon) return;
    setFloatPipActive(false);
    if (peekSalonOpenIntent() === 'full') {
      consumeSalonOpenIntent();
    }
  }, [salon.id, isFullScreenSalon, setFloatPipActive]);

  const hostShowVideoRef = useRef(salon.playbackState.showVideo);
  const prevYoutubeTrackRef = useRef(salon.playbackState.trackId);

  const {
    playbackState,
    displayPositionMs,
    play,
    pause,
    seek,
    isPlaying,
    applyPlaybackState,
    emitSync,
    emitPatch,
    reportHostProgress,
  } = useSalonPlaybackSync({
      salonId: salon.id,
      isHost: canControlPlayback,
      initialState: salon.playbackState,
      onStateChange: onPlaybackStateChange,
    });

  const prevFloatResetTrackRef = useRef(playbackState.trackId);

  const spotifySyncEnabled =
    salon.platform === 'spotify' && isHost && hostLinked && Boolean(token);
  const { nowPlaying: spotifyNowPlaying, syncError: spotifySyncError, markLocalControl, refreshNow: refreshSpotifySync } =
    useSpotifySalonSync({
      salonId: salon.id,
      token,
      enabled: spotifySyncEnabled,
      playbackActive,
      playbackState,
      emitSync,
    });

  useEffect(() => {
    if (salon.platform === 'youtube' && isYoutubeStrictCompliance()) {
      setShowYoutubeVideo((prev) => {
        if (prev) return prev;
        hostShowVideoRef.current = true;
        setSalonShowYoutubeVideo(true);
        return true;
      });
      return;
    }
    if (playbackState.showVideo === undefined) return;
    if (playbackState.showVideo === hostShowVideoRef.current) return;
    hostShowVideoRef.current = playbackState.showVideo;
    setShowYoutubeVideo(playbackState.showVideo);
    setSalonShowYoutubeVideo(playbackState.showVideo);
  }, [salon.platform, playbackState.showVideo]);

  useEffect(() => {
    if (salon.platform !== 'youtube') return;
    if (playbackState.trackId === prevYoutubeTrackRef.current) return;
    prevYoutubeTrackRef.current = playbackState.trackId;
    if (!playbackState.trackId || playbackState.trackId === 'demo') return;

    const show = playbackState.showVideo ?? true;
    hostShowVideoRef.current = show;
    setShowYoutubeVideo(show);
    setSalonShowYoutubeVideo(show);
    if (isHost && hostLinked && playbackState.showVideo !== true) {
      emitPatch({ showVideo: true });
    }
    // Reset live badge when switching to a different video.
    setYoutubeIsLive(false);
  }, [
    salon.platform,
    playbackState.trackId,
    playbackState.showVideo,
    isHost,
    hostLinked,
    emitPatch,
  ]);

  const autoSkipLockRef = useRef(false);
  const prevSpotifyActiveRef = useRef<boolean | null>(null);
  const [spotifyControlToast, setSpotifyControlToast] = useState<string | null>(null);
  const [syncNotif, setSyncNotif] = useState<string | null>(null);
  const spotifyLaunchRetryRef = useRef<number | null>(null);
  const spotifyAppLaunchIssuedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (spotifyLaunchRetryRef.current !== null) {
        window.clearTimeout(spotifyLaunchRetryRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!spotifyControlToast) return;
    const timer = window.setTimeout(() => setSpotifyControlToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [spotifyControlToast]);

  const launchSpotifyForHostPlayback = useCallback(
    (trackId?: string | null) => {
      spotifyAppLaunchIssuedRef.current = true;
      openSpotifyApp(trackId ?? playbackState.trackId);
      setSpotifyControlToast(t('salon.playbackMode.spotifyLaunchingApp'));
      window.setTimeout(() => {
        spotifyAppLaunchIssuedRef.current = false;
      }, 5000);
    },
    [playbackState.trackId, t]
  );

  const scheduleSpotifyPlayRetry = useCallback(
    (action: 'play' | 'next') => {
      if (!token || salon.platform !== 'spotify' || !canControlPlayback) return;
      if (spotifyLaunchRetryRef.current !== null) {
        window.clearTimeout(spotifyLaunchRetryRef.current);
      }
      spotifyLaunchRetryRef.current = window.setTimeout(() => {
        spotifyLaunchRetryRef.current = null;
        void api.spotifySalonPlaybackControl(token, salon.id, action).catch(() => {
          /* L'utilisateur a déjà le toast pour relancer Lecture manuellement. */
        });
      }, 3500);
    },
    [token, salon.platform, salon.id, canControlPlayback]
  );

  const callSpotifyControl = useCallback(
    async (action: 'pause' | 'play' | 'stop' | 'next') => {
      if (!token || salon.platform !== 'spotify' || !canControlPlayback) return;
      try {
        await api.spotifySalonPlaybackControl(token, salon.id, action);
        refreshSpotifySync();
      } catch (e) {
        const code = e instanceof ApiRequestError ? e.code : undefined;
        if (code === 'no_active_device' && (action === 'play' || action === 'next')) {
          if (!spotifyAppLaunchIssuedRef.current) {
            launchSpotifyForHostPlayback(playbackState.trackId);
          }
          scheduleSpotifyPlayRetry(action);
          return;
        }
        setSpotifyControlToast(e instanceof Error ? e.message : t('salon.playbackMode.spotifyControlError'));
      }
    },
    [
      token,
      salon.platform,
      salon.id,
      canControlPlayback,
      t,
      playbackState.trackId,
      launchSpotifyForHostPlayback,
      scheduleSpotifyPlayRetry,
      refreshSpotifySync,
    ]
  );

  const callSpotifySeek = useCallback(
    async (positionMs: number) => {
      if (!token || salon.platform !== 'spotify' || !canControlPlayback) return;
      try {
        await api.spotifySalonSeek(token, salon.id, positionMs);
        refreshSpotifySync();
      } catch (e) {
        setSpotifyControlToast(e instanceof Error ? e.message : t('salon.playbackMode.spotifyControlError'));
      }
    },
    [token, salon.platform, salon.id, canControlPlayback, t, refreshSpotifySync]
  );

  const handleHostPlay = useCallback(() => {
    if (spotifySyncEnabled) markLocalControl();
    play();
    if (spotifyNowPlaying && !spotifyNowPlaying.active) {
      launchSpotifyForHostPlayback(playbackState.trackId);
    }
    void callSpotifyControl('play');
  }, [
    play,
    callSpotifyControl,
    markLocalControl,
    spotifySyncEnabled,
    spotifyNowPlaying,
    launchSpotifyForHostPlayback,
    playbackState.trackId,
  ]);

  const handleHostPause = useCallback(() => {
    if (spotifySyncEnabled) markLocalControl();
    pause();
    void callSpotifyControl('pause');
  }, [pause, callSpotifyControl, markLocalControl, spotifySyncEnabled]);

  const handleHostStop = useCallback(() => {
    if (spotifySyncEnabled) markLocalControl();
    pause();
    seek(0);
    void callSpotifyControl('stop');
  }, [pause, seek, callSpotifyControl, markLocalControl, spotifySyncEnabled]);

  const handleHostNext = useCallback(() => {
    if (spotifySyncEnabled) markLocalControl();
    void callSpotifyControl('next');
  }, [callSpotifyControl, markLocalControl, spotifySyncEnabled]);

  const handleHostSeek = useCallback(
    (ms: number) => {
      if (spotifySyncEnabled) markLocalControl();
      seek(ms);
    },
    [seek, markLocalControl, spotifySyncEnabled]
  );

  const handleHostSeekCommitted = useCallback(
    (ms: number) => {
      if (salon.platform !== 'spotify' || !canControlPlayback) return;
      if (spotifySyncEnabled) markLocalControl();
      void callSpotifySeek(ms);
    },
    [salon.platform, canControlPlayback, spotifySyncEnabled, markLocalControl, callSpotifySeek]
  );

  const showParticipantYoutubeSync = !canControlPlayback && salon.platform === 'youtube';

  const handleParticipantSync = useCallback(async () => {
    if (!showParticipantYoutubeSync) return;
    try {
      if (token) {
        const { salon: fresh } = await api.getSalon(token, salon.id);
        applyPlaybackState(fresh.playbackState);
      }
    } catch {
      /* fallback to current shared state */
    }
    setParticipantSyncTrigger((n) => n + 1);
    setSyncNotif('✓ Synchronisé avec l\'hôte');
    window.setTimeout(() => setSyncNotif(null), 3000);
  }, [showParticipantYoutubeSync, token, salon.id, applyPlaybackState]);

  useEffect(() => {
    setParticipantPlatform(preferredParticipantPlatform(userPlatforms, salon.platform));
  }, [salon.platform, userPlatforms]);

  useEffect(() => {
    if (mapInline && !canControlPlayback) startMapInlineListenSession(salon.id);
  }, [mapInline, canControlPlayback, salon.id]);

  useEffect(() => {
    if (!token || canControlPlayback) return;
    let cancelled = false;
    setResolving(true);
    api
      .resolveSalonTrack(token, salon.id, participantPlatform)
      .then((r) => {
        if (!cancelled) setResolved(r.track);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, salon.id, participantPlatform, canControlPlayback, playbackState.title, playbackState.artist, playbackState.trackId]);

  const hostMeta = PLATFORM_META[salon.platform];
  const participantMeta = PLATFORM_META[participantPlatform];

  const openUrl = useMemo(() => {
    if (isHost) {
      return (
        playbackState.externalUrl ||
        (playbackState.trackId !== 'demo'
          ? participantPlatform === salon.platform
            ? resolved?.externalUrl
            : undefined
          : undefined)
      );
    }
    return resolved?.externalUrl;
  }, [isHost, playbackState, resolved, participantPlatform, salon.platform]);

  const youtubeTrackId =
    salon.platform === 'youtube' || participantPlatform === 'youtube'
      ? resolveSalonYoutubeTrackId(playbackState, resolved)
      : undefined;

  const canUseYoutubeEmbed =
    Boolean(youtubeTrackId) &&
    (salon.platform === 'youtube' ||
      (isHost ? !hostLinked && participantPlatform === 'youtube' : participantPlatform === 'youtube'));

  const effectiveShowYoutubeVideo =
    salon.platform === 'youtube' && isYoutubeStrictCompliance() ? true : showYoutubeVideo;

  /** Sync colonne chat gauche (match-hero) sur la hauteur réelle du hero vidéo 16:9. */
  useLayoutEffect(() => {
    if (!theaterMode || !theaterSideDock || salon.platform !== 'youtube') return;
    const el = theaterHeroWrapRef.current;
    if (!el) return;

    const syncHeroHeight = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h <= 0) return;
      const grid = el.closest<HTMLElement>('.room-theater-side-row--match-hero');
      grid?.style.setProperty('--salon-theater-hero-h', `${h}px`);
    };

    syncHeroHeight();
    const ro = new ResizeObserver(syncHeroHeight);
    ro.observe(el);
    window.addEventListener('resize', syncHeroHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHeroHeight);
      el.closest<HTMLElement>('.room-theater-side-row--match-hero')?.style.removeProperty('--salon-theater-hero-h');
    };
  }, [
    theaterMode,
    theaterSideDock,
    salon.platform,
    playbackState.trackId,
    effectiveShowYoutubeVideo,
    floatPipActive,
  ]);

  const theaterVideoFloatActive =
    theaterMode && floatPipActive && effectiveShowYoutubeVideo;
  const videoPip = useDraggableVideoPip(theaterVideoFloatActive, () => {
    setFloatPipActive(false);
    onAnchorVideoFloat?.();
  });

  const canAutoVideoFloat =
    theaterMode &&
    canUseYoutubeEmbed &&
    Boolean(youtubeTrackId) &&
    effectiveShowYoutubeVideo;

  const activateVideoFloatForMinimize = useCallback(() => {
    if (!canAutoVideoFloat || floatPipActiveRef.current) return;
    setFloatPipActive(true);
  }, [canAutoVideoFloat, setFloatPipActive]);

  /** Réduction salon plein écran → PiP vidéo persistant jusqu'à fermeture du salon. */
  useEffect(() => {
    if (isFullScreenSalon) return;
    if (!consumeSalonMinimizePipPending()) return;
    activateVideoFloatForMinimize();
  }, [isFullScreenSalon, activateVideoFloatForMinimize]);

  const tryAutoActivateVideoFloat = useCallback(() => {
    if (!canAutoVideoFloat || floatPipActiveRef.current) return;
    if (isFullScreenSalon || peekSalonOpenIntent() === 'full') return;
    setFloatPipActive(true);
  }, [canAutoVideoFloat, isFullScreenSalon, setFloatPipActive]);

  const tryOpenPipFromIntent = useCallback(() => {
    if (isFullScreenSalon || peekSalonOpenIntent() === 'full') {
      clearOpenSalonPipIntent();
      return;
    }
    const intentSalonId = getOpenSalonPipIntent();
    if (!intentSalonId || intentSalonId !== salon.id) return;
    if (!canAutoVideoFloat || floatPipActiveRef.current) return;
    clearOpenSalonPipIntent();
    setFloatPipActive(true);
  }, [salon.id, canAutoVideoFloat, isFullScreenSalon, setFloatPipActive]);

  useEffect(() => {
    if (!theaterMode) return;
    tryOpenPipFromIntent();
    const onOpenPip = () => tryOpenPipFromIntent();
    window.addEventListener(SALON_OPEN_PIP_EVENT, onOpenPip);
    return () => window.removeEventListener(SALON_OPEN_PIP_EVENT, onOpenPip);
  }, [theaterMode, tryOpenPipFromIntent]);

  useEffect(() => {
    if (!theaterMode) return;
    const onVisibility = () => {
      if (document.hidden) tryAutoActivateVideoFloat();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [theaterMode, tryAutoActivateVideoFloat]);

  useBackgroundPlayback(
    {
      title: playbackState.title,
      artist: playbackState.artist,
      artworkUrl: playbackState.albumArtUrl,
    },
    canUseYoutubeEmbed,
    playbackState.isPlaying
  );

  const toggleYoutubeVideo = () => {
    setShowYoutubeVideo((prev) => {
      const next = !prev;
      setSalonShowYoutubeVideo(next);
      if (!next) setFloatPipActive(false);
      if (isHost) {
        emitPatch({ showVideo: next });
      }
      return next;
    });
  };

  useEffect(() => {
    if (effectiveShowYoutubeVideo) return;
    // Guard: skip if float is already inactive — prevents spurious store writes and App re-renders (#185)
    if (!floatPipActiveRef.current) return;
    setFloatPipActive(false);
  }, [effectiveShowYoutubeVideo, setFloatPipActive]);

  useEffect(() => {
    if (playbackState.trackId === prevFloatResetTrackRef.current) return;
    prevFloatResetTrackRef.current = playbackState.trackId;
    // Guard: skip if float is already inactive — prevents spurious store writes and App re-renders (#185)
    if (!floatPipActiveRef.current) return;
    setFloatPipActive(false);
  }, [playbackState.trackId, setFloatPipActive]);

  /** Déclenché par SalonYouTubePlayer quand la vidéo se termine → skip auto si file non vide. */
  const handleVideoEnd = useCallback(() => {
    if (!canControlPlayback || !onSkip || queue.length === 0 || skipping) return;
    if (autoSkipLockRef.current) return;
    autoSkipLockRef.current = true;
    onSkip();
  }, [canControlPlayback, onSkip, queue.length, skipping]);

  useEffect(() => {
    autoSkipLockRef.current = false;
    prevSpotifyActiveRef.current = null;
  }, [playbackState.trackId, playbackState.updatedAt]);

  /** Spotify : fin de piste détectée via poll hôte → morceau suivant dans la file salon. */
  useEffect(() => {
    if (!canControlPlayback || !onSkip || queue.length === 0 || skipping) return;
    if (salon.platform !== 'spotify' || !spotifySyncEnabled) return;

    const spotify = spotifyNowPlaying;
    if (!spotify) return;

    const tryAutoSkip = () => {
      if (autoSkipLockRef.current || skipping) return;
      autoSkipLockRef.current = true;
      onSkip();
    };

    const wasActive = prevSpotifyActiveRef.current;
    prevSpotifyActiveRef.current = spotify.active;

    if (wasActive === true && !spotify.active && playbackState.isPlaying) {
      tryAutoSkip();
      return;
    }

    if (!spotify.active || !spotify.durationMs || spotify.durationMs < 5000) return;
    if (spotify.trackId && spotify.trackId !== playbackState.trackId) return;

    const nearEnd = spotify.progressMs >= spotify.durationMs - 2500;
    if (nearEnd && (!spotify.isPlaying || spotify.progressMs >= spotify.durationMs - 500)) {
      tryAutoSkip();
    }
  }, [
    canControlPlayback,
    onSkip,
    queue.length,
    skipping,
    salon.platform,
    spotifySyncEnabled,
    spotifyNowPlaying,
    playbackState.isPlaying,
    playbackState.trackId,
  ]);

  const syncListenUrl = useMemo(() => {
    if (!resolved?.trackId || resolved.trackId === 'demo') return resolved?.externalUrl;
    return buildTrackUrlAtPosition(participantPlatform, resolved.trackId, displayPositionMs);
  }, [resolved, participantPlatform, displayPositionMs]);

  const matchLabel =
    resolved?.matchType === 'exact'
      ? 'Même morceau'
      : resolved?.matchType === 'mock'
        ? 'Correspondance msdev'
        : 'Recherche automatique';

  const showHostQueue = !mapInline && !theaterMode && !salonQueueLayout && canControlPlayback;
  const showParticipantProposals = !mapInline && !theaterMode && !salonQueueLayout && !isHost && salon.allowQueue;

  const theaterVideoToggle =
    canUseYoutubeEmbed && youtubeTrackId && !isYoutubeStrictCompliance() ? (
      <button
        type="button"
        role="switch"
        aria-checked={showYoutubeVideo}
        onClick={toggleYoutubeVideo}
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition shrink-0 ${
          showYoutubeVideo
            ? 'border-purple-500/50 text-purple-200 bg-purple-950/40'
            : 'border-white/20 text-gray-400'
        }`}
      >
        {showYoutubeVideo ? 'Vidéo' : 'Audio'}
      </button>
    ) : null;

  const renderParticipantSyncButton = (className: string) =>
    showParticipantYoutubeSync ? (
      <button
        type="button"
        onClick={() => void handleParticipantSync()}
        className={className}
        title="Synchroniser avec l'hôte"
      >
        ↺ Synchroniser
      </button>
    ) : null;

  const playbackStatusBadge = (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
        isPlaying ? 'text-green-400 border-green-500/25 bg-green-500/10' : 'text-gray-500 border-white/15'
      }`}
    >
      {isPlaying ? 'Lecture' : 'Pause'}
    </span>
  );

  const playbackProgressInput = (
    <input
      type="range"
      min={0}
      max={600000}
      step={1000}
      value={Math.min(displayPositionMs, 600000)}
      onChange={
        canControlPlayback ? (e) => handleHostSeek(Number(e.target.value)) : undefined
      }
      onPointerUp={
        canControlPlayback
          ? (e) => handleHostSeekCommitted(Number((e.target as HTMLInputElement).value))
          : undefined
      }
      disabled={!canControlPlayback}
      readOnly={!canControlPlayback}
      className={`w-full accent-purple-500 h-1${
        !canControlPlayback ? ' opacity-70 cursor-default pointer-events-none' : ''
      }`}
      aria-label="Position de lecture"
    />
  );

  if (salonQueueLayout) {
    return (
      <>
        <section className="border-b border-[#1e1e2f] bg-[#101018] p-3 space-y-2.5">
          <h2 className="text-base font-bold text-white truncate leading-tight">{salon.title}</h2>

          <div className="flex items-center gap-3 min-w-0">
            {playbackState.albumArtUrl ? (
              <img
                src={playbackState.albumArtUrl}
                alt=""
                className="w-11 h-11 rounded-lg object-cover shrink-0 bg-[#1a1a26]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{playbackState.title}</p>
              <p className="text-xs text-gray-400 truncate">{playbackState.artist}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-mono tabular-nums text-white">
                {formatPlaybackTime(displayPositionMs)}
              </span>
              {playbackStatusBadge}
            </div>
          </div>

          {salon.platform === 'spotify' && (
            <div className="space-y-1">
              {(canControlPlayback ? isVipModerator && !isHost : true) && (
                <p className="text-[10px] text-green-400/80 leading-snug border border-green-500/20 bg-green-500/5 rounded-lg px-2.5 py-1.5">
                  {canControlPlayback
                    ? t('salon.playbackMode.spotifyVipHint', {
                        defaultValue: 'Modérateur VIP — vous pilotez la lecture Spotify de l\u2019hôte.',
                      })
                    : t('salon.playbackMode.spotifyParticipantHint')}
                </p>
              )}
              <PoweredBySpotify className="text-[10px] text-[#1DB954]/70 px-1" />
            </div>
          )}

          {canControlPlayback && (
            <div className="flex flex-wrap items-center gap-2">
              <>
                <button
                  type="button"
                  onClick={isPlaying ? handleHostPause : handleHostPlay}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition"
                >
                  {isPlaying ? 'Pause' : 'Lecture'}
                </button>
                <button
                  type="button"
                  onClick={handleHostStop}
                  className="px-2.5 py-1.5 rounded-xl border border-[#2a2a3a] text-xs text-gray-400 hover:text-white transition"
                  title="Stop (retour au début)"
                >
                  ⏹
                </button>
                {salon.platform === 'spotify' && (
                  <button
                    type="button"
                    onClick={handleHostNext}
                    className="px-2.5 py-1.5 rounded-xl border border-[#2a2a3a] text-xs text-gray-400 hover:text-white transition"
                    title="Morceau suivant"
                  >
                    ⏭
                  </button>
                )}
              </>
              {isHost && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    salon.accessMode === 'public' ? 'text-[#7ecba0]' : 'text-[#c4a460]'
                  }`}
                >
                  {salon.accessMode === 'public' ? '🌍 Public' : '🔒 Invitation'}
                </span>
              )}
              {isVipModerator && !isHost && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-medium text-amber-300/90">
                  ⭐ Modérateur VIP
                </span>
              )}
            </div>
          )}

          {renderParticipantSyncButton(
            'px-2.5 py-1.5 rounded-xl border border-[#2a2a3a] text-xs text-gray-400 hover:text-white transition'
          )}

          {playbackProgressInput}

        {isHost && !hostLinked && token && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-amber-400/90 text-center">
              Connectez {hostMeta.label} pour contrôler la lecture de ce salon.
            </p>
            <PlatformConnectCard
              token={token}
              platform={salon.platform}
              connectedPlatforms={userPlatforms}
              onUserUpdated={onUserUpdated}
            />
          </div>
        )}

        </section>
        {spotifyControlToast && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-amber-950/95 border border-amber-500/40 text-sm text-amber-100 shadow-lg text-center"
            role="status"
          >
            {spotifyControlToast}
          </div>
        )}
        {syncNotif && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-purple-950/95 border border-purple-500/40 text-sm text-purple-100 shadow-lg text-center"
            role="status"
          >
            {syncNotif}
          </div>
        )}
      </>
    );
  }

  if (theaterMode) {
    const showHostTheaterBar = Boolean(canControlPlayback);

    const theaterControlBtnClass =
      'px-2.5 py-1 rounded-full border border-white/10 bg-[#131318] text-xs font-medium text-[#8b8baf] hover:bg-white/5 hover:text-white transition shrink-0';

    const theaterTimeLabel = (
      <p className="text-sm font-mono tabular-nums text-white shrink-0">
        {formatPlaybackTime(displayPositionMs)}
      </p>
    );

    const theaterSyncPlayControls = showHostTheaterBar ? (
      <>
        <button
          type="button"
          onClick={isPlaying ? handleHostPause : handleHostPlay}
          className={theaterControlBtnClass}
        >
          {isPlaying ? 'Pause' : 'Lecture'}
        </button>
        {salon.platform === 'spotify' && (
          <button
            type="button"
            onClick={handleHostNext}
            className={theaterControlBtnClass}
            title="Morceau suivant"
          >
            ⏭
          </button>
        )}
      </>
    ) : null;

    const theaterLiveButton =
      youtubeIsLive && salon.platform === 'youtube' ? (
        <button
          type="button"
          onClick={() => setYtLiveSeekTrigger((n) => n + 1)}
          className="px-2.5 py-1 rounded-full border border-red-500/50 bg-red-950/30 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 transition shrink-0"
          title="Revenir au direct"
          aria-label="Revenir au direct"
        >
          🔴 Direct
        </button>
      ) : null;

    const theaterParticipantSyncButton = renderParticipantSyncButton(theaterControlBtnClass);

    const theaterVolumeControl =
      canUseYoutubeEmbed && youtubeTrackId ? (
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => setTheaterYoutubeMuted((m) => !m)}
            className={theaterControlBtnClass}
            aria-label={theaterYoutubeMuted ? 'Activer le son' : 'Couper le son'}
            title={theaterYoutubeMuted ? 'Activer le son' : 'Couper le son (local)'}
          >
            {theaterYoutubeMuted ? 'Muet' : 'Son'}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={theaterYoutubeMuted ? 0 : theaterYoutubeVolume}
            onChange={(e) => {
              const v = setSalonYoutubeVolume(Number(e.target.value));
              setTheaterYoutubeVolume(v);
              if (v > 0) setTheaterYoutubeMuted(false);
            }}
            className="w-16 sm:w-24 min-w-0 accent-[#6b6b9f] h-1"
            aria-label="Volume local"
            title="Volume local (n'affecte que votre écoute)"
          />
        </div>
      ) : null;

    /** Bouton détacher : PiP flottant in-app (vidéo seule, salon inchangé). */
    const theaterFloatPipButton =
      canUseYoutubeEmbed && youtubeTrackId && effectiveShowYoutubeVideo ? (
        <button
          type="button"
          onClick={() => setFloatPipActive((v) => !v)}
          className={`${theaterControlBtnClass}${floatPipActive ? ' border-purple-500/50 text-purple-200' : ''}`}
          title={floatPipActive ? 'Ancrer la vidéo' : 'Détacher la vidéo'}
          aria-label={floatPipActive ? 'Ancrer la vidéo' : 'Détacher la vidéo'}
          aria-pressed={floatPipActive}
        >
          {floatPipActive ? '↙' : '⧉'}
        </button>
      ) : null;

    const theaterAlbumPlaceholder = (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 bg-[#0b0b0f]"
        style={{
          backgroundImage: playbackState.albumArtUrl
            ? `url(${playbackState.albumArtUrl})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/70" aria-hidden />
        <img
          src={playbackState.albumArtUrl}
          alt=""
          className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 rounded-2xl shadow-2xl object-cover"
        />
        <div className="relative z-10 text-center max-w-sm px-4">
          <p className="text-base sm:text-lg font-bold text-white truncate">{playbackState.title}</p>
          <p className="text-sm text-gray-300 truncate">{playbackState.artist}</p>
        </div>
      </div>
    );

    const theaterHero = canUseYoutubeEmbed && youtubeTrackId ? (
      <>
        {(!effectiveShowYoutubeVideo || floatPipActive) ? theaterAlbumPlaceholder : null}
        <SalonYouTubePlayer
          videoId={youtubeTrackId}
          playbackState={playbackState}
          showVideo={effectiveShowYoutubeVideo}
          fillContainer
          showLocalControls={false}
          showLocalPause={false}
          showYoutubeLinkInControls={false}
          playbackActive={playbackActive}
          isHost={canControlPlayback}
          salonVolume={theaterYoutubeVolume}
          salonMuted={theaterYoutubeMuted}
          onHostProgressReport={canControlPlayback ? reportHostProgress : undefined}
          onHostLocalPause={canControlPlayback ? handleHostPause : undefined}
          onHostLocalPlay={canControlPlayback ? handleHostPlay : undefined}
          onVideoEnd={handleVideoEnd}
          participantSyncTrigger={participantSyncTrigger}
          videoFloat={theaterVideoFloatActive ? videoPip : undefined}
          videoFloatTitle={playbackState.title}
          onLeaveSalon={!salonFullScreen ? onLeaveSalon : undefined}
          onIsLiveChange={setYoutubeIsLive}
          liveSeekTrigger={ytLiveSeekTrigger}
        />
      </>
    ) : (
      theaterAlbumPlaceholder
    );

    return (
      <>
      <section
        className={`salon-theater-panel flex flex-col w-full min-h-0 overflow-hidden bg-black${
          theaterSideDock ? '' : ' h-full'
        }`}
      >
        <div ref={theaterHeroWrapRef} className="salon-theater-hero-wrap relative w-full shrink-0 bg-black">
          <div className="salon-theater-hero shrink-0 w-full relative bg-black">
            <div className="w-full aspect-video relative overflow-hidden">
              {theaterHero}
            </div>
          </div>
        </div>

        <div className="salon-theater-controls shrink-0 border-t border-[#1e1e2f] bg-[#0b0b0f] px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {theaterTimeLabel}
            {theaterSyncPlayControls}
            {theaterLiveButton}
            {theaterParticipantSyncButton}
            {canControlPlayback ? theaterVideoToggle : null}
            {theaterFloatPipButton}
            {theaterVolumeControl}
            <span className="ml-auto flex shrink-0">{playbackStatusBadge}</span>
          </div>
          {playbackProgressInput}
        </div>

        {/* YouTube TOS §4.B: no advertising revenue alongside YouTube API services */}
        {salon.platform !== 'youtube' && <SalonAdBanner />}

        <div
          className={`salon-theater-panel-extra min-h-0 overflow-y-auto${
            theaterSideDock ? ' shrink-0' : ' flex-1'
          }`}
        >
        {isHost && !hostLinked && token && (
          <div className="shrink-0 p-3 border-t border-[#1e1e2f] bg-[#101018]/90 space-y-2">
            <p className="text-xs text-amber-400/90 text-center">
              Connectez {hostMeta.label} pour contrôler la lecture de ce salon.
            </p>
            <PlatformConnectCard
              token={token}
              platform={salon.platform}
              connectedPlatforms={userPlatforms}
              onUserUpdated={onUserUpdated}
            />
          </div>
        )}

        {!isHost && salon.platform !== 'spotify' && salon.platform !== 'youtube' && (
          <div className="shrink-0 border-t border-[#1e1e2f] bg-[#101018]/95 p-3 space-y-3">
            <p className="text-[11px] text-center text-[#6b6b8a] py-0.5">
              🎵 L&apos;hôte contrôle la lecture&thinsp;•&thinsp;Vous pouvez proposer des vidéos
            </p>
            {!(canUseYoutubeEmbed && participantPlatform === 'youtube') && (
              <div className="grid grid-cols-2 gap-2">
                {(['spotify', 'youtube'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setParticipantPlatform(p)}
                    className={`py-2 rounded-xl border text-xs font-semibold capitalize transition ${
                      participantPlatform === p ? PLATFORM_META[p].accent : 'border-[#2a2a3a] text-gray-500'
                    }`}
                  >
                    {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
                  </button>
                ))}
              </div>
            )}
            {participantPlatform === 'spotify' || !canUseYoutubeEmbed ? (
              resolving ? (
                <p className="text-xs text-gray-500 text-center">Recherche du morceau…</p>
              ) : resolved ? (
                <div className="rounded-xl border border-[#2a2a3a] bg-[#0b0b0f] p-3 space-y-2">
                  <p className="text-[10px] text-purple-300/80 uppercase tracking-wide">{matchLabel}</p>
                  <p className="text-sm text-white font-medium truncate">{resolved.title}</p>
                  {participantPlatform === 'youtube' && resolved.trackId && resolved.trackId !== 'demo' ? (
                    <OpenOnYoutubeButton trackId={resolved.trackId} positionMs={displayPositionMs} />
                  ) : (
                    <a
                      href={
                        participantPlatform === 'spotify'
                          ? buildSpotifyAppUri(resolved.trackId) || (syncListenUrl ?? resolved.externalUrl)
                          : syncListenUrl ?? resolved.externalUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`block w-full text-center py-2 rounded-xl border font-semibold text-sm ${participantMeta.accent}`}
                    >
                      {`Ouvrir dans Spotify à ${formatPlaybackTime(displayPositionMs)}`}
                    </a>
                  )}
                </div>
              ) : null
            ) : null}
          </div>
        )}
        </div>
      </section>
      {syncNotif && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-purple-950/95 border border-purple-500/40 text-sm text-purple-100 shadow-lg text-center"
          role="status"
        >
          {syncNotif}
        </div>
      )}
      </>
    );
  }

  return (
    <>
    {mapInline && canUseYoutubeEmbed && youtubeTrackId && (
      <div className="w-full max-w-[320px] mx-auto aspect-video bg-black overflow-hidden rounded-lg">
        <SalonYouTubePlayer
          videoId={youtubeTrackId}
          playbackState={playbackState}
          showVideo={effectiveShowYoutubeVideo}
          showLocalControls={!canControlPlayback}
          showLocalPause={false}
          showYoutubeLinkInControls={salon.platform === 'youtube' && !canControlPlayback}
          playbackActive={playbackActive}
          isHost={canControlPlayback}
          onHostProgressReport={canControlPlayback ? reportHostProgress : undefined}
          onHostLocalPause={canControlPlayback ? handleHostPause : undefined}
          onHostLocalPlay={canControlPlayback ? handleHostPlay : undefined}
          onVideoEnd={handleVideoEnd}
          participantSyncTrigger={participantSyncTrigger}
          controlsTrailing={renderParticipantSyncButton(
            'px-2.5 py-1 rounded-full border border-white/10 bg-[#131318] text-xs font-medium text-[#8b8baf] hover:bg-white/5 hover:text-white transition shrink-0'
          )}
        />
      </div>
    )}
    <section
      className={`w-full overflow-hidden border border-[#1e1e2e] bg-[#101018] ${
        mapInline ? 'mt-0 max-w-none rounded-xl' : 'mt-3 max-w-md rounded-2xl'
      }`}
    >
      {/* Header + horloge + contrôles host */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold text-purple-400/90 uppercase tracking-wider">Écoute ensemble</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              {hostMeta.emoji} {hostMeta.label}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                isPlaying ? 'text-green-400 border-green-500/25 bg-green-500/10' : 'text-gray-500 border-[#2a2a3a]'
              }`}
            >
              {isPlaying ? 'Lecture' : 'Pause'}
            </span>
          </div>
        </div>

        {salon.platform === 'spotify' && (
          <div className="space-y-1">
            {!(isHost && hostLinked) && (
              <p className="text-[10px] text-green-400/80 leading-snug border border-green-500/20 bg-green-500/5 rounded-lg px-2.5 py-2">
                {t('salon.playbackMode.spotifyParticipantHint')}
              </p>
            )}
            <PoweredBySpotify className="text-[10px] text-[#1DB954]/70 px-1" />
          </div>
        )}

        {salon.platform === 'spotify' && isHost && hostLinked && (
          <div className="rounded-xl border border-green-500/25 bg-[#0b120f] p-3 flex items-center gap-3 min-w-0">
            {(spotifyNowPlaying?.albumArtUrl || playbackState.albumArtUrl) ? (
              <img
                src={spotifyNowPlaying?.albumArtUrl || playbackState.albumArtUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[#1a1a26] ring-1 ring-white/10"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-green-400/80 uppercase tracking-wide">
                {spotifyNowPlaying?.active
                  ? t('salon.playbackMode.spotifyNowPlaying')
                  : t('salon.playbackMode.spotifyNoActivePlayback')}
              </p>
              {spotifyNowPlaying?.active ? (
                <>
                  <p className="text-sm font-semibold text-white truncate">
                    {spotifyNowPlaying.title ?? playbackState.title}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {spotifyNowPlaying.artist ?? playbackState.artist}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500 leading-snug">
                  {t('salon.playbackMode.spotifyOpenAppHint')}
                </p>
              )}
            </div>
            {spotifyNowPlaying?.active ? (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                  spotifyNowPlaying.isPlaying
                    ? 'text-green-400 border-green-500/30 bg-green-500/10'
                    : 'text-gray-500 border-white/15'
                }`}
              >
                {spotifyNowPlaying.isPlaying ? '▶ Spotify' : '⏸ Spotify'}
              </span>
            ) : null}
          </div>
        )}

        {salon.platform === 'spotify' && !canControlPlayback && (
          <div className="rounded-xl border border-green-500/25 bg-[#0b120f] p-3 flex items-center gap-3 min-w-0">
            {playbackState.albumArtUrl ? (
              <img
                src={playbackState.albumArtUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[#1a1a26] ring-1 ring-white/10"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{playbackState.title}</p>
              <p className="text-xs text-gray-400 truncate">{playbackState.artist}</p>
            </div>
            {playbackStatusBadge}
          </div>
        )}

        {spotifySyncError && isHost && hostLinked && (
          <p className="text-[10px] text-amber-400/90 leading-snug">{spotifySyncError}</p>
        )}
        {salon.platform === 'youtube' && (
          <div className="space-y-1">
            <p className="text-[10px] text-red-400/80 leading-snug border border-red-500/20 bg-red-500/5 rounded-lg px-2.5 py-2">
              {t('salon.playbackMode.youtubeSyncBanner')}
            </p>
            {mapInline && !isHost && (
              <p className="text-[10px] text-red-400/60 leading-snug px-1">
                {t('salon.playbackMode.mapListenCapHint')}
              </p>
            )}
            <p className="text-[10px] text-red-400/50 leading-snug px-1">
              {t('salon.playbackMode.youtubeAttribution')}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <p className="text-3xl font-mono tabular-nums text-white tracking-tight">
            {formatPlaybackTime(displayPositionMs)}
          </p>
          {isHost && hostLinked && (
            <div className="flex-1 flex gap-1.5 min-w-0 items-center flex-wrap justify-end">
              <button
                type="button"
                onClick={isPlaying ? handleHostPause : handleHostPlay}
                className={`${mapInline ? 'px-2 py-1 text-xs' : 'flex-1 py-2 text-sm'} rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white transition`}
              >
                {isPlaying ? 'Pause' : 'Lecture'}
              </button>
              <button
                type="button"
                onClick={handleHostStop}
                className={`${mapInline ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-xl border border-[#2a2a3a] text-gray-400 hover:text-white transition`}
                title="Stop (retour au début)"
              >
                ⏹
              </button>
              {salon.platform === 'spotify' && (
                <button
                  type="button"
                  onClick={handleHostNext}
                  className={`${mapInline ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-xl border border-[#2a2a3a] text-gray-400 hover:text-white transition`}
                  title="Morceau suivant"
                >
                  ⏭
                </button>
              )}
              {salon.platform === 'youtube' &&
                playbackState.trackId &&
                playbackState.trackId !== 'demo' && (
                  <OpenOnYoutubeButton trackId={playbackState.trackId} positionMs={displayPositionMs} />
                )}
            </div>
          )}
          {(!mapInline || !canUseYoutubeEmbed || !youtubeTrackId) &&
            renderParticipantSyncButton(
              `${mapInline ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-xl border border-[#2a2a3a] text-gray-400 hover:text-white transition`
            )}
        </div>

        {(isHost && hostLinked) || (salon.platform === 'spotify' && !canControlPlayback)
          ? playbackProgressInput
          : null}

      </div>

      {isHost && !hostLinked && token && (
        <>
          <SectionDivider />
          <div className="p-4 space-y-2">
            <p className="text-xs text-amber-400/90 text-center">
              Connectez {hostMeta.label} pour contrôler la lecture de ce salon.
            </p>
            <PlatformConnectCard
              token={token}
              platform={salon.platform}
              connectedPlatforms={userPlatforms}
              onUserUpdated={onUserUpdated}
            />
          </div>
        </>
      )}

      {!mapInline && isHost && hostLinked && salon.platform === 'youtube' && token && (
        <>
          <SectionDivider />
          <div className="p-4">
            <SalonYouTubeSearch
              salonId={salon.id}
              token={token}
              currentTitle={playbackState.title}
              currentArtist={playbackState.artist}
              onTrackChanged={applyPlaybackState}
              onQueueChanged={onQueueChange}
            />
          </div>
          <SectionDivider />
          <div className="p-4">
            <SalonYouTubePlaylist
              salonId={salon.id}
              token={token}
              onTrackChanged={applyPlaybackState}
              onQueueChanged={onQueueChange}
            />
          </div>
        </>
      )}

      {!mapInline && canControlPlayback && salon.platform === 'spotify' && token && (
        <>
          <SectionDivider />
          <div className="p-4">
            <SalonSpotifySearch
              salonId={salon.id}
              token={token}
              currentTitle={playbackState.title}
              currentArtist={playbackState.artist}
              onQueueChanged={onQueueChange}
            />
          </div>
          <SectionDivider />
          <div className="p-4">
            <SalonSpotifyPlaylist
              salonId={salon.id}
              token={token}
              onTrackChanged={applyPlaybackState}
              onQueueChanged={onQueueChange}
            />
          </div>
        </>
      )}

      {canUseYoutubeEmbed && youtubeTrackId && !mapInline && (
        <>
          <SectionDivider />
          <div className="p-4 space-y-3">
            {!isYoutubeStrictCompliance() && (
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-gray-200">
                  {showYoutubeVideo ? 'Vidéo' : 'Audio seul'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showYoutubeVideo}
                  onClick={toggleYoutubeVideo}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                    showYoutubeVideo ? 'bg-purple-600' : 'bg-[#2a2a3a]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      showYoutubeVideo ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            )}

            {/* En mode mapInline, marges négatives pour que la vidéo occupe toute la largeur de la section */}
            <div className={mapInline ? '-mx-4 w-[calc(100%+2rem)]' : 'w-full min-w-0'}>
              <SalonYouTubePlayer
                videoId={youtubeTrackId}
                playbackState={playbackState}
                showVideo={effectiveShowYoutubeVideo}
              showLocalControls={mapInline && !(isHost && hostLinked)}
              showLocalPause={false}
              showYoutubeLinkInControls={!mapInline || (salon.platform === 'youtube' && !(isHost && hostLinked))}
                playbackActive={playbackActive}
                isHost={canControlPlayback}
                onHostProgressReport={canControlPlayback ? reportHostProgress : undefined}
                onHostLocalPause={canControlPlayback ? handleHostPause : undefined}
                onHostLocalPlay={canControlPlayback ? handleHostPlay : undefined}
                onVideoEnd={handleVideoEnd}
                mapInlineListenCapMs={
                  mapInline && !isHost ? MAP_INLINE_LISTEN_MAX_MS : undefined
                }
                mapInlineListenSessionKey={mapInline && !isHost ? salon.id : undefined}
                onMapInlineListenCapReached={onMapInlineListenCapReached}
                participantSyncTrigger={participantSyncTrigger}
              />
            </div>

            {/* OpenOnYoutubeButton : visible sous la vidéo pour les hôtes liés en mapInline
                (les autres utilisateurs le reçoivent déjà via showYoutubeLinkInControls du player) */}
            {mapInline && salon.platform === 'youtube' && isHost && hostLinked && youtubeTrackId !== 'demo' && (
              <div className="flex justify-end pt-1">
                <OpenOnYoutubeButton
                  trackId={youtubeTrackId}
                  positionMs={displayPositionMs}
                  variant="youtube-red"
                />
              </div>
            )}

            {salon.platform === 'youtube' && !mapInline && (
              <div className="flex justify-center">
                <OpenOnYoutubeButton
                  trackId={youtubeTrackId}
                  positionMs={displayPositionMs}
                />
              </div>
            )}
          </div>
        </>
      )}

      {!canControlPlayback && salon.platform !== 'spotify' && (
        <>
          <SectionDivider />
          <div className="p-4 space-y-3">
            <p className="text-[11px] text-center text-[#6b6b8a] py-0.5">
              🎵 L&apos;hôte contrôle la lecture&thinsp;•&thinsp;Vous pouvez proposer des morceaux
            </p>
            {salon.allowQueue && token && salon.platform === 'youtube' && (
              <SalonYouTubeSearch
                salonId={salon.id}
                token={token}
                currentTitle={playbackState.title}
                currentArtist={playbackState.artist}
                submitMode="propose"
              />
            )}
            {!(canUseYoutubeEmbed && participantPlatform === 'youtube') && (
              <>
                <p className="text-xs text-gray-400 text-center leading-snug">
                  Choisissez <strong className="text-white">YouTube</strong> pour écouter synchronisé avec l&apos;hôte.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['spotify', 'youtube'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setParticipantPlatform(p)}
                      className={`py-2 rounded-xl border text-xs font-semibold capitalize transition ${
                        participantPlatform === p ? PLATFORM_META[p].accent : 'border-[#2a2a3a] text-gray-500'
                      }`}
                    >
                      {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {participantPlatform === 'spotify' || !canUseYoutubeEmbed ? (
              resolving ? (
                <p className="text-xs text-gray-500 text-center">Recherche du morceau…</p>
              ) : resolved ? (
                <div className="rounded-xl border border-[#2a2a3a] bg-[#0b0b0f] p-3 space-y-2">
                  <p className="text-[10px] text-purple-300/80 uppercase tracking-wide">{matchLabel}</p>
                  <p className="text-sm text-white font-medium truncate">{resolved.title}</p>
                  <p className="text-xs text-gray-500 truncate">{resolved.artist}</p>
                  {participantPlatform === 'youtube' && resolved.trackId && resolved.trackId !== 'demo' ? (
                    <div className="flex justify-center">
                      <OpenOnYoutubeButton
                        trackId={resolved.trackId}
                        positionMs={displayPositionMs}
                        label={`YouTube ↗ · ${formatPlaybackTime(displayPositionMs)}`}
                      />
                    </div>
                  ) : (
                    <a
                      href={
                        participantPlatform === 'spotify'
                          ? buildSpotifyAppUri(resolved.trackId) || (syncListenUrl ?? resolved.externalUrl)
                          : syncListenUrl ?? resolved.externalUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className={`block w-full text-center py-2 rounded-xl border font-semibold text-sm ${participantMeta.accent}`}
                    >
                      {`Ouvrir dans Spotify à ${formatPlaybackTime(displayPositionMs)}`}
                    </a>
                  )}
                </div>
              ) : openUrl ? (
                participantPlatform === 'youtube' &&
                salon.platform === 'youtube' &&
                playbackState.trackId &&
                playbackState.trackId !== 'demo' ? (
                  <div className="flex justify-center">
                    <OpenOnYoutubeButton
                      trackId={playbackState.trackId}
                      positionMs={displayPositionMs}
                    />
                  </div>
                ) : (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`block w-full text-center py-2 rounded-xl border font-semibold text-sm ${participantMeta.accent}`}
                  >
                    Ouvrir sur {participantMeta.label}
                  </a>
                )
              ) : null
            ) : null}

            {participantPlatform === 'spotify' && (
              <p className="text-[10px] text-gray-600 text-center leading-snug">
                {t('salon.playbackMode.spotifyCrossPlatformHint')}
              </p>
            )}
          </div>
        </>
      )}

      {(showHostQueue || showParticipantProposals) && (
        <>
          <SectionDivider />
          <div className="p-4 space-y-4">
            {showHostQueue && (
              <>
                <SalonQueueSection
                  queue={queue}
                  isHost={canControlPlayback}
                  allowQueue={salon.allowQueue}
                  salonId={salon.id}
                  onSkip={onSkip}
                  onPlayItem={onPlayQueueItem}
                  onReorder={onReorderQueue}
                  skipping={skipping}
                  reordering={reordering}
                  compact
                />
                <SalonProposalsSection
                  isHost
                  allowQueue={salon.allowQueue}
                  proposals={proposals}
                  loadingProposals={loadingProposals}
                  currentUserId={currentUserId}
                  onAccept={onAcceptProposal}
                  onReject={onRejectProposal}
                  onUpvote={onUpvoteProposal}
                  compact
                />
              </>
            )}
            {showParticipantProposals && (
              <SalonProposalsSection
                isHost={false}
                allowQueue={salon.allowQueue}
                proposals={proposals}
                currentUserId={currentUserId}
                onUpvote={onUpvoteProposal}
                onPropose={onProposeTrack}
              />
            )}
          </div>
        </>
      )}
    </section>
    {spotifyControlToast && (
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-amber-950/95 border border-amber-500/40 text-sm text-amber-100 shadow-lg text-center"
        role="status"
      >
        {spotifyControlToast}
      </div>
    )}
    {syncNotif && (
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-purple-950/95 border border-purple-500/40 text-sm text-purple-100 shadow-lg text-center"
        role="status"
      >
        {syncNotif}
      </div>
    )}
    </>
  );
}
