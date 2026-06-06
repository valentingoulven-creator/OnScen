import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isPlatformConnected } from '../lib/platformConnect';
import { preferredParticipantPlatform } from '../lib/salonPlayback';
import { useSalonPlaybackSync } from '../hooks/useSalonPlaybackSync';
import { SalonYouTubePlayer } from './SalonYouTubePlayer';
import type { PlaybackState, Salon } from '../types';

interface MapSalonListenControlsProps {
  salon: Salon;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  className?: string;
  playbackActive?: boolean;
  /** false si le lien YouTube est déjà dans l’en-tête de la fiche. */
  showYoutubeLink?: boolean;
  /** false = lecteur muet sans lecture auto (fiche repliée). */
  autoplayAllowed?: boolean;
  /** Contrôles locaux discrets (fiche carte). */
  minimalControls?: boolean;
  /** Bouton Salon à droite du lien YouTube (petit salon replié). */
  onOpenSalon?: () => void;
  /** Après Salon : cloche favori, étoile, avatar hôte (petit salon replié). */
  controlsTrailingEnd?: ReactNode;
  /** false = audio uniquement, pas de zone vidéo (fiche repliée). */
  showVideo?: boolean;
}

/** Bouton « Salon » (plein écran) — petit salon carte, violet #9b7bd4.
 *  Taille alignée sur YOUTUBE_RED_LINK_CLASS (text-sm px-3 py-1.5 font-medium). */
export const MAP_SALON_OUTLINE_BUTTON_CLASS =
  'inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium border border-[#9b7bd4] text-[#9b7bd4] bg-transparent hover:bg-[#9b7bd4]/10 hover:text-[#b89ae8] hover:border-[#9b7bd4]/80 transition shrink-0';

function mapCollapsedSalonButton(onOpenSalon: () => void): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpenSalon}
      className={MAP_SALON_OUTLINE_BUTTON_CLASS}
      title="Ouvrir le salon en plein écran"
    >
      Salon
    </button>
  );
}

/** Lecteur audio compact (carte, fiche repliée) avec pause/volume via SalonYouTubePlayer. */
export function MapSalonListenControls({
  salon,
  onPlaybackStateChange,
  className = '',
  playbackActive = true,
  showYoutubeLink = true,
  autoplayAllowed = true,
  minimalControls = false,
  onOpenSalon,
  controlsTrailingEnd,
  showVideo = true,
}: MapSalonListenControlsProps) {
  const { user, token } = useAuth();
  const isHost = Boolean(salon.isHost ?? (salon.hostId && salon.hostId === user?.id));
  const hostLinked = Boolean(isHost && isPlatformConnected(user?.connectedPlatforms, salon.platform));
  const [participantPlatform, setParticipantPlatform] = useState(() =>
    preferredParticipantPlatform(user?.connectedPlatforms, salon.platform)
  );
  const [resolvedTrackId, setResolvedTrackId] = useState<string | null>(null);

  const { playbackState, play, pause, isPlaying } = useSalonPlaybackSync({
    salonId: salon.id,
    isHost: hostLinked,
    initialState: salon.playbackState,
    onStateChange: onPlaybackStateChange,
  });

  useEffect(() => {
    setParticipantPlatform(preferredParticipantPlatform(user?.connectedPlatforms, salon.platform));
  }, [salon.platform, user?.connectedPlatforms]);

  useEffect(() => {
    if (!token || hostLinked) return;
    let cancelled = false;
    api
      .resolveSalonTrack(token, salon.id, participantPlatform)
      .then((r) => {
        if (!cancelled) setResolvedTrackId(r.track?.trackId ?? null);
      })
      .catch(() => {
        if (!cancelled) setResolvedTrackId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    token,
    salon.id,
    participantPlatform,
    hostLinked,
    playbackState.trackId,
    playbackState.updatedAt,
  ]);

  const youtubeTrackId = useMemo(() => {
    if (salon.platform === 'youtube') {
      return playbackState.trackId !== 'demo' ? playbackState.trackId : null;
    }
    if (participantPlatform === 'youtube' && resolvedTrackId && resolvedTrackId !== 'demo') {
      return resolvedTrackId;
    }
    return null;
  }, [salon.platform, participantPlatform, playbackState.trackId, resolvedTrackId]);

  if (hostLinked) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <button
          type="button"
          onClick={() => (isPlaying ? pause() : play())}
          className={
            minimalControls
              ? 'px-3 py-1.5 rounded-full border border-white/10 bg-[#131318] text-xs font-medium text-[#8b8baf] hover:bg-white/5 hover:text-white transition'
              : 'px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition'
          }
        >
          {isPlaying ? 'Pause' : 'Lecture'}
        </button>
        <span className="text-[10px] text-[#6b6b8a]">Contrôle hôte</span>
      </div>
    );
  }

  if (!youtubeTrackId) {
    return (
      <p className={`text-[10px] text-[#6b6b8a] text-center py-1 ${className}`}>
        Développez pour Spotify ou liez YouTube.
      </p>
    );
  }

  return (
    <div className={className}>
      <div className={showVideo ? 'max-w-[320px] mx-auto' : undefined}>
      <SalonYouTubePlayer
        videoId={youtubeTrackId}
        playbackState={playbackState}
        showVideo={showVideo}
        showLocalControls
        showYoutubeLinkInControls={showYoutubeLink}
        playbackActive={playbackActive}
        autoplayAllowed={autoplayAllowed}
        minimalLocalControls={minimalControls}
        showLocalPause={false}
        youtubeLinkVariant={minimalControls ? 'youtube-red' : 'default'}
        controlsTrailing={
          minimalControls && (onOpenSalon || controlsTrailingEnd) ? (
            <>
              {onOpenSalon ? mapCollapsedSalonButton(onOpenSalon) : null}
              {controlsTrailingEnd}
            </>
          ) : undefined
        }
      />
      </div>
    </div>
  );
}
