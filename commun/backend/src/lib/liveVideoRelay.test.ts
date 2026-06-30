import { describe, it, expect } from 'vitest';
import type { Live } from '../models/schema';
import { validateLiveWebrtcSignal, validateLiveWebrtcViewerReady } from './liveVideoRelay';

function baseLive(overrides: Partial<Live> = {}): Live {
  return {
    id: 'live1',
    hostId: 'host1',
    hostName: 'Host',
    isActive: true,
    cameraActive: true,
    viewersCount: 2,
    playbackState: { title: '', artist: '', isPlaying: false },
    ...overrides,
  } as Live;
}

describe('validateLiveWebrtcViewerReady', () => {
  it('accepte un spectateur quand la caméra est active', () => {
    expect(validateLiveWebrtcViewerReady(baseLive(), 'viewer1', true)).toBe(true);
  });

  it('refuse le host et les lives sans caméra', () => {
    expect(validateLiveWebrtcViewerReady(baseLive(), 'host1', true)).toBe(false);
    expect(validateLiveWebrtcViewerReady(baseLive({ cameraActive: false }), 'viewer1', true)).toBe(
      false
    );
    expect(validateLiveWebrtcViewerReady(baseLive(), 'viewer1', false)).toBe(false);
    expect(
      validateLiveWebrtcViewerReady(baseLive({ cameraMode: 'file' }), 'viewer1', true)
    ).toBe(false);
  });
});

describe('validateLiveWebrtcSignal', () => {
  const live = baseLive();

  it('autorise offer host→viewer', () => {
    expect(validateLiveWebrtcSignal(live, 'host1', 'viewer1', 'offer', true)).toBe(true);
    expect(validateLiveWebrtcSignal(live, 'viewer1', 'host1', 'offer', true)).toBe(false);
  });

  it('autorise answer viewer→host', () => {
    expect(validateLiveWebrtcSignal(live, 'viewer1', 'host1', 'answer', true)).toBe(true);
    expect(validateLiveWebrtcSignal(live, 'host1', 'viewer1', 'answer', true)).toBe(false);
  });

  it('autorise ice entre host et viewer', () => {
    expect(validateLiveWebrtcSignal(live, 'host1', 'viewer1', 'ice', true)).toBe(true);
    expect(validateLiveWebrtcSignal(live, 'viewer1', 'host1', 'ice', true)).toBe(true);
    expect(validateLiveWebrtcSignal(live, 'viewer1', 'viewer2', 'ice', true)).toBe(false);
  });
});
