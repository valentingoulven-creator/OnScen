import { describe, it, expect } from 'vitest';
import {
  hasLiveRelayVideoTrack,
  liveStreamReadyForRelay,
  mergeRemoteLiveStream,
} from './liveVideoRelay';

function mockStream(tracks: Array<{ kind: string; id?: string; readyState?: string; enabled?: boolean }>) {
  return {
    getVideoTracks: () =>
      tracks.filter((t) => t.kind === 'video') as MediaStreamTrack[],
    getAudioTracks: () =>
      tracks.filter((t) => t.kind === 'audio') as MediaStreamTrack[],
    getTracks: () => tracks as MediaStreamTrack[],
    addTrack: (t: MediaStreamTrack) => {
      tracks.push(t as { kind: string; id?: string; readyState?: string; enabled?: boolean });
    },
    removeTrack: (t: MediaStreamTrack) => {
      const idx = tracks.findIndex((x) => x.id === (t as { id?: string }).id);
      if (idx >= 0) tracks.splice(idx, 1);
    },
  } as unknown as MediaStream;
}

describe('liveStreamReadyForRelay', () => {
  it('returns false for null', () => {
    expect(liveStreamReadyForRelay(null)).toBe(false);
    expect(liveStreamReadyForRelay(undefined)).toBe(false);
  });
});

describe('hasLiveRelayVideoTrack', () => {
  it('returns false without a live video track', () => {
    const stream = mockStream([{ kind: 'audio', readyState: 'live', enabled: true }]);
    expect(hasLiveRelayVideoTrack(stream)).toBe(false);
  });

  it('returns true with a live enabled video track', () => {
    const stream = mockStream([{ kind: 'video', readyState: 'live', enabled: true }]);
    expect(hasLiveRelayVideoTrack(stream)).toBe(true);
  });
});

describe('mergeRemoteLiveStream', () => {
  it('merges audio then video into one stream', () => {
    const audio = { kind: 'audio', id: 'a1', readyState: 'live', enabled: true } as MediaStreamTrack;
    const video = { kind: 'video', id: 'v1', readyState: 'live', enabled: true } as MediaStreamTrack;
    const audioStream = mockStream([audio]);
    let merged = mergeRemoteLiveStream(mockStream([]), audioStream, audio);
    expect(merged.getAudioTracks()).toHaveLength(1);
    expect(merged.getVideoTracks()).toHaveLength(0);

    const videoStream = mockStream([video]);
    merged = mergeRemoteLiveStream(merged, videoStream, video);
    expect(merged.getAudioTracks()).toHaveLength(1);
    expect(merged.getVideoTracks()).toHaveLength(1);
  });
});
