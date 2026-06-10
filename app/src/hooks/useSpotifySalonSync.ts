import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  computePlaybackPositionMs,
  playbackStateAtPause,
  playbackStateAtResume,
  playbackStateAtSeek,
} from '../lib/salonPlayback';
import type { PlaybackState } from '../types';

export interface SpotifyNowPlaying {
  active: boolean;
  isPlaying: boolean;
  progressMs: number;
  trackId?: string;
  title?: string;
  artist?: string;
  albumArtUrl?: string;
  externalUrl?: string;
}

const POLL_MS = 2500;
const POSITION_DRIFT_MS = 2500;
const LOCAL_CONTROL_GUARD_MS = 2800;

interface UseSpotifySalonSyncOptions {
  salonId: string;
  token: string | null;
  enabled: boolean;
  playbackActive?: boolean;
  playbackState: PlaybackState;
  emitSync: (patch: Partial<PlaybackState>) => void;
}

function buildTrackPatch(
  spotify: SpotifyNowPlaying,
  now = Date.now()
): Partial<PlaybackState> {
  const trackId = spotify.trackId ?? 'demo';
  const base: Partial<PlaybackState> = {
    platform: 'spotify',
    trackId,
    title: spotify.title ?? 'Morceau Spotify',
    artist: spotify.artist ?? 'Spotify',
    albumArtUrl: spotify.albumArtUrl,
    externalUrl: spotify.externalUrl,
  };
  if (spotify.isPlaying) {
    return {
      ...base,
      isPlaying: true,
      progressMs: spotify.progressMs,
      startedAt: now,
      updatedAt: now,
    };
  }
  return {
    ...base,
    isPlaying: false,
    progressMs: spotify.progressMs,
    startedAt: undefined,
    updatedAt: now,
  };
}

export function useSpotifySalonSync({
  salonId,
  token,
  enabled,
  playbackActive = true,
  playbackState,
  emitSync,
}: UseSpotifySalonSyncOptions) {
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const stateRef = useRef(playbackState);
  stateRef.current = playbackState;
  const localControlUntilRef = useRef(0);
  const pollingRef = useRef(false);

  const markLocalControl = useCallback(() => {
    localControlUntilRef.current = Date.now() + LOCAL_CONTROL_GUARD_MS;
  }, []);

  const applySpotifyState = useCallback(
    (spotify: SpotifyNowPlaying) => {
      if (Date.now() < localControlUntilRef.current) return;

      const local = stateRef.current;
      const now = Date.now();

      if (!spotify.active) {
        if (local.isPlaying) {
          emitSync(playbackStateAtPause(local, now));
        }
        return;
      }

      const trackChanged =
        spotify.trackId && spotify.trackId !== local.trackId;
      const playStateChanged = spotify.isPlaying !== local.isPlaying;

      if (trackChanged) {
        emitSync(buildTrackPatch(spotify, now));
        return;
      }

      if (playStateChanged) {
        if (spotify.isPlaying) {
          emitSync({
            ...playbackStateAtResume(local, now),
            progressMs: spotify.progressMs,
            startedAt: now,
          });
        } else {
          emitSync({
            ...playbackStateAtPause(local, now),
            progressMs: spotify.progressMs,
          });
        }
        return;
      }

      if (spotify.isPlaying) {
        const localPos = computePlaybackPositionMs(local, now);
        if (Math.abs(localPos - spotify.progressMs) >= POSITION_DRIFT_MS) {
          emitSync(playbackStateAtSeek(local, spotify.progressMs, now));
        }
      } else if (Math.abs(local.progressMs - spotify.progressMs) >= POSITION_DRIFT_MS) {
        emitSync(playbackStateAtSeek(local, spotify.progressMs, now));
      }
    },
    [emitSync]
  );

  useEffect(() => {
    if (!enabled || !token || !playbackActive) {
      setNowPlaying(null);
      setSyncError(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (pollingRef.current || cancelled) return;
      pollingRef.current = true;
      try {
        const { nowPlaying: spotify } = await api.getSpotifySalonNowPlaying(token, salonId);
        if (cancelled) return;
        setNowPlaying(spotify);
        setSyncError(null);
        applySpotifyState(spotify);
      } catch (e) {
        if (cancelled) return;
        setSyncError(e instanceof Error ? e.message : 'Sync Spotify indisponible');
      } finally {
        pollingRef.current = false;
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, token, salonId, playbackActive, applySpotifyState]);

  return { nowPlaying, syncError, markLocalControl };
}
