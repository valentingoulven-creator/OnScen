import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  durationMs?: number;
  trackId?: string;
  title?: string;
  artist?: string;
  albumArtUrl?: string;
  externalUrl?: string;
}

const POLL_MS_PLAYING = 2000;
const POLL_MS_IDLE = 4500;
const POLL_MS_HIDDEN = 6000;
const POSITION_DRIFT_MS = 2200;
const SEEK_JUMP_MS = 1200;
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
  const { t } = useTranslation();
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const stateRef = useRef(playbackState);
  stateRef.current = playbackState;
  const localControlUntilRef = useRef(0);
  const pollingRef = useRef(false);
  const pollNowRef = useRef<(() => void) | null>(null);
  const lastSpotifySampleRef = useRef<{
    progressMs: number;
    at: number;
    isPlaying: boolean;
  } | null>(null);

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

      const lastSample = lastSpotifySampleRef.current;
      let spotifySeeked = false;
      if (lastSample) {
        const elapsed = now - lastSample.at;
        const expectedProgress =
          lastSample.isPlaying && spotify.isPlaying
            ? lastSample.progressMs + elapsed
            : lastSample.progressMs;
        if (Math.abs(spotify.progressMs - expectedProgress) >= SEEK_JUMP_MS) {
          spotifySeeked = true;
        }
      }
      lastSpotifySampleRef.current = {
        progressMs: spotify.progressMs,
        at: now,
        isPlaying: spotify.isPlaying,
      };

      if (spotify.isPlaying) {
        const localPos = computePlaybackPositionMs(local, now);
        const drift = Math.abs(localPos - spotify.progressMs);
        if (spotifySeeked || drift >= POSITION_DRIFT_MS) {
          emitSync(playbackStateAtSeek(local, spotify.progressMs, now));
        }
      } else {
        const drift = Math.abs(local.progressMs - spotify.progressMs);
        if (spotifySeeked || drift >= POSITION_DRIFT_MS) {
          emitSync(playbackStateAtSeek(local, spotify.progressMs, now));
        }
      }
    },
    [emitSync]
  );

  useEffect(() => {
    if (!enabled || !token || !playbackActive) {
      lastSpotifySampleRef.current = null;
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
        const msg = e instanceof Error ? e.message : 'Sync Spotify indisponible';
        const needsReconnect =
          /reconnectez spotify|autoriser le contrôle|session expirée/i.test(msg);
        setSyncError(needsReconnect ? `${msg} ${t('platform.spotifyScopeReconnectHint')}` : msg);
      } finally {
        pollingRef.current = false;
      }
    };

    const getPollMs = () => {
      if (typeof document !== 'undefined' && document.hidden) return POLL_MS_HIDDEN;
      const playing = stateRef.current.isPlaying;
      return playing ? POLL_MS_PLAYING : POLL_MS_IDLE;
    };

    pollNowRef.current = () => {
      if (!cancelled) void poll();
    };

    let timeoutId = 0;
    const scheduleNext = () => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void poll().finally(() => scheduleNext());
      }, getPollMs());
    };

    void poll().finally(() => scheduleNext());

    const onVisibility = () => {
      if (cancelled) return;
      scheduleNext();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      pollNowRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timeoutId);
    };
  }, [enabled, token, salonId, playbackActive, applySpotifyState, t]);

  const refreshNow = useCallback(() => {
    pollNowRef.current?.();
  }, []);

  return { nowPlaying, syncError, markLocalControl, refreshNow };
}
