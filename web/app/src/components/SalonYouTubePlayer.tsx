import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  VIDEO_PIP_HEADER_HEIGHT,
  VIDEO_PIP_WIDTH,
  type VideoPipFloatApi,
} from './DraggableVideoPip';
import { AccelerateBadge } from './AccelerateBadge';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { PoweredByYouTube } from './PoweredByYouTube';
import { useHoldToAccelerate, HOLD_ACCELERATE_RATE } from '../hooks/useHoldToAccelerate';
import { useYouTubeIframeApi, useYoutubeConsentBlocked } from '../hooks/useYouTubeIframeApi';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import { setMediaSessionHandlers } from '../lib/mediaSessionControl';
import {
  getAppMediaOwner,
  requestAppMediaFocus,
  releaseAppMediaFocus,
  subscribeAppMediaFocus,
} from '../lib/appMediaFocus';
import { getMapListenVolume, setMapListenVolume } from '../lib/mapListenVolume';
import { getSalonYoutubeVolume } from '../lib/salonYoutubeVolume';
import { getMapInlineListenElapsedMs } from '../lib/mapListenSession';
import { computePlaybackPositionMs, isValidYoutubeVideoId } from '../lib/salonPlayback';
import { setCookieConsent } from '../lib/cookieConsent';
import { isYoutubeStrictCompliance } from '../lib/youtubeCompliance';
import type { PlaybackState } from '../types';

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const DRIFT_SEC = 1.8;
const SEEK_COOLDOWN_MS = 2500;
const HOST_PROGRESS_LEAD_MS = 1500;

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoLoadedFraction: () => number;
  getPlayerState: () => number;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  setSize: (width: number, height: number) => void;
  destroy: () => void;
  getVideoData?: () => { isLive?: boolean; [key: string]: unknown };
}

interface SalonYouTubePlayerProps {
  videoId: string;
  playbackState: PlaybackState;
  /** Positionnement / marges autour du lecteur (ne doit pas fixer la hauteur) */
  className?: string;
  /** Plein écran dans le conteneur parent (live agrandi) */
  fillContainer?: boolean;
  /** false = lecteur masqué (audio + synchro conservés) */
  showVideo?: boolean;
  /** Pause / volume locaux (écoute rapide carte). */
  showLocalControls?: boolean;
  /** Lien YouTube dans la rangée de contrôles locaux (désactivé si déjà dans l’en-tête fiche). */
  showYoutubeLinkInControls?: boolean;
  /** false = pause + mute (onglet carte inactif, autre source audio). */
  playbackActive?: boolean;
  /** false = pas de lecture auto (fiche carte repliée avant « Écouter »). */
  autoplayAllowed?: boolean;
  /** Hôte : rapporte la position réelle du lecteur (ms) pour sync_playback. */
  onHostProgressReport?: (progressMs: number) => void;
  /** Hôte : pause locale sur l’embed YouTube (clic vidéo) — propage vers sync salon. */
  onHostLocalPause?: () => void;
  /** Hôte : reprise locale sur l’embed YouTube — propage vers sync salon. */
  onHostLocalPlay?: () => void;
  /** Contrôles pause/volume discrets (petit salon carte). */
  minimalLocalControls?: boolean;
  /** Classes additionnelles du lien YouTube. */
  youtubeLinkClassName?: string;
  /** Style du lien YouTube (rouge marque sur petit salon carte). */
  youtubeLinkVariant?: 'default' | 'youtube-red';
  /** Boutons à droite de la barre (ex. Salon) dans la rangée locale. */
  controlsTrailing?: ReactNode;
  /** Éléments avant Pause (ex. chrono en mode théâtre plein écran). */
  controlsLeading?: ReactNode;
  /** Remplace le bouton Pause local (ex. lecture sync hôte en grand salon). */
  controlsPlayOverride?: ReactNode;
  /** false = masquer Pause local (Son/volume restent visibles). */
  showLocalPause?: boolean;
  /** Sous la rangée principale (ex. scrubber hôte en grand salon). */
  controlsFooter?: ReactNode;
  /** true = l'utilisateur est l'hôte (contrôles YouTube natifs activés pour lui). */
  isHost?: boolean;
  /** Appelé quand la vidéo se termine (état YT.PlayerState.ENDED). */
  onVideoEnd?: () => void;
  /** Appelé quand l'embed YouTube est interdit (erreur 101 ou 150). */
  onEmbedError?: () => void;
  /** Appelé quand le statut live/non-live de la vidéo change. */
  onIsLiveChange?: (isLive: boolean) => void;
  /** Incrémenté pour déclencher un saut au direct (seekTo live edge). */
  liveSeekTrigger?: number;
  /** Petit salon carte : durée max d'écoute (ms) avant pause automatique. */
  mapInlineListenCapMs?: number;
  /** Clé de session (salonId) pour le chrono carte. */
  mapInlineListenSessionKey?: string;
  /** Appelé une fois quand la durée max carte est atteinte. */
  onMapInlineListenCapReached?: () => void;
  /** Volume local salon (mode théâtre, contrôlé par le parent — non synchronisé). */
  salonVolume?: number;
  /** Mute local salon (mode théâtre, contrôlé par le parent — non synchronisé). */
  salonMuted?: boolean;
  /** Participant : incrémenté pour forcer l’alignement local sur l’état hôte. */
  participantSyncTrigger?: number;
  /** PiP flottant in-app : vidéo seule, déplaçable, toujours au premier plan. */
  videoFloat?: VideoPipFloatApi;
  /** Titre affiché dans la barre de drag du PiP flottant. */
  videoFloatTitle?: string;
  /** Salon minimisé / navigation — quitter la session depuis le PiP. */
  onLeaveSalon?: () => void;
}

function applySync(
  player: YTPlayerInstance,
  state: PlaybackState,
  forceSeek: boolean,
  respectLocalPause = false,
  allowPlayback = true
) {
  if (!allowPlayback) {
    try {
      if (player.getPlayerState() !== YT_PAUSED) player.pauseVideo();
      player.mute();
    } catch {
      /* ignore */
    }
    return;
  }
  const targetSec = computePlaybackPositionMs(state) / 1000;
  try {
    const current = player.getCurrentTime();
    if (forceSeek || Math.abs(current - targetSec) > DRIFT_SEC) {
      player.seekTo(targetSec, true);
    }
    if (state.isPlaying) {
      if (!respectLocalPause && player.getPlayerState() !== YT_PLAYING) {
        requestAppMediaFocus('salon');
        player.playVideo();
      }
    } else if (player.getPlayerState() !== YT_PAUSED) {
      player.pauseVideo();
    }
  } catch {
    /* ignore */
  }
}

/** Aligne la position sur l'hôte sans lancer la lecture (fiche carte repliée). */
function applySilentPositionSync(player: YTPlayerInstance, state: PlaybackState, forceSeek: boolean) {
  const targetSec = computePlaybackPositionMs(state) / 1000;
  try {
    const current = player.getCurrentTime();
    if (forceSeek || Math.abs(current - targetSec) > DRIFT_SEC) {
      player.seekTo(targetSec, true);
    }
    if (player.getPlayerState() !== YT_PAUSED) player.pauseVideo();
    player.mute();
  } catch {
    /* ignore */
  }
}

export function SalonYouTubePlayer({
  videoId,
  playbackState,
  className,
  fillContainer = false,
  showVideo = true,
  showLocalControls = false,
  showYoutubeLinkInControls = true,
  playbackActive = true,
  autoplayAllowed = true,
  onHostProgressReport,
  onHostLocalPause,
  onHostLocalPlay,
  minimalLocalControls = false,
  youtubeLinkClassName = '',
  youtubeLinkVariant = 'default',
  controlsTrailing,
  controlsLeading,
  controlsPlayOverride,
  showLocalPause = true,
  controlsFooter,
  isHost: _isHost = false,
  onVideoEnd,
  onEmbedError,
  onIsLiveChange,
  liveSeekTrigger,
  mapInlineListenCapMs,
  mapInlineListenSessionKey,
  onMapInlineListenCapReached,
  salonVolume,
  salonMuted,
  participantSyncTrigger,
  videoFloat,
  videoFloatTitle = 'Vidéo',
  onLeaveSalon,
}: SalonYouTubePlayerProps) {
  const { t } = useTranslation();
  const consentBlocked = useYoutubeConsentBlocked();
  const apiReady = useYouTubeIframeApi();
  const containerRef = useRef<HTMLDivElement>(null);
  /** Boîte 16:9 réelle (stage théâtre ou surface aspect-video). */
  const sizeRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const loadedVideoRef = useRef<string | null>(null);
  const lastKnownSecRef = useRef(0);
  const lastMountedVideoRef = useRef<string | null>(null);
  const stateRef = useRef(playbackState);
  stateRef.current = playbackState;
  const [playerReady, setPlayerReady] = useState(false);
  const [pageHidden, setPageHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden
  );
  const [internalVolume, setInternalVolume] = useState(() =>
    showLocalControls ? getMapListenVolume() : getSalonYoutubeVolume()
  );
  const [internalMuted, setInternalMuted] = useState(false);
  const salonVolumeControlled = salonVolume !== undefined;
  const volume = salonVolumeControlled ? salonVolume : internalVolume;
  const muted = salonVolumeControlled ? (salonMuted ?? false) : internalMuted;
  const [localPaused, setLocalPaused] = useState(false);
  const [embedErrorCode, setEmbedErrorCode] = useState<number | null>(null);
  const embedError = embedErrorCode !== null;
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  volumeRef.current = volume;
  mutedRef.current = muted;

  // Participants are always force-synced with the host; only the host may locally pause.
  const respectLocalPause = _isHost && localPaused;
  /** YouTube interdit la lecture audio sans lecteur visible (hors démo msdev). */
  const strictCompliance = isYoutubeStrictCompliance();
  const videoPlaybackAllowed = showVideo || !strictCompliance;
  const effectiveAutoplayAllowed = autoplayAllowed && videoPlaybackAllowed;
  const playbackActiveRef = useRef(playbackActive);
  playbackActiveRef.current = playbackActive;
  const autoplayAllowedRef = useRef(effectiveAutoplayAllowed);
  autoplayAllowedRef.current = effectiveAutoplayAllowed;
  const onHostProgressReportRef = useRef(onHostProgressReport);
  onHostProgressReportRef.current = onHostProgressReport;
  const onHostLocalPauseRef = useRef(onHostLocalPause);
  onHostLocalPauseRef.current = onHostLocalPause;
  const onHostLocalPlayRef = useRef(onHostLocalPlay);
  onHostLocalPlayRef.current = onHostLocalPlay;
  const isHostRef = useRef(_isHost);
  isHostRef.current = _isHost;
  const onVideoEndRef = useRef(onVideoEnd);
  onVideoEndRef.current = onVideoEnd;
  const onEmbedErrorRef = useRef(onEmbedError);
  onEmbedErrorRef.current = onEmbedError;
  const onIsLiveChangeRef = useRef(onIsLiveChange);
  onIsLiveChangeRef.current = onIsLiveChange;
  const isLiveRef = useRef(false);
  const lastLiveSeekTriggerRef = useRef<number | undefined>(undefined);
  const onMapInlineListenCapReachedRef = useRef(onMapInlineListenCapReached);
  onMapInlineListenCapReachedRef.current = onMapInlineListenCapReached;
  const mapInlineListenCapReachedRef = useRef(false);
  const mapInlineListenCapMsRef = useRef(mapInlineListenCapMs);
  mapInlineListenCapMsRef.current = mapInlineListenCapMs;
  const mapInlineListenSessionKeyRef = useRef(mapInlineListenSessionKey);
  mapInlineListenSessionKeyRef.current = mapInlineListenSessionKey;
  const playbackClockKeyRef = useRef(
    `${playbackState.trackId}|${playbackState.updatedAt}|${playbackState.isPlaying}`
  );
  const lastSeekAtRef = useRef(0);
  const lastParticipantSyncTriggerRef = useRef<number | undefined>(undefined);

  const floatActive = Boolean(videoFloat);
  const pauseAndMutePlayer = useCallback((player: YTPlayerInstance) => {
    try {
      player.pauseVideo();
      player.mute();
    } catch {
      /* ignore */
    }
  }, []);

  const applyVolume = useCallback((player: YTPlayerInstance, vol: number, isMuted: boolean) => {
    try {
      const silent = isMuted || vol <= 0;
      if (silent) {
        player.mute();
        player.setVolume(0);
      } else {
        player.unMute();
        player.setVolume(Math.min(100, Math.max(0, vol)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const mayDrivePlayback = useCallback(() => {
    if (!playbackActiveRef.current) return false;
    if (mapInlineListenCapReachedRef.current) return false;
    const owner = getAppMediaOwner();
    return owner === null || owner === 'salon';
  }, []);

  useEffect(() => {
    mapInlineListenCapReachedRef.current = false;
  }, [mapInlineListenSessionKey]);

  const mayAutoplay = useCallback(() => {
    return mayDrivePlayback() && autoplayAllowedRef.current && videoPlaybackAllowed;
  }, [mayDrivePlayback, videoPlaybackAllowed]);

  const rememberPlaybackSec = useCallback((sec: number) => {
    if (sec > 0.5) {
      lastKnownSecRef.current = Math.max(lastKnownSecRef.current, sec);
    }
  }, []);

  const seekPlayerTo = useCallback((player: YTPlayerInstance, targetSec: number, force = false) => {
    if (!force && Date.now() - lastSeekAtRef.current < SEEK_COOLDOWN_MS) return;
    try {
      player.seekTo(targetSec, true);
      lastSeekAtRef.current = Date.now();
    } catch {
      /* ignore */
    }
  }, []);

  const detectLiveStream = useCallback((player: YTPlayerInstance): boolean => {
    try {
      const videoData = player.getVideoData?.();
      if (typeof videoData?.isLive === 'boolean') return videoData.isLive;
      return player.getDuration() === Infinity;
    } catch {
      return false;
    }
  }, []);

  const notifyIsLive = useCallback((isLive: boolean) => {
    if (isLive === isLiveRef.current) return;
    isLiveRef.current = isLive;
    onIsLiveChangeRef.current?.(isLive);
  }, []);

  const syncPlayerSize = useCallback(() => {
    const player = playerRef.current;
    const el = sizeRef.current;
    if (!player || !el) return;
    const w = Math.round(el.clientWidth);
    const h = Math.round(el.clientHeight);
    if (w < 1 || h < 1) return;
    try {
      player.setSize(w, h);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!playerReady) return;
    const el = sizeRef.current;
    if (!el) return;
    syncPlayerSize();
    const ro = new ResizeObserver(() => syncPlayerSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [playerReady, fillContainer, showVideo, floatActive, syncPlayerSize]);

  useEffect(() => {
    if (!playbackActive) {
      releaseAppMediaFocus('salon');
      return;
    }
    return () => releaseAppMediaFocus('salon');
  }, [playbackActive]);

  useEffect(() => {
    return subscribeAppMediaFocus((owner) => {
      const player = playerRef.current;
      if (!player || !playerReady) return;
      if (owner === 'reels' || owner === 'live') {
        pauseAndMutePlayer(player);
      } else if (playbackActiveRef.current && (owner === 'salon' || owner === null)) {
        if (autoplayAllowedRef.current) {
          applyVolume(player, volumeRef.current, mutedRef.current);
          applySync(player, stateRef.current, false, respectLocalPause);
        } else {
          applySilentPositionSync(player, stateRef.current, false);
        }
      }
    });
  }, [playerReady, respectLocalPause, pauseAndMutePlayer, applyVolume]);

  useBackgroundPlayback(
    {
      title: playbackState.title,
      artist: playbackState.artist,
      artworkUrl: playbackState.albumArtUrl,
    },
    playerReady && playbackActive && videoPlaybackAllowed,
    playbackState.isPlaying && !respectLocalPause && mayAutoplay()
  );

  useEffect(() => {
    if (!playerReady) return;
    const player = playerRef.current;
    if (!player) return;
    setMediaSessionHandlers({
      play: () => {
        try {
          if (_isHost) setLocalPaused(false);
          applySync(player, stateRef.current, true, false);
          player.playVideo();
        } catch {
          /* ignore */
        }
      },
      pause: () => {
        try {
          if (_isHost) {
            setLocalPaused(true);
            player.pauseVideo();
            if (stateRef.current.isPlaying) onHostLocalPauseRef.current?.();
          } else {
            // Participant: hardware pause key is ignored — re-sync with host state.
            if (playbackActiveRef.current) {
              applySync(player, stateRef.current, false, false, true);
            }
          }
        } catch {
          /* ignore */
        }
      },
    });
    return () => setMediaSessionHandlers(null);
  }, [playerReady, videoId, showLocalControls, _isHost]);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden;
      setPageHidden(hidden);
      const player = playerRef.current;
      if (!player || !playerReady || respectLocalPause || !playbackActiveRef.current) return;
      if (!mayDrivePlayback()) return;
      if (hidden && strictCompliance) {
        try {
          player.pauseVideo();
        } catch {
          /* ignore */
        }
        return;
      }
      if (stateRef.current.isPlaying && mayAutoplay()) {
        try {
          requestAppMediaFocus('salon');
          player.playVideo();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playerReady, respectLocalPause, mayDrivePlayback, mayAutoplay, strictCompliance]);

  useEffect(() => {
    if (!apiReady || !containerRef.current || !isValidYoutubeVideoId(videoId)) return;

    let destroyed = false;
    setPlayerReady(false);
    loadedVideoRef.current = null;
    const container = containerRef.current;

    if (lastMountedVideoRef.current !== videoId) {
      lastKnownSecRef.current = 0;
    }
    const computedSec = computePlaybackPositionMs(playbackState) / 1000;
    const resumeSec =
      lastMountedVideoRef.current === videoId ? Math.max(computedSec, lastKnownSecRef.current) : computedSec;
    const startSec = Math.floor(resumeSec);
    lastMountedVideoRef.current = videoId;

    setEmbedErrorCode(null);
    const sizeEl = sizeRef.current;
    const initialW = Math.max(1, Math.round(sizeEl?.clientWidth ?? 640));
    const initialH = Math.max(1, Math.round(sizeEl?.clientHeight ?? 360));
    new window.YT!.Player(container, {
      videoId,
      width: initialW,
      height: initialH,
      playerVars: {
        enablejsapi: 1,
        rel: 0,
        playsinline: 1,
        controls: 0,
        start: startSec,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        modestbranding: 1,
      },
      events: {
        onReady: (e: { target: YTPlayerInstance }) => {
          if (destroyed) return;
          playerRef.current = e.target;
          loadedVideoRef.current = videoId;
          setPlayerReady(true);
          syncPlayerSize();
          // Detect live stream status as soon as the player is ready.
          notifyIsLive(detectLiveStream(e.target));
          const allowPlay =
            playbackActiveRef.current &&
            autoplayAllowedRef.current &&
            getAppMediaOwner() !== 'reels' &&
            getAppMediaOwner() !== 'live';
          applyVolume(e.target, volumeRef.current, mutedRef.current);
          rememberPlaybackSec(resumeSec);
          if (allowPlay) {
            applySync(e.target, playbackState, true, respectLocalPause, true);
          } else if (playbackActiveRef.current) {
            applySilentPositionSync(e.target, playbackState, true);
          }
          if (allowPlay && playbackState.isPlaying && !respectLocalPause) {
            try {
              requestAppMediaFocus('salon');
              e.target.playVideo();
            } catch {
              /* ignore */
            }
          }
        },
        onStateChange: (e: { data: number; target: YTPlayerInstance }) => {
          if (e.data === YT_ENDED) {
            onVideoEndRef.current?.();
            return;
          }
          if (e.data === YT_PLAYING) {
            // Re-check live status once playback starts (getVideoData may populate late).
            notifyIsLive(detectLiveStream(e.target));
          }
          if (isHostRef.current) {
            if (e.data === YT_PAUSED && stateRef.current.isPlaying) {
              setLocalPaused(true);
              onHostLocalPauseRef.current?.();
            } else if (e.data === YT_PLAYING && !stateRef.current.isPlaying) {
              setLocalPaused(false);
              onHostLocalPlayRef.current?.();
            }
          }
          if (e.data !== YT_PLAYING) return;
          try {
            applyVolume(e.target, volumeRef.current, mutedRef.current);
          } catch {
            /* ignore */
          }
        },
        onError: (e: { data: number }) => {
          if (e.data === 100 || e.data === 101 || e.data === 150 || e.data === 2) {
            setEmbedErrorCode(e.data);
          }
          // onEmbedError only fires for embedding-restriction errors (101 / 150),
          // not for "video unavailable" (100) or bad params (2).
          if (e.data === 101 || e.data === 150) {
            onEmbedErrorRef.current?.();
          }
        },
      },
    });

    return () => {
      destroyed = true;
      setPlayerReady(false);
      // Reset live state when the video is unmounted/changed.
      notifyIsLive(false);
      try {
        const p = playerRef.current;
        if (p) {
          lastKnownSecRef.current = Math.max(lastKnownSecRef.current, p.getCurrentTime());
        }
        p?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      loadedVideoRef.current = null;
      if (container) {
        container.innerHTML = '';
      }
    };
    // Recreate when video changes or mount moves (PiP portal ↔ inline).
  }, [
    apiReady,
    videoId,
    floatActive,
    applyVolume,
    detectLiveStream,
    notifyIsLive,
    playbackState,
    rememberPlaybackSec,
    respectLocalPause,
    syncPlayerSize,
  ]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady) return;
    if (!playbackActive || !mayDrivePlayback()) {
      pauseAndMutePlayer(player);
      return;
    }
    applyVolume(player, volume, muted);
  }, [playerReady, volume, muted, applyVolume, playbackActive, mayDrivePlayback, pauseAndMutePlayer]);

  useEffect(() => {
    if (!participantSyncTrigger) return;
    if (lastParticipantSyncTriggerRef.current === participantSyncTrigger) return;
    lastParticipantSyncTriggerRef.current = participantSyncTrigger;

    const player = playerRef.current;
    if (!player || !playerReady || loadedVideoRef.current !== videoId) return;
    if (!playbackActive || !mayDrivePlayback()) return;

    const state = stateRef.current;
    if (!effectiveAutoplayAllowed) {
      applySilentPositionSync(player, state, true);
    } else {
      applyVolume(player, volume, muted);
      applySync(player, state, true, false, true);
    }
    lastSeekAtRef.current = Date.now();
  }, [
    participantSyncTrigger,
    playerReady,
    videoId,
    playbackActive,
    effectiveAutoplayAllowed,
    mayDrivePlayback,
    applyVolume,
    volume,
    muted,
  ]);

  useEffect(() => {
    if (!liveSeekTrigger) return;
    if (lastLiveSeekTriggerRef.current === liveSeekTrigger) return;
    lastLiveSeekTriggerRef.current = liveSeekTrigger;
    const player = playerRef.current;
    if (!player || !playerReady || !isLiveRef.current) return;
    try {
      // Seek to live edge: Infinity is handled by the YouTube IFrame API for live streams.
      player.seekTo(Infinity, true);
    } catch {
      /* ignore */
    }
  }, [liveSeekTrigger, playerReady]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady || loadedVideoRef.current !== videoId) return;
    if (!playbackActive || !mayDrivePlayback()) {
      pauseAndMutePlayer(player);
      return;
    }
    const clockKey = `${playbackState.trackId}|${playbackState.updatedAt}|${playbackState.isPlaying}`;
    const forceSeek =
      !onHostProgressReportRef.current && playbackClockKeyRef.current !== clockKey;
    playbackClockKeyRef.current = clockKey;
    rememberPlaybackSec(computePlaybackPositionMs(playbackState) / 1000);
    if (!effectiveAutoplayAllowed) {
      applySilentPositionSync(player, playbackState, forceSeek);
      if (forceSeek) lastSeekAtRef.current = Date.now();
      return;
    }
    applySync(player, playbackState, forceSeek, respectLocalPause, true);
    if (forceSeek) lastSeekAtRef.current = Date.now();
  }, [
    playbackState,
    playerReady,
    videoId,
    respectLocalPause,
    playbackActive,
    effectiveAutoplayAllowed,
    mayDrivePlayback,
    pauseAndMutePlayer,
    rememberPlaybackSec,
  ]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady) return;
    if (!playbackActive || !mayDrivePlayback()) {
      pauseAndMutePlayer(player);
      return;
    }
    if (!effectiveAutoplayAllowed) {
      applySilentPositionSync(player, playbackState, true);
      lastSeekAtRef.current = Date.now();
      return;
    }
    // Transition silencieux → audible : restaurer le volume avant de lancer la lecture.
    // applySilentPositionSync appelle player.mute() ; applySync seul ne démute pas.
    // Use refs (not the reactive values) so that volume-slider drags do NOT retrigger
    // this effect — which calls applySync(forceSeek=true) and would seekTo on every frame.
    applyVolume(player, volumeRef.current, mutedRef.current);
    applySync(player, playbackState, true, respectLocalPause, true);
    lastSeekAtRef.current = Date.now();
  }, [
    effectiveAutoplayAllowed,
    playbackActive,
    playerReady,
    playbackState,
    mayDrivePlayback,
    respectLocalPause,
    applyVolume,
    pauseAndMutePlayer,
  ]);

  useEffect(() => {
    if (!playerReady || !playbackActive || respectLocalPause) return;
    const player = playerRef.current;
    if (!player) return;

    const tick = () => {
      const capMs = mapInlineListenCapMsRef.current;
      const sessionKey = mapInlineListenSessionKeyRef.current;
      if (
        capMs != null &&
        capMs > 0 &&
        sessionKey &&
        !mapInlineListenCapReachedRef.current
      ) {
        if (getMapInlineListenElapsedMs(sessionKey) >= capMs) {
          mapInlineListenCapReachedRef.current = true;
          pauseAndMutePlayer(player);
          onMapInlineListenCapReachedRef.current?.();
          return;
        }
      }
      if (!playbackActiveRef.current || !mayDrivePlayback()) {
        pauseAndMutePlayer(player);
        return;
      }
      const targetSec = computePlaybackPositionMs(stateRef.current) / 1000;
      try {
        rememberPlaybackSec(targetSec);
        const playerState = player.getPlayerState();
        if (playerState === YT_BUFFERING) return;
        const current = player.getCurrentTime();
        if (!autoplayAllowedRef.current) {
          if (Math.abs(current - targetSec) > DRIFT_SEC) {
            seekPlayerTo(player, targetSec);
          }
          if (playerState !== YT_PAUSED) player.pauseVideo();
          player.mute();
          return;
        }
        if (Math.abs(current - targetSec) > DRIFT_SEC) {
          seekPlayerTo(player, targetSec);
        }
        if (stateRef.current.isPlaying && playerState !== YT_PLAYING) {
          requestAppMediaFocus('salon');
          player.playVideo();
        } else if (!stateRef.current.isPlaying && playerState === YT_PLAYING) {
          player.pauseVideo();
        }
      } catch {
        /* ignore */
      }
    };

    tick();
    const intervalMs = pageHidden ? 600 : 1200;
    const id = window.setInterval(tick, intervalMs);

    return () => window.clearInterval(id);
  }, [
    playerReady,
    playbackActive,
    playbackState.isPlaying,
    playbackState.updatedAt,
    playbackState.trackId,
    pageHidden,
    respectLocalPause,
    mayAutoplay,
    mayDrivePlayback,
    pauseAndMutePlayer,
    rememberPlaybackSec,
    seekPlayerTo,
  ]);

  useEffect(() => {
    if (!onHostProgressReportRef.current || !playerReady || !playbackActive) return;
    const player = playerRef.current;
    if (!player) return;

    const report = () => {
      if (!onHostProgressReportRef.current || !stateRef.current.isPlaying) return;
      if (!mayAutoplay()) return;
      try {
        if (player.getPlayerState() !== YT_PLAYING) return;
        const ms = Math.floor(player.getCurrentTime() * 1000);
        const expected = computePlaybackPositionMs(stateRef.current);
        // N’avance l’horloge partagée que si le lecteur est en avance (évite reset ~1 s).
        if (ms >= 0 && ms > expected + HOST_PROGRESS_LEAD_MS) {
          onHostProgressReportRef.current(ms);
        }
      } catch {
        /* ignore */
      }
    };

    report();
    const id = window.setInterval(report, pageHidden ? 5000 : 4000);
    return () => window.clearInterval(id);
  }, [
    playerReady,
    playbackActive,
    playbackState.isPlaying,
    playbackState.trackId,
    pageHidden,
    mayAutoplay,
  ]);

  const toggleLocalPlay = () => {
    // Participants cannot pause locally — they are always synced with the host.
    if (!_isHost) return;
    const player = playerRef.current;
    if (!player) return;
    if (localPaused) {
      setLocalPaused(false);
      if (!playbackState.isPlaying) onHostLocalPlayRef.current?.();
      applySync(player, playbackState, true, false);
      try {
        player.playVideo();
      } catch {
        /* ignore */
      }
    } else {
      setLocalPaused(true);
      try {
        player.pauseVideo();
      } catch {
        /* ignore */
      }
      if (playbackState.isPlaying) onHostLocalPauseRef.current?.();
    }
  };

  const toggleMute = () => {
    if (salonVolumeControlled) return;
    const player = playerRef.current;
    if (!player) return;
    const next = !muted;
    setInternalMuted(next);
    applyVolume(player, volume, next);
  };

  const applyYtRate = (targetRate: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setPlaybackRate(targetRate);
    } catch {
      /* ignore */
    }
  };

  const holdAccelerate = useHoldToAccelerate({
    enabled: playerReady && showVideo && !strictCompliance,
    onApplyRate: applyYtRate,
    getSavedRate: () => {
      try {
        return playerRef.current?.getPlaybackRate() ?? 1;
      } catch {
        return 1;
      }
    },
  });

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el || !holdAccelerate.accelerating) return;
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, [holdAccelerate.accelerating]);

  const hidden = !showVideo;
  const positionMs = computePlaybackPositionMs(playbackState);

  const dockLocalControlsInFill = fillContainer && showLocalControls;

  const outerClass = dockLocalControlsInFill
    ? ['relative flex flex-col h-full min-h-0 w-full', className].filter(Boolean).join(' ')
    : fillContainer
      ? ['h-full w-full', className].filter(Boolean).join(' ')
      : (className ?? '');

  const playerSurfaceClass = floatActive
    ? 'salon-video-pip salon-youtube-player salon-youtube-player--pip-float'
    : fillContainer
      ? `salon-youtube-player salon-youtube-player--fill${
          hidden ? ' invisible pointer-events-none' : ''
        }`
      : 'salon-youtube-player relative w-full aspect-video overflow-hidden rounded-xl border border-[#1e1e2f] bg-black';

  const playerStageClass = floatActive
    ? 'salon-youtube-player__stage salon-youtube-player__stage--pip-float'
    : fillContainer
      ? 'salon-youtube-player__stage'
      : 'salon-youtube-player__stage salon-youtube-player__stage--inline absolute inset-0';

  const playerSurfaceStyle: React.CSSProperties | undefined = floatActive && videoFloat
    ? {
        left: videoFloat.position.x,
        top: videoFloat.position.y,
        width: VIDEO_PIP_WIDTH,
      }
    : undefined;

  const playerSurface = (
    <div
      className={
        hidden && !fillContainer && !floatActive
          ? 'fixed w-px h-px opacity-0 overflow-hidden pointer-events-none -z-10'
          : playerSurfaceClass
      }
      style={playerSurfaceStyle}
      aria-hidden={hidden && !floatActive}
      {...(showVideo && !hidden ? holdAccelerate.handlers : {})}
    >
      {floatActive && videoFloat ? (
        <div
          className="salon-video-pip__header shrink-0 flex items-center gap-1.5 px-2 border-b border-[#2a2a36] bg-[#14141c]/95 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ height: VIDEO_PIP_HEADER_HEIGHT }}
          onPointerDown={videoFloat.onHeaderPointerDown}
        >
          <span className="text-[10px] text-purple-400/80 leading-none shrink-0" aria-hidden>
            ⠿
          </span>
          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
            {videoFloatTitle}
          </p>
          {onLeaveSalon ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onLeaveSalon}
              className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold text-red-300 hover:text-white hover:bg-red-600/30 transition"
              title={t('salon.leaveSalon')}
              aria-label={t('salon.leaveSalon')}
            >
              {t('salon.leaveSalonPip', { defaultValue: 'Quitter' })}
            </button>
          ) : null}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={videoFloat.onClose}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
            title={onLeaveSalon ? t('salon.restoreSalonPip', { defaultValue: 'Rouvrir le salon' }) : t('salon.anchorVideoPip', { defaultValue: 'Ancrer la vidéo' })}
            aria-label={onLeaveSalon ? t('salon.restoreSalonPip', { defaultValue: 'Rouvrir le salon' }) : t('salon.anchorVideoPip', { defaultValue: 'Ancrer la vidéo' })}
          >
            ↙
          </button>
        </div>
      ) : null}
      <div ref={sizeRef} className={playerStageClass}>
        <div className="salon-youtube-player__mount">
          <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        </div>
        <AccelerateBadge visible={holdAccelerate.accelerating && showVideo && !hidden} rate={HOLD_ACCELERATE_RATE} />
        {consentBlocked && showVideo && !hidden && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 px-4 text-center">
            <PoweredByYouTube />
            <p className="text-xs text-gray-300 leading-relaxed max-w-xs">
              {t(
                'salon.youtubeConsent.body',
                'Le lecteur YouTube nécessite votre accord aux cookies tiers. Acceptez-les pour écouter dans Soundy.'
              )}
            </p>
            <button
              type="button"
              onClick={() => setCookieConsent('all')}
              className="min-h-[44px] px-4 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500"
            >
              {t('salon.youtubeConsent.accept', 'Activer YouTube')}
            </button>
          </div>
        )}
        {!consentBlocked && !apiReady && showVideo && !hidden && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-gray-400 bg-black/80">
            <PoweredByYouTube />
            <span>{t('salon.youtubeConsent.loading', 'Chargement du lecteur…')}</span>
          </div>
        )}
        {embedErrorCode !== null && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black text-center px-3">
            {embedErrorCode === 100 || embedErrorCode === 2 ? (
              <>
                <span className="text-2xl" aria-hidden>🔒</span>
                <p className="text-xs text-gray-300">Vidéo introuvable ou privée</p>
              </>
            ) : (
              <>
                <span className="text-2xl" aria-hidden>⚠️</span>
                <p className="text-xs text-gray-300">Lecture impossible ici</p>
                <OpenOnYoutubeButton
                  trackId={videoId}
                  positionMs={positionMs}
                  variant="youtube-red"
                  label="Ouvrir sur YouTube →"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const playerChrome = dockLocalControlsInFill ? (
    <div className="relative flex-1 min-h-0 w-full">{playerSurface}</div>
  ) : (
    playerSurface
  );

  const controlBtnClass = minimalLocalControls
    ? 'px-2.5 py-1 rounded-full border border-white/10 bg-[#131318] text-xs font-medium text-[#8b8baf] hover:bg-white/5 hover:text-white transition'
    : 'px-2 py-1 rounded-lg border border-[#2a2a3a] text-xs text-gray-200 hover:border-purple-500/40 transition';
  const muteBtnClass = minimalLocalControls
    ? controlBtnClass
    : 'px-2 py-1 rounded-lg border border-[#2a2a3a] text-xs text-gray-400 hover:text-white transition';
  const volumeSliderClass = minimalLocalControls
    ? `flex-1 min-w-[72px] ${dockLocalControlsInFill ? 'max-w-none' : 'max-w-[140px]'} accent-[#6b6b9f] h-1`
    : 'flex-1 min-w-[72px] max-w-[140px] accent-purple-500 h-1';

  const trailingControls =
    showYoutubeLinkInControls || controlsTrailing ? (
      <div
        className={`flex items-center gap-1.5 shrink-0 ${minimalLocalControls ? 'ml-auto' : ''}`}
      >
        {showYoutubeLinkInControls && (
          <OpenOnYoutubeButton
            trackId={videoId}
            positionMs={positionMs}
            variant={youtubeLinkVariant}
            className={youtubeLinkClassName}
          />
        )}
        {controlsTrailing}
      </div>
    ) : null;

  const localControlsRow = showLocalControls && playerReady && (
    <div
      className={
        dockLocalControlsInFill
          ? 'shrink-0 z-30 flex flex-col gap-2 w-full px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/98 to-[#0b0b0f]/85 border-t border-white/10 pointer-events-auto'
          : `flex flex-col gap-2 w-full ${minimalLocalControls ? 'mt-0' : 'mt-2'}`
      }
    >
      <div className="flex flex-wrap items-center gap-2 w-full">
        {controlsLeading}
        {controlsPlayOverride ??
          (showLocalPause ? (
            <button
              type="button"
              onClick={toggleLocalPlay}
              className={controlBtnClass}
              aria-label={localPaused ? 'Lecture' : 'Pause'}
            >
              {localPaused ? 'Lecture' : 'Pause'}
            </button>
          ) : null)}
        <button
          type="button"
          onClick={toggleMute}
          className={muteBtnClass}
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? 'Muet' : 'Son'}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = setMapListenVolume(Number(e.target.value));
            setInternalVolume(v);
            if (v > 0) setInternalMuted(false);
            const player = playerRef.current;
            if (player) applyVolume(player, v, v === 0);
          }}
          className={volumeSliderClass}
          aria-label="Volume"
        />
        {trailingControls}
      </div>
      {controlsFooter}
    </div>
  );

  const shouldPortalFloat =
    floatActive && videoFloat && typeof document !== 'undefined';

  /** PiP porté sur body : l’ancre in-tree reste cachée (pas absolute inset-0 qui peut bloquer les touches). */
  const rootClass = floatActive
    ? shouldPortalFloat
      ? 'hidden'
      : 'absolute inset-0 w-full h-full pointer-events-none'
    : outerClass || undefined;

  /** Hors `.salon-page-pip-host` (opacity:0) pour rester visible en salon minimisé. */
  const floatedPlayer = shouldPortalFloat
    ? createPortal(
        <div className="pointer-events-auto">{playerSurface}</div>,
        document.body
      )
    : null;

  return (
    <div className={rootClass}>
      {floatedPlayer ?? (
        <div className={floatActive ? 'pointer-events-auto' : undefined}>{playerChrome}</div>
      )}
      {hidden && (embedErrorCode === 101 || embedErrorCode === 150) && (
        <div className="rounded-xl border border-[#2a2a3a] bg-[#101018]/90 p-3 mt-2 flex flex-col items-center gap-2">
          <p className="text-[11px] text-gray-400">Cette vidéo ne peut pas être lue ici.</p>
          <OpenOnYoutubeButton
            trackId={videoId}
            positionMs={positionMs}
            variant="youtube-red"
            label="Ouvrir sur YouTube"
          />
        </div>
      )}
      {showLocalControls && !playerReady && !embedError && showYoutubeLinkInControls && videoId !== 'demo' && (
        <div className={`flex justify-end ${minimalLocalControls ? 'mt-1' : 'mt-2'}`}>
          <OpenOnYoutubeButton
            trackId={videoId}
            positionMs={positionMs}
            variant={youtubeLinkVariant}
            className={youtubeLinkClassName}
          />
        </div>
      )}
      {localControlsRow}
      {!showLocalControls && showYoutubeLinkInControls && (
        <div className="flex flex-col items-center gap-1 mt-1.5">
          <OpenOnYoutubeButton trackId={videoId} positionMs={positionMs} />
          <PoweredByYouTube compact />
        </div>
      )}
    </div>
  );
}
