import { describe, it, expect } from 'vitest';
import {
  getDefaultIceServers,
  hasLiveRelayVideoTrack,
  isRelayVideoTrackReady,
  liveStreamReadyForRelay,
  mergeRemoteLiveStream,
  setLiveIceServers,
  clearLiveIceServersCache,
} from './liveVideoRelay';

function mockTrack(opts: {
  kind: string;
  id?: string;
  readyState?: string;
  enabled?: boolean;
  muted?: boolean;
}) {
  return {
    kind: opts.kind,
    id: opts.id ?? opts.kind,
    readyState: opts.readyState ?? 'live',
    enabled: opts.enabled ?? true,
    muted: opts.muted ?? false,
  } as MediaStreamTrack;
}

function mockStream(tracks: Array<{ kind: string; id?: string; readyState?: string; enabled?: boolean; muted?: boolean }>) {
  const store: MediaStreamTrack[] = tracks.map((t) => mockTrack(t));
  return {
    getVideoTracks: () => store.filter((t) => t.kind === 'video'),
    getAudioTracks: () => store.filter((t) => t.kind === 'audio'),
    getTracks: () => [...store],
    addTrack: (t: MediaStreamTrack) => {
      store.push(t);
    },
    removeTrack: (t: MediaStreamTrack) => {
      const idx = store.findIndex((x) => x.id === t.id);
      if (idx >= 0) store.splice(idx, 1);
    },
  } as unknown as MediaStream;
}

describe('liveStreamReadyForRelay', () => {
  it('returns false for null', () => {
    expect(liveStreamReadyForRelay(null)).toBe(false);
    expect(liveStreamReadyForRelay(undefined)).toBe(false);
  });

  it('returns false when video track is muted (no frames)', () => {
    const stream = mockStream([{ kind: 'video', readyState: 'live', enabled: true, muted: true }]);
    expect(liveStreamReadyForRelay(stream)).toBe(false);
  });

  it('returns true when video track is live, enabled, and unmuted', () => {
    const stream = mockStream([{ kind: 'video', readyState: 'live', enabled: true, muted: false }]);
    expect(liveStreamReadyForRelay(stream)).toBe(true);
  });
});

describe('isRelayVideoTrackReady', () => {
  it('requires unmuted live enabled video track', () => {
    expect(isRelayVideoTrackReady(mockTrack({ kind: 'video', muted: true }))).toBe(false);
    expect(isRelayVideoTrackReady(mockTrack({ kind: 'video', muted: false }))).toBe(true);
    expect(isRelayVideoTrackReady(mockTrack({ kind: 'audio' }))).toBe(false);
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

describe('getDefaultIceServers', () => {
  it('falls back to Google STUN without cached TURN', () => {
    clearLiveIceServersCache();
    expect(getDefaultIceServers()).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
  });

  it('uses cached servers from API', () => {
    clearLiveIceServersCache();
    setLiveIceServers([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:example.com:3478', username: 'u', credential: 'p' },
    ]);
    expect(getDefaultIceServers()).toHaveLength(2);
    clearLiveIceServersCache();
  });
});

describe('mergeRemoteLiveStream', () => {
  it('merges audio then video into one stream', () => {
    const audio = mockTrack({ kind: 'audio', id: 'a1' });
    const video = mockTrack({ kind: 'video', id: 'v1' });
    const audioStream = mockStream([{ kind: 'audio', id: 'a1' }]);
    let merged = mergeRemoteLiveStream(mockStream([]), audioStream, audio);
    expect(merged.getAudioTracks()).toHaveLength(1);
    expect(merged.getVideoTracks()).toHaveLength(0);

    const videoStream = mockStream([{ kind: 'video', id: 'v1' }]);
    merged = mergeRemoteLiveStream(merged, videoStream, video);
    expect(merged.getAudioTracks()).toHaveLength(1);
    expect(merged.getVideoTracks()).toHaveLength(1);
  });
});
