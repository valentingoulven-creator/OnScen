import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../models/schema';
import type { Live } from '../models/schema';
import { canAccessLiveIceServers } from './liveParticipants';
import { setIo, clearIo } from './ioInstance';

function baseLive(overrides: Partial<Live> = {}): Live {
  return {
    id: 'live1',
    hostId: 'host1',
    hostName: 'Host',
    isActive: true,
    cameraActive: true,
    viewersCount: 0,
    playbackState: { title: '', artist: '', isPlaying: false },
    latitude: 48.85,
    longitude: 2.35,
    blurredLatitude: 48.85,
    blurredLongitude: 2.35,
    title: 'Test live',
    platform: 'spotify',
    createdAt: Date.now(),
    ...overrides,
  } as Live;
}

describe('canAccessLiveIceServers', () => {
  beforeEach(() => {
    db.lives.clear();
    clearIo();
  });

  it('allows the host of an active live', () => {
    db.lives.set('live1', baseLive());
    expect(canAccessLiveIceServers('live1', 'host1')).toBe(true);
  });

  it('denies users who are not host or in the live room', () => {
    db.lives.set('live1', baseLive());
    expect(canAccessLiveIceServers('live1', 'stranger')).toBe(false);
  });

  it('denies when live is missing or inactive', () => {
    db.lives.set('live1', baseLive({ isActive: false }));
    expect(canAccessLiveIceServers('live1', 'host1')).toBe(false);
    expect(canAccessLiveIceServers('missing', 'host1')).toBe(false);
  });

  it('allows viewers present in the live socket room', () => {
    db.lives.set('live1', baseLive());
    const viewerSocket = { data: { userId: 'viewer1' } };
    const hostSocket = { data: { userId: 'host1' } };
    const sockets = new Map([
      ['s1', viewerSocket],
      ['s2', hostSocket],
    ]);
    const room = new Set(['s1', 's2']);
    const adapter = {
      rooms: new Map([['live_live1', room]]),
    };
    setIo({
      sockets: {
        adapter,
        sockets: {
          get: (id: string) => sockets.get(id),
        },
      },
    } as never);

    expect(canAccessLiveIceServers('live1', 'viewer1')).toBe(true);
    expect(canAccessLiveIceServers('live1', 'stranger')).toBe(false);
  });
});
