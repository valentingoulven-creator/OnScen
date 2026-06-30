import type { PlaybackState } from '../models/schema';

/** Position courante dérivée de l'horloge partagée (progressMs + updatedAt). */
export function computePlaybackPositionMs(state: PlaybackState, now = Date.now()): number {
  if (!state.isPlaying) return Math.max(0, state.progressMs);
  const anchor = state.startedAt ?? state.updatedAt;
  return Math.max(0, state.progressMs + (now - anchor));
}

/** État d'horloge pour une reprise à la position courante. */
export function playbackStateAtResume(state: PlaybackState, now = Date.now()): Partial<PlaybackState> {
  const progressMs = computePlaybackPositionMs(state, now);
  return {
    progressMs,
    startedAt: now,
    updatedAt: now,
    isPlaying: true,
  };
}

/** État d'horloge pour une pause à la position courante. */
export function playbackStateAtPause(state: PlaybackState, now = Date.now()): Partial<PlaybackState> {
  return {
    progressMs: computePlaybackPositionMs(state, now),
    startedAt: undefined,
    updatedAt: now,
    isPlaying: false,
  };
}

/** État d'horloge pour un seek explicite. */
export function playbackStateAtSeek(
  state: PlaybackState,
  progressMs: number,
  now = Date.now()
): Partial<PlaybackState> {
  const clamped = Math.max(0, Math.floor(progressMs));
  if (state.isPlaying) {
    return { progressMs: clamped, startedAt: now, updatedAt: now, isPlaying: true };
  }
  return { progressMs: clamped, startedAt: undefined, updatedAt: now, isPlaying: false };
}
