import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import {
  computePlaybackPositionMs,
  playbackStateAtPause,
  playbackStateAtResume,
  playbackStateAtSeek,
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

  useEffect(() => {
    setPlaybackState(initialState);
    setDisplayPositionMs(computePlaybackPositionMs(initialState));
  }, [
    initialState.updatedAt,
    initialState.trackId,
    initialState.isPlaying,
    initialState.progressMs,
    initialState.title,
  ]);

  useEffect(() => {
    const socket = getSocket();
    const onSync = (state: PlaybackState) => {
      setPlaybackState(state);
      setDisplayPositionMs(computePlaybackPositionMs(state));
      onStateChange?.(state);
    };
    socket.on('playback_sync', onSync);
    socket.on('salon_playback', onSync);
    return () => {
      socket.off('playback_sync', onSync);
      socket.off('salon_playback', onSync);
    };
  }, [salonId, onStateChange]);

  useEffect(() => {
    const tick = () => setDisplayPositionMs(computePlaybackPositionMs(stateRef.current));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  const emitSync = useCallback(
    (patch: Partial<PlaybackState>) => {
      if (!isHost) return;
      const next = { ...stateRef.current, ...patch } as PlaybackState;
      setPlaybackState(next);
      setDisplayPositionMs(computePlaybackPositionMs(next));
      onStateChange?.(next);
      getSocket().emit('sync_playback', { salonId, playbackState: patch });
    },
    [isHost, salonId, onStateChange]
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

  return {
    playbackState,
    displayPositionMs,
    play,
    pause,
    seek,
    isPlaying: playbackState.isPlaying,
  };
}
