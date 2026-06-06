import { describe, expect, it } from 'vitest';
import {
  computePlaybackPositionMs,
  mergeRemotePlaybackState,
  playbackStateAtSeek,
  shouldResetPlaybackFromInitial,
} from './salonPlayback';
import type { PlaybackState } from '../types';

function baseState(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return {
    platform: 'youtube',
    trackId: 'abc',
    title: 'T',
    artist: 'A',
    isPlaying: true,
    progressMs: 10_000,
    startedAt: 1_000_000,
    updatedAt: 1_000_000,
    ...overrides,
  };
}

describe('salonPlayback sync', () => {
  it('extrapole la position pendant la lecture', () => {
    const state = baseState({ progressMs: 0, startedAt: 1000, updatedAt: 1000 });
    expect(computePlaybackPositionMs(state, 6000)).toBe(5000);
  });

  it('ne réinitialise pas sur updatedAt seul si l’ancre horloge est identique', () => {
    const local = baseState({ updatedAt: 1000 });
    const remote = baseState({ updatedAt: 2000 });
    expect(shouldResetPlaybackFromInitial(local, remote)).toBe(false);
  });

  it('fusionne showVideo sans toucher l’horloge', () => {
    const local = baseState({ showVideo: false, updatedAt: 1000 });
    const remote = baseState({ showVideo: true, updatedAt: 5000 });
    const merged = mergeRemotePlaybackState(local, remote);
    expect(merged.showVideo).toBe(true);
    expect(merged.startedAt).toBe(local.startedAt);
    expect(merged.progressMs).toBe(local.progressMs);
  });

  it('réinitialise sur changement de piste ou seek', () => {
    const local = baseState();
    const remote = baseState({ trackId: 'xyz', updatedAt: 9_999_999 });
    expect(shouldResetPlaybackFromInitial(local, remote)).toBe(true);
    expect(mergeRemotePlaybackState(local, remote).trackId).toBe('xyz');
  });

  it('playbackStateAtSeek réancre startedAt en lecture', () => {
    const patch = playbackStateAtSeek(baseState(), 42_000, 2_000_000);
    expect(patch.progressMs).toBe(42_000);
    expect(patch.startedAt).toBe(2_000_000);
    expect(patch.isPlaying).toBe(true);
  });
});
