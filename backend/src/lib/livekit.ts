import { AccessToken, EgressClient } from 'livekit-server-sdk';
import { StreamOutput, StreamProtocol } from '@livekit/protocol';

/** In-memory map of liveId → active egressId. */
const activeEgresses = new Map<string, string>();

export function isLiveKitConfigured(): boolean {
  return Boolean(
    getLiveKitUrl() && getLiveKitApiKey() && getLiveKitApiSecret()
  );
}

export function getLiveKitUrl(): string {
  return (process.env.LIVEKIT_URL ?? '').trim();
}

function getLiveKitApiKey(): string {
  return (process.env.LIVEKIT_API_KEY ?? '').trim();
}

function getLiveKitApiSecret(): string {
  return (process.env.LIVEKIT_API_SECRET ?? '').trim();
}

export function liveKitRoomName(liveId: string): string {
  return `live_${liveId}`;
}

export async function createLiveKitToken(opts: {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  canPublish: boolean;
}): Promise<string> {
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();
  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit non configuré (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).');
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.participantIdentity,
    name: opts.participantName,
    ttl: '6h',
  });

  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: opts.canPublish,
    canSubscribe: true,
    canPublishData: opts.canPublish,
  });

  return await at.toJwt();
}

function buildEgressClient(): EgressClient {
  const url = getLiveKitUrl();
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();
  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit non configuré (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).');
  }
  return new EgressClient(url, apiKey, apiSecret);
}

/** Returns the active egress ID for a live, or undefined if none. */
export function getLiveKitEgressId(liveId: string): string | undefined {
  return activeEgresses.get(liveId);
}

/**
 * Start a RoomCompositeEgress that pushes LiveKit room audio+video to an RTMP URL
 * (e.g. Cloudflare Stream ingest). Returns the egressId.
 */
export async function startLiveKitEgress(liveId: string, rtmpUrl: string): Promise<string> {
  const client = buildEgressClient();
  const roomName = liveKitRoomName(liveId);

  const output = new StreamOutput({
    protocol: StreamProtocol.RTMP,
    urls: [rtmpUrl],
  });

  const info = await client.startRoomCompositeEgress(roomName, output);
  const egressId = info.egressId;
  activeEgresses.set(liveId, egressId);
  return egressId;
}

/** Stop the active egress for a live (no-op if none). */
export async function stopLiveKitEgress(liveId: string): Promise<void> {
  const egressId = activeEgresses.get(liveId);
  if (!egressId) throw new Error('Aucun egress actif pour ce live.');
  const client = buildEgressClient();
  await client.stopEgress(egressId);
  activeEgresses.delete(liveId);
}
