import { useCallback, useEffect, useRef, useState } from 'react';
import { emitOnSocket, getSocket } from '../lib/socket';
import {
  computePlaybackPositionMs,
  mergeRemotePlaybackState,
  playbackStateAtPause,
  playbackStateAtProgressReport,
  playbackStateAtResume,
  playbackStateAtSeek,
  shouldResetPlaybackFromInitial,
} from '../lib/salonPlayback';
import type { PlaybackState } from '../types';

interface UseSalonPlaybackSyncOptions {
  salonId: string;
  isHost: boolean;
  initialState: PlaybackState;
  onStateChange?: (state: PlaybackState) => void;
}

export function useSalonPlaybackSync({
  salonId,
  isHost,
  initialState,
  onStateChange,
}: UseSalonPlaybackSyncOptions) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(initialState);
  const [displayPositionMs, setDisplayPositionMs] = useState(() =>
    computePlaybackPositionMs(initialState)
  );
  const stateRef = useRef(playbackState);
  stateRef.current = playbackState;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    const local = stateRef.current;
    if (isHost) {
      if (initialState.trackId !== local.trackId) {
        const merged = mergeRemotePlaybackState(local, initialState);
        setPlaybackState(merged);
        setDisplayPositionMs(computePlaybackPositionMs(merged));
        return;
      }
      if (initialState.showVideo !== local.showVideo) {
        setPlaybackState((s) => ({ ...s, showVideo: initialState.showVideo }));
      }
      if (
        initialState.updatedAt > local.updatedAt &&
        shouldResetPlaybackFromInitial(local, initialState)
      ) {
        const merged = mergeRemotePlaybackState(local, initialState);
        setPlaybackState(merged);
        setDisplayPositionMs(computePlaybackPositionMs(merged));
      }
      return;
    }
    if (!shouldResetPlaybackFromInitial(local, initialState)) {
      if (initialState.showVideo !== local.showVideo) {
        setPlaybackState((s) => ({ ...s, showVideo: initialState.showVideo }));
      }
      return;
    }
    setPlaybackState(initialState);
    setDisplayPositionMs(computePlaybackPositionMs(initialState));
  }, [
    initialState.updatedAt,
    initialState.trackId,
    initialState.isPlaying,
    initialState.startedAt,
    initialState.title,
    initialState.showVideo,
    isHost,
  ]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onSync = (state: PlaybackState) => {
      const merged = mergeRemotePlaybackState(stateRef.current, state);
      if (isHost) {
        if (!shouldResetPlaybackFromInitial(stateRef.current, merged)) {
          setPlaybackState(merged);
          onStateChangeRef.current?.(merged);
        }
        return;
      }
      setPlaybackState(merged);
      setDisplayPositionMs(computePlaybackPositionMs(merged));
      onStateChangeRef.current?.(merged);
    };
    const onForceSync = (state: PlaybackState) => {
      if (isHost) return;
      setPlaybackState(state);
      setDisplayPositionMs(computePlaybackPositionMs(state));
      onStateChangeRef.current?.(state);
    };
    socket.on('playback_sync', onSync);
    socket.on('salon_playback', onSync);
    socket.on('salon_force_sync', onForceSync);
    return () => {
      socket.off('playback_sync', onSync);
      socket.off('salon_playback', onSync);
      socket.off('salon_force_sync', onForceSync);
    };
  }, [salonId, isHost]);

  useEffect(() => {
    const tick = () => setDisplayPositionMs(computePlaybackPositionMs(stateRef.current));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  const emitForceSync = useCallback(() => {
    if (!isHost) return;
    const currentProgressMs = computePlaybackPositionMs(stateRef.current);
    emitOnSocket('salon_force_sync', { salonId, progressMs: currentProgressMs });
  }, [isHost, salonId]);

  const emitSync = useCallback(
    (patch: Partial<PlaybackState>) => {
      if (!isHost) return;
      const next = { ...stateRef.current, ...patch } as PlaybackState;
      setPlaybackState(next);
      setDisplayPositionMs(computePlaybackPositionMs(next));
      onStateChangeRef.current?.(next);
      emitOnSocket('sync_playback', { salonId, playbackState: patch });
    },
    [isHost, salonId]
  );

  /** Émet un patch arbitraire (host uniquement) sans mettre à jour l'état local de position. */
  const emitPatch = useCallback(
    (patch: Partial<PlaybackState>) => {
      if (!isHost) return;
      const next = mergeRemotePlaybackState(stateRef.current, {
        ...stateRef.current,
        ...patch,
      } as PlaybackState);
      setPlaybackState(next);
      setDisplayPositionMs(computePlaybackPositionMs(next));
      onStateChangeRef.current?.(next);
      emitOnSocket('sync_playback', { salonId, playbackState: patch });
    },
    [isHost, salonId]
  );

  const play = useCallback(() => {
    emitSync(playbackStateAtResume(stateRef.current));
  }, [emitSync]);

  const pause = useCallback(() => {
    emitSync(playbackStateAtPause(stateRef.current));
  }, [emitSync]);

  const seek = useCallback(
    (progressMs: number) => {
      emitSync(playbackStateAtSeek(stateRef.current, progressMs));
    },
    [emitSync]
  );

  const applyPlaybackState = useCallback((state: PlaybackState) => {
    const merged = mergeRemotePlaybackState(stateRef.current, state);
    setPlaybackState(merged);
    setDisplayPositionMs(computePlaybackPositionMs(merged));
    onStateChangeRef.current?.(merged);
  }, []);

  /** Hôte : ancre l’horloge serveur sur la position réelle du lecteur YouTube (heartbeat). */
  const reportHostProgress = useCallback(
    (progressMs: number) => {
      if (!isHost) return;
      const s = stateRef.current;
      if (!s.isPlaying) return;
      const patch = playbackStateAtProgressReport(s, progressMs);
      const next = { ...s, ...patch } as PlaybackState;
      stateRef.current = next;
      setPlaybackState(next);
      setDisplayPositionMs(computePlaybackPositionMs(next));
      onStateChangeRef.current?.(next);
      emitOnSocket('sync_playback', { salonId, playbackState: patch });
    },
    [isHost, salonId]
  );

  return {
    playbackState,
    displayPositionMs,
    play,
    pause,
    seek,
    isPlaying: playbackState.isPlaying,
    applyPlaybackState,
    emitSync,
    emitPatch,
    emitForceSync,
    reportHostProgress,
  };
}
