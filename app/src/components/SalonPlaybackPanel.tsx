import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useSalonPlaybackSync } from '../hooks/useSalonPlaybackSync';
import {
  buildYouTubeEmbedUrl,
  formatPlaybackTime,
  preferredParticipantPlatform,
  type MusicPlatform,
} from '../lib/salonPlayback';
import { isPlatformConnected } from '../lib/platformConnect';
import { PlatformConnectCard } from './PlatformConnectCard';
import type { User } from '../types';
import type { PlaybackState, ResolvedSalonTrack, Salon } from '../types';

interface SalonPlaybackPanelProps {
  salon: Salon;
  token: string | null;
  isHost: boolean;
  userPlatforms?: MusicPlatform[];
  onUserUpdated?: (user: User) => void;
  onPlaybackStateChange?: (state: PlaybackState) => void;
}

const PLATFORM_META: Record<MusicPlatform, { label: string; emoji: string; accent: string }> = {
  spotify: { label: 'Spotify', emoji: '🎧', accent: 'text-green-400 border-green-500/40 bg-green-500/10' },
  youtube: { label: 'YouTube', emoji: '▶️', accent: 'text-red-400 border-red-500/40 bg-red-500/10' },
};

export function SalonPlaybackPanel({
  salon,
  token,
  isHost,
  userPlatforms,
  onUserUpdated,
  onPlaybackStateChange,
}: SalonPlaybackPanelProps) {
  const hostLinked = isHost && isPlatformConnected(userPlatforms, salon.platform);
  const [participantPlatform, setParticipantPlatform] = useState<MusicPlatform>(() =>
    preferredParticipantPlatform(userPlatforms, salon.platform)
  );
  const [resolved, setResolved] = useState<ResolvedSalonTrack | null>(null);
  const [resolving, setResolving] = useState(false);

  const { playbackState, displayPositionMs, play, pause, seek, isPlaying } = useSalonPlaybackSync({
    salonId: salon.id,
    isHost: hostLinked,
    initialState: salon.playbackState,
    onStateChange: onPlaybackStateChange,
  });

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
  }, [token, salon.id, participantPlatform, isHost, playbackState.title, playbackState.artist]);

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
    participantPlatform === 'youtube'
      ? isHost
        ? salon.platform === 'youtube'
          ? playbackState.trackId
          : resolved?.trackId
        : resolved?.trackId
      : undefined;

  const embedStartSec = Math.floor(
    isPlaying ? playbackState.progressMs / 1000 : displayPositionMs / 1000
  );
  const youtubeEmbed =
    youtubeTrackId && youtubeTrackId !== 'demo'
      ? buildYouTubeEmbedUrl(youtubeTrackId, embedStartSec, isPlaying)
      : null;

  const embedKey = `${youtubeTrackId}-${isPlaying ? 'p' : 's'}-${embedStartSec}-${playbackState.updatedAt}`;

  const matchLabel =
    resolved?.matchType === 'exact'
      ? 'Même morceau'
      : resolved?.matchType === 'mock'
        ? 'Correspondance msdev'
        : 'Recherche automatique';

  return (
    <section className="mt-4 w-full max-w-md bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-purple-400 uppercase">Écoute synchronisée</h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            isPlaying ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-gray-400 border-[#2d2d3d]'
          }`}
        >
          {isPlaying ? '▶ Lecture' : '⏸ Pause'}
        </span>
      </div>

      <div className="text-center">
        <p className="text-2xl font-mono tabular-nums text-white">{formatPlaybackTime(displayPositionMs)}</p>
        <p className="text-[10px] text-gray-500 mt-1">
          Horloge partagée · hôte {hostMeta.emoji} {hostMeta.label}
        </p>
      </div>

      {isHost && !hostLinked && token && (
        <div className="space-y-2">
          <p className="text-xs text-amber-400 text-center">
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

      {isHost && hostLinked ? (
        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={600000}
            step={1000}
            value={Math.min(displayPositionMs, 600000)}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-purple-500"
            aria-label="Position de lecture"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isPlaying ? pause : play}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 font-bold text-white text-sm"
            >
              {isPlaying ? 'Pause' : 'Lecture'}
            </button>
            {playbackState.externalUrl && (
              <a
                href={playbackState.externalUrl}
                target="_blank"
                rel="noreferrer"
                className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${hostMeta.accent}`}
              >
                {hostMeta.emoji}
              </a>
            )}
          </div>
          <p className="text-[10px] text-gray-500 text-center">
            Contrôlez la position ici ; les participants suivent l&apos;horloge partagée.
          </p>
        </div>
      ) : !isHost ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Votre plateforme d&apos;écoute :</p>
          <div className="grid grid-cols-2 gap-2">
            {(['spotify', 'youtube'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setParticipantPlatform(p)}
                className={`py-2 rounded-xl border text-xs font-bold capitalize transition ${
                  participantPlatform === p ? PLATFORM_META[p].accent : 'border-[#2d2d3d] text-gray-400'
                }`}
              >
                {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
              </button>
            ))}
          </div>

          {resolving ? (
            <p className="text-xs text-gray-500 text-center">Recherche du morceau…</p>
          ) : resolved ? (
            <div className="rounded-xl border border-[#2d2d3d] bg-[#1a1a26] p-3 space-y-2">
              <p className="text-[10px] text-purple-300 uppercase tracking-wide">{matchLabel}</p>
              <p className="text-sm text-white font-medium truncate">{resolved.title}</p>
              <p className="text-xs text-gray-400 truncate">{resolved.artist}</p>
              <a
                href={resolved.externalUrl}
                target="_blank"
                rel="noreferrer"
                className={`block w-full text-center py-2.5 rounded-xl border font-bold text-sm ${participantMeta.accent}`}
              >
                Ouvrir sur {participantMeta.label}
              </a>
              {resolved.matchType === 'search' && (
                <p className="text-[10px] text-gray-500 text-center">
                  Correspondance approximative — vérifiez le bon titre dans {participantMeta.label}.
                </p>
              )}
            </div>
          ) : null}

          {openUrl && !resolved && (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className={`block w-full text-center py-2.5 rounded-xl border font-bold text-sm ${participantMeta.accent}`}
            >
              Ouvrir sur {participantMeta.label}
            </a>
          )}
        </div>
      ) : null}

      {youtubeEmbed && (isHost && hostLinked ? salon.platform === 'youtube' : participantPlatform === 'youtube') && (
        <iframe
          key={embedKey}
          title="Lecture YouTube synchronisée"
          src={youtubeEmbed}
          className="w-full aspect-video rounded-xl border border-[#1e1e2f]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      )}

      {!isHost && participantPlatform === 'spotify' && salon.platform !== 'spotify' && (
        <p className="text-[10px] text-gray-500 text-center">
          Lancez le morceau dans Spotify au moment affiché pour rester synchronisé (Jam / Premium).
        </p>
      )}
    </section>
  );
}
