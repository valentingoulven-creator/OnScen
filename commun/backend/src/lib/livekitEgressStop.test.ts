import { describe, it, expect, vi, beforeEach } from 'vitest';

const egressStore = vi.hoisted(() => ({
  getLiveKitEgressId: vi.fn(),
  clearLiveKitEgressId: vi.fn(),
}));

vi.mock('./livekitEgressStore', () => ({
  getLiveKitEgressId: egressStore.getLiveKitEgressId,
  clearLiveKitEgressId: egressStore.clearLiveKitEgressId,
  setLiveKitEgressId: vi.fn(),
}));

const stopEgress = vi.fn();

vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn(),
  EgressClient: vi.fn().mockImplementation(() => ({
    stopEgress,
  })),
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    createRoom: vi.fn(),
    deleteRoom: vi.fn(),
    listRooms: vi.fn(),
  })),
}));

describe('stopLiveKitEgressIfActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
  });

  it('returns false when no egress is active', async () => {
    egressStore.getLiveKitEgressId.mockResolvedValue(undefined);
    const { stopLiveKitEgressIfActive } = await import('./livekit');
    await expect(stopLiveKitEgressIfActive('live_1')).resolves.toBe(false);
    expect(stopEgress).not.toHaveBeenCalled();
  });

  it('stops egress and clears store when active', async () => {
    egressStore.getLiveKitEgressId.mockResolvedValue('EG_123');
    stopEgress.mockResolvedValue(undefined);
    const { stopLiveKitEgressIfActive } = await import('./livekit');
    await expect(stopLiveKitEgressIfActive('live_1')).resolves.toBe(true);
    expect(stopEgress).toHaveBeenCalledWith('EG_123');
    expect(egressStore.clearLiveKitEgressId).toHaveBeenCalledWith('live_1');
  });
});
