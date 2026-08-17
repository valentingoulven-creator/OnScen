import { describe, it, expect, vi, beforeEach } from 'vitest';

const egressStore = vi.hoisted(() => ({
  setLiveKitEgressId: vi.fn(),
}));

const createRoom = vi.hoisted(() => vi.fn());
const startRoomCompositeEgress = vi.hoisted(() => vi.fn());

vi.mock('./livekitEgressStore', () => ({
  getLiveKitEgressId: vi.fn(),
  clearLiveKitEgressId: vi.fn(),
  setLiveKitEgressId: egressStore.setLiveKitEgressId,
}));

vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn(),
  EgressClient: vi.fn().mockImplementation(() => ({
    startRoomCompositeEgress,
  })),
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    createRoom,
  })),
}));

vi.mock('@livekit/protocol', () => ({
  StreamOutput: vi.fn().mockImplementation(() => ({})),
  StreamProtocol: { RTMP: 0 },
}));

describe('startLiveKitEgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret';
    createRoom.mockResolvedValue({ name: 'live_live_1' });
    startRoomCompositeEgress.mockResolvedValue({ egressId: 'EG_1' });
    egressStore.setLiveKitEgressId.mockResolvedValue(undefined);
  });

  it('creates the LiveKit room before starting room composite egress', async () => {
    const { startLiveKitEgress, liveKitRoomName } = await import('./livekit');
    await expect(startLiveKitEgress('live_1', 'rtmps://example/live/key')).resolves.toBe('EG_1');
    expect(createRoom).toHaveBeenCalledWith({
      name: liveKitRoomName('live_1'),
      emptyTimeout: 15 * 60,
    });
    expect(startRoomCompositeEgress).toHaveBeenCalled();
    expect(egressStore.setLiveKitEgressId).toHaveBeenCalledWith('live_1', 'EG_1');
  });

  it('ignores already-exists when creating the room', async () => {
    createRoom.mockRejectedValue(Object.assign(new Error('room already exists'), { code: 'already_exists' }));
    const { startLiveKitEgress } = await import('./livekit');
    await expect(startLiveKitEgress('live_1', 'rtmps://example/live/key')).resolves.toBe('EG_1');
    expect(startRoomCompositeEgress).toHaveBeenCalled();
  });
});
