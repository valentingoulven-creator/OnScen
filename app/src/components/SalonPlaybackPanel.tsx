import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSalonPlaybackSync } from '../hooks/useSalonPlaybackSync';
import {
  buildTrackUrlAtPosition,
  formatPlaybackTime,
  preferredParticipantPlatform,
  type MusicPlatform,
} from '../lib/salonPlayback';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { SalonYouTubePlayer } from './SalonYouTubePlayer';
import { SalonYouTubeSearch } from './SalonYouTubeSearch';
import { SalonYouTubePlaylist } from './SalonYouTubePlaylist';
import { SalonQueueSection } from './SalonQueueSection';
import { SalonProposalsSection } from './SalonProposalsSection';
import { isPlatformConnected } from '../lib/platformConnect';
import { getSalonShowYoutubeVideo, setSalonShowYoutubeVideo } from '../lib/salonYoutubeDisplay';
import { isYoutubeStrictCompliance } from '../lib/youtubeCompliance';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import { PlatformConnectCard } from './PlatformConnectCard';
import { SpotifyJamJoinCard, SpotifyJamLinkField } from './SpotifyJamLinkField';
import { normalizeSpotifyJamUrl } from '../lib/spotifyJam';
import type { User } from '../types';
import type { PlaybackState, ResolvedSalonTrack, Salon, SalonQueueItem, SalonTrackProposal } from '../types';

interface SalonPlaybackPanelProps {
  salon: Salon;
  token: string | null;
  isHost: boolean;
  userPlatforms?: MusicPlatform[];
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
  onAcceptProposal?: (proposalId: string, playNow: boolean) => Promise<void>;
  onRejectProposal?: (proposalId: string) => Promise<void>;
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
  /** false = coupe le lecteur (onglet carte masqué, autre audio actif). */
  playbackActive?: boolean;
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
  userPlatforms,
  onUserUpdated,
  onPlaybackStateChange,
  onQueueChange,
  hostCanControl = false,
  queue = [],
  proposals = [],
  loadingProposals,
  skipping,
  onSkip,
  onPlayQueueItem,
  onAcceptProposal,
  onRejectProposal,
  onProposeTrack,
  mapInline = false,
  theaterMode = false,
  playbackActive = true,
}: SalonPlaybackPanelProps) {
  const hostLinked = isHost && isPlatformConnected(userPlatforms, salon.platform);

  const [participantPlatform, setParticipantPlatform] = useState<MusicPlatform>(() =>
    preferredParticipantPlatform(userPlatforms, salon.platform)
  );
  const [resolved, setResolved] = useState<ResolvedSalonTrack | null>(null);
  const [resolving, setResolving] = useState(false);

  const [showYoutubeVideo, setShowYoutubeVideo] = useState<boolean>(() => {
    if (mapInline) return salon.playbackState.showVideo ?? (salon.platform === 'youtube');
    return salon.playbackState.showVideo ?? (salon.platform === 'youtube' ? true : getSalonShowYoutubeVideo());
  });
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
    emitPatch,
    reportHostProgress,
  } = useSalonPlaybackSync({
      salonId: salon.id,
      isHost: hostLinked,
      initialState: salon.playbackState,
      onStateChange: onPlaybackStateChange,
    });

  useEffect(() => {
    if (playbackState.showVideo === undefined) return;
    if (playbackState.showVideo === hostShowVideoRef.current) return;
    hostShowVideoRef.current = playbackState.showVideo;
    setShowYoutubeVideo(playbackState.showVideo);
    setSalonShowYoutubeVideo(playbackState.showVideo);
  }, [playbackState.showVideo]);

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
  }, [
    salon.platform,
    playbackState.trackId,
    playbackState.showVideo,
    isHost,
    hostLinked,
    emitPatch,
  ]);

  const prevPlayingRef = useRef(playbackState.isPlaying);
  const prevTrackIdRef = useRef(playbackState.trackId);
  const [spotifyNotif, setSpotifyNotif] = useState<string | null>(null);
  const [hostJamDraft, setHostJamDraft] = useState(salon.spotifyJamUrl ?? '');
  const [editingHostJam, setEditingHostJam] = useState(false);
  const [savingJam, setSavingJam] = useState(false);
  const [jamToast, setJamToast] = useState<string | null>(null);

  useEffect(() => {
    setHostJamDraft(salon.spotifyJamUrl ?? '');
    if (salon.spotifyJamUrl) setEditingHostJam(false);
  }, [salon.spotifyJamUrl]);

  useEffect(() => {
    if (!jamToast) return;
    const t = window.setTimeout(() => setJamToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [jamToast]);

  const saveHostJamLink = async () => {
    if (!token || !isHost) return;
    const trimmed = hostJamDraft.trim();
    if (trimmed && !normalizeSpotifyJamUrl(trimmed)) {
      setJamToast('Lien Jam invalide');
      return;
    }
    setSavingJam(true);
    try {
      const { salon: updated } = await api.updateSalonSettings(token, salon.id, {
        spotifyJamUrl: trimmed ? normalizeSpotifyJamUrl(trimmed) : '',
      });
      setHostJamDraft(updated.spotifyJamUrl ?? '');
      setEditingHostJam(false);
      setJamToast(trimmed ? 'Lien Jam enregistré' : 'Lien Jam retiré');
    } catch (e) {
      setJamToast(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSavingJam(false);
    }
  };
  useEffect(() => {
    if (isHost || salon.platform !== 'spotify') return;
    if (playbackState.isPlaying !== prevPlayingRef.current) {
      prevPlayingRef.current = playbackState.isPlaying;
      setSpotifyNotif(playbackState.isPlaying ? "\u25B6 L\u2019h\u00F4te a repris la lecture \u2014 lancez Spotify" : "\u23F8 L\u2019h\u00F4te a mis en pause \u2014 pausez dans Spotify");
      const t = window.setTimeout(() => setSpotifyNotif(null), 5000);
      return () => window.clearTimeout(t);
    }
  }, [isHost, salon.platform, playbackState.isPlaying]);

  useEffect(() => {
    if (isHost || salon.platform !== 'spotify') return;
    if (playbackState.trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = playbackState.trackId;
      setSpotifyNotif(`\uD83C\uDFB5 L\u2019h\u00F4te a chang\u00E9 : \u00AB ${playbackState.title} \u00BB`);
      const t = window.setTimeout(() => setSpotifyNotif(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [isHost, salon.platform, playbackState.trackId, playbackState.title]);

  useEffect(() => {
    setParticipantPlatform(preferredParticipantPlatform(userPlatforms, salon.platform));
  }, [salon.platform, userPlatforms]);

  useEffect(() => {
    if (!token || isHost) return;
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
  }, [
    token,
    salon.id,
    participantPlatform,
    isHost,
    playbackState.title,
    playbackState.artist,
    playbackState.trackId,
    playbackState.updatedAt,
  ]);

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

  // Pour un salon YouTube : lecteur disponible immédiatement (trackId connu sans résolution async).
  // Pour un salon Spotify : lecteur YouTube uniquement si le participant a choisi YouTube et que
  // la résolution (resolveSalonTrack) a renvoyé un trackId.
  const youtubeTrackId =
    salon.platform === 'youtube'
      ? isHost
        ? playbackState.trackId
        : (resolved?.trackId ?? playbackState.trackId)
      : participantPlatform === 'youtube'
        ? resolved?.trackId
        : undefined;

  const canUseYoutubeEmbed =
    Boolean(youtubeTrackId && youtubeTrackId !== 'demo') &&
    (salon.platform === 'youtube' ||
      (isHost ? !hostLinked && participantPlatform === 'youtube' : participantPlatform === 'youtube'));

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
      if (isHost) {
        emitPatch({ showVideo: next });
      }
      return next;
    });
  };

  /** Déclenché par SalonYouTubePlayer quand la vidéo se termine → skip auto si file non vide. */
  const handleVideoEnd = useCallback(() => {
    if (!isHost || !hostCanControl || !onSkip) return;
    if (queue.length > 0) onSkip();
  }, [isHost, hostCanControl, onSkip, queue.length]);

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

  const showHostQueue = !mapInline && !theaterMode && isHost && hostCanControl;
  const showParticipantProposals = !mapInline && !theaterMode && !isHost && salon.allowQueue;

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

  const playbackStatusBadge = (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
        isPlaying ? 'text-green-400 border-green-500/25 bg-green-500/10' : 'text-gray-500 border-white/15'
      }`}
    >
      {isPlaying ? 'Lecture' : 'Pause'}
    </span>
  );

  const hostControlBar = (
    <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
      <p className="text-lg font-mono tabular-nums text-white shrink-0">
        {formatPlaybackTime(displayPositionMs)}
      </p>
      {isHost && hostLinked && (
        <>
          <button
            type="button"
            onClick={isPlaying ? pause : play}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition"
          >
            {isPlaying ? 'Pause' : 'Lecture'}
          </button>
          <button
            type="button"
            onClick={() => {
              pause();
              seek(0);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-white/20 text-xs text-gray-300 hover:text-white transition"
            title="Stop (retour au début)"
          >
            ⏹
          </button>
          {salon.platform === 'youtube' && playbackState.trackId && playbackState.trackId !== 'demo' && (
            <OpenOnYoutubeButton trackId={playbackState.trackId} positionMs={displayPositionMs} />
          )}
        </>
      )}
      {theaterVideoToggle}
      <span className="ml-auto flex shrink-0">{playbackStatusBadge}</span>
    </div>
  );

  if (theaterMode) {
    const showHostTheaterBar = Boolean(isHost && hostLinked);
    const showTheaterDockedControls = Boolean(canUseYoutubeEmbed && youtubeTrackId);

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
          onClick={isPlaying ? pause : play}
          className={theaterControlBtnClass}
        >
          {isPlaying ? 'Pause' : 'Lecture'}
        </button>
        <button
          type="button"
          onClick={() => {
            pause();
            seek(0);
          }}
          className={theaterControlBtnClass}
          title="Stop (retour au début)"
        >
          ⏹
        </button>
        {salon.platform === 'youtube' && playbackState.trackId && playbackState.trackId !== 'demo' && (
          <OpenOnYoutubeButton trackId={playbackState.trackId} positionMs={displayPositionMs} />
        )}
      </>
    ) : undefined;

    const theaterControlsFooter = showHostTheaterBar ? (
      <input
        type="range"
        min={0}
        max={600000}
        step={1000}
        value={Math.min(displayPositionMs, 600000)}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full accent-purple-500 h-1 pointer-events-auto"
        aria-label="Position de lecture"
      />
    ) : undefined;

    return (
      <section className="relative flex flex-col h-full w-full min-h-0 overflow-hidden bg-transparent">
        <div className="relative flex-1 min-h-0 w-full">
          {canUseYoutubeEmbed && youtubeTrackId ? (
            <div className="absolute inset-0">
              <SalonYouTubePlayer
                videoId={youtubeTrackId}
                playbackState={playbackState}
                showVideo={showYoutubeVideo}
                fillContainer
                showLocalControls={showTheaterDockedControls}
                minimalLocalControls={showTheaterDockedControls}
                showLocalPause={isHost ? !showHostTheaterBar : false}
                showYoutubeLinkInControls={false}
                playbackActive={playbackActive}
                isHost={isHost}
                onHostProgressReport={hostLinked ? reportHostProgress : undefined}
                controlsPlayOverride={theaterSyncPlayControls}
                controlsLeading={showTheaterDockedControls ? theaterTimeLabel : undefined}
                controlsTrailing={
                  showTheaterDockedControls ? (
                    <>
                      {theaterVideoToggle}
                      {playbackStatusBadge}
                    </>
                  ) : undefined
                }
                controlsFooter={showTheaterDockedControls ? theaterControlsFooter : undefined}
              />
            </div>
          ) : (
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
                className="relative z-10 w-40 h-40 rounded-2xl shadow-2xl object-cover"
              />
              <div className="relative z-10 text-center max-w-sm">
                <p className="text-lg font-bold text-white truncate">{playbackState.title}</p>
                <p className="text-sm text-gray-300 truncate">{playbackState.artist}</p>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 z-20 pointer-events-none bg-gradient-to-b from-black/90 via-black/55 to-transparent px-3 pt-2 pb-8">
            <p className="text-sm font-bold text-white truncate">{playbackState.title}</p>
            <p className="text-xs text-gray-400 truncate">{playbackState.artist}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                  salon.accessMode === 'public'
                    ? 'bg-black/60 text-[#7ecba0]'
                    : 'bg-black/60 text-[#c4a460]'
                }`}
              >
                {salon.accessMode === 'public' ? '🌍 Salon public' : '🔒 Sur invitation'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-black/60 text-gray-300">
                👥 {salon.listenersCount} auditeur{salon.listenersCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {!showTheaterDockedControls && (
            <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {hostControlBar}
              {showHostTheaterBar && (
                <input
                  type="range"
                  min={0}
                  max={600000}
                  step={1000}
                  value={Math.min(displayPositionMs, 600000)}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="w-full accent-purple-500 h-1 mt-2 pointer-events-auto"
                  aria-label="Position de lecture"
                />
              )}
            </div>
          )}
        </div>

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

        {!isHost && (
          <div className="shrink-0 max-h-[40%] overflow-y-auto border-t border-[#1e1e2f] bg-[#101018]/95 p-3 space-y-3">
            <p className="text-[11px] text-center text-[#6b6b8a] py-0.5">
              🎵 L&apos;hôte contrôle la lecture&thinsp;•&thinsp;Vous pouvez proposer des vidéos
            </p>
            {spotifyNotif && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/25 px-3 py-2 text-sm text-green-300 text-center">
                {spotifyNotif}
              </div>
            )}
            {salon.platform === 'spotify' && salon.spotifyJamUrl && (
              <SpotifyJamJoinCard jamUrl={salon.spotifyJamUrl} onCopy={setJamToast} />
            )}
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
                      href={syncListenUrl ?? resolved.externalUrl}
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
      </section>
    );
  }

  return (
    <>
    {mapInline && canUseYoutubeEmbed && youtubeTrackId && (
      <div className="w-full max-w-[320px] mx-auto aspect-video bg-black overflow-hidden rounded-lg">
        <SalonYouTubePlayer
          videoId={youtubeTrackId}
          playbackState={playbackState}
          showVideo={showYoutubeVideo}
          showLocalControls={!(isHost && hostLinked)}
          showLocalPause={false}
          showYoutubeLinkInControls={salon.platform === 'youtube' && !(isHost && hostLinked)}
          playbackActive={playbackActive}
          isHost={isHost}
          onHostProgressReport={hostLinked ? reportHostProgress : undefined}
          onVideoEnd={handleVideoEnd}
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

        <div className="flex items-center gap-4">
          <p className="text-3xl font-mono tabular-nums text-white tracking-tight">
            {formatPlaybackTime(displayPositionMs)}
          </p>
          {isHost && hostLinked && (
            <div className="flex-1 flex gap-1.5 min-w-0 items-center flex-wrap justify-end">
              <button
                type="button"
                onClick={isPlaying ? pause : play}
                className={`${mapInline ? 'px-2 py-1 text-xs' : 'flex-1 py-2 text-sm'} rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white transition`}
              >
                {isPlaying ? 'Pause' : 'Lecture'}
              </button>
              <button
                type="button"
                onClick={() => {
                  pause();
                  seek(0);
                }}
                className={`${mapInline ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-xl border border-[#2a2a3a] text-gray-400 hover:text-white transition`}
                title="Stop (retour au début)"
              >
                ⏹
              </button>
              {salon.platform === 'youtube' &&
                playbackState.trackId &&
                playbackState.trackId !== 'demo' && (
                  <OpenOnYoutubeButton trackId={playbackState.trackId} positionMs={displayPositionMs} />
                )}
            </div>
          )}
        </div>

        {isHost && hostLinked && (
          <input
            type="range"
            min={0}
            max={600000}
            step={1000}
            value={Math.min(displayPositionMs, 600000)}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-purple-500 h-1"
            aria-label="Position de lecture"
          />
        )}

        {salon.platform === 'spotify' && isHost && hostLinked && (
          <div className="space-y-2 pt-1">
            {salon.spotifyJamUrl && !editingHostJam ? (
              <>
                <SpotifyJamJoinCard jamUrl={salon.spotifyJamUrl} isHost onCopy={setJamToast} />
                <button
                  type="button"
                  onClick={() => {
                    setHostJamDraft(salon.spotifyJamUrl ?? '');
                    setEditingHostJam(true);
                  }}
                  className="text-[11px] text-gray-500 hover:text-gray-300"
                >
                  Modifier le lien Jam
                </button>
              </>
            ) : (
              <>
                <SpotifyJamLinkField
                  value={hostJamDraft}
                  onChange={setHostJamDraft}
                  variant="inline"
                  disabled={savingJam}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveHostJamLink()}
                    disabled={savingJam || !hostJamDraft.trim()}
                    className="flex-1 py-2 rounded-xl bg-green-600/80 hover:bg-green-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {savingJam ? 'Enregistrement…' : 'Enregistrer le lien Jam'}
                  </button>
                  {salon.spotifyJamUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setHostJamDraft(salon.spotifyJamUrl ?? '');
                        setEditingHostJam(false);
                      }}
                      className="px-3 py-2 rounded-xl border border-[#2a2a3a] text-xs text-gray-400"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
                showVideo={showYoutubeVideo}
              showLocalControls={mapInline && !(isHost && hostLinked)}
              showLocalPause={false}
              showYoutubeLinkInControls={!mapInline || (salon.platform === 'youtube' && !(isHost && hostLinked))}
                playbackActive={playbackActive}
                isHost={isHost}
                onHostProgressReport={hostLinked ? reportHostProgress : undefined}
                onVideoEnd={handleVideoEnd}
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

      {!isHost && (
        <>
          <SectionDivider />
          <div className="p-4 space-y-3">
            <p className="text-[11px] text-center text-[#6b6b8a] py-0.5">
              🎵 L&apos;hôte contrôle la lecture&thinsp;•&thinsp;Vous pouvez proposer des vidéos
            </p>
            {spotifyNotif && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/25 px-3 py-2 text-sm text-green-300 text-center">
                {spotifyNotif}
              </div>
            )}
            {salon.platform === 'spotify' && salon.spotifyJamUrl && (
              <SpotifyJamJoinCard jamUrl={salon.spotifyJamUrl} onCopy={setJamToast} />
            )}
            {salon.platform === 'spotify' && !salon.spotifyJamUrl && (
              <p className="text-[11px] text-center text-amber-400/90">
                L&apos;hôte n&apos;a pas encore partagé de lien Jam — suivez le chrono ci-dessous dans Spotify.
              </p>
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
                      href={syncListenUrl ?? resolved.externalUrl}
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
                {salon.platform === 'spotify'
                  ? 'Ouvrez Spotify au bon morceau et alignez-vous sur le chrono.'
                  : 'Spotify ne se lit pas dans le navigateur — utilisez YouTube pour écouter ensemble.'}
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
                  isHost
                  allowQueue={salon.allowQueue}
                  onSkip={onSkip}
                  onPlayItem={onPlayQueueItem}
                  skipping={skipping}
                  compact
                />
                <SalonProposalsSection
                  isHost
                  allowQueue={salon.allowQueue}
                  proposals={proposals}
                  loadingProposals={loadingProposals}
                  onAccept={onAcceptProposal}
                  onReject={onRejectProposal}
                  compact
                />
              </>
            )}
            {showParticipantProposals && (
              <SalonProposalsSection
                isHost={false}
                allowQueue={salon.allowQueue}
                proposals={proposals}
                onPropose={onProposeTrack}
              />
            )}
          </div>
        </>
      )}
    </section>
    {jamToast && (
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1a1a28] border border-green-500/40 text-sm text-white shadow-lg"
        role="status"
      >
        {jamToast}
      </div>
    )}
    </>
  );
}
