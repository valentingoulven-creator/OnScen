import { AccessToken, EgressClient, RoomServiceClient } from 'livekit-server-sdk';
import { StreamOutput, StreamProtocol } from '@livekit/protocol';
import {
  clearLiveKitEgressId,
  getLiveKitEgressId,
  setLiveKitEgressId,
} from './livekitEgressStore';

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
    ttl: '2h',
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

function buildRoomServiceClient(): RoomServiceClient {
  const url = getLiveKitUrl();
  const apiKey = getLiveKitApiKey();
  const apiSecret = getLiveKitApiSecret();
  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit non configuré (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).');
  }
  return new RoomServiceClient(url, apiKey, apiSecret);
}

/**
 * Supprime la room LiveKit d'un live terminé : déconnecte immédiatement tous
 * les participants encore connectés et invalide la room (un token déjà émis
 * ne permet plus de rejoindre un live actif — la room sera vide si recréée).
 * No-op silencieux si LiveKit n'est pas configuré ou si la room n'existe déjà plus.
 */
export async function deleteLiveKitRoom(liveId: string): Promise<void> {
  if (!isLiveKitConfigured()) return;
  try {
    const client = buildRoomServiceClient();
    await client.deleteRoom(liveKitRoomName(liveId));
  } catch (err) {
    console.warn('[livekit] deleteRoom failed', liveId, err instanceof Error ? err.message : err);
  }
}

/** Vérifie la connectivité au control plane LiveKit (utilisé par /health). */
export async function pingLiveKit(): Promise<boolean> {
  if (!isLiveKitConfigured()) return true; // non configuré = non bloquant
  try {
    const client = buildRoomServiceClient();
    await client.listRooms();
    return true;
  } catch (err) {
    console.warn('[livekit] health ping failed', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Returns the active egress ID for a live, or undefined if none. */
export { getLiveKitEgressId } from './livekitEgressStore';

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
  await setLiveKitEgressId(liveId, egressId);
  return egressId;
}

/** Stop the active egress for a live (no-op if none). */
export async function stopLiveKitEgressIfActive(liveId: string): Promise<boolean> {
  const egressId = await getLiveKitEgressId(liveId);
  if (!egressId) return false;
  try {
    const client = buildEgressClient();
    await client.stopEgress(egressId);
  } catch (err) {
    console.warn('[livekit] stop egress failed', liveId, err instanceof Error ? err.message : err);
  } finally {
    await clearLiveKitEgressId(liveId);
  }
  return true;
}

/** Stop the active egress for a live (throws if none). */
export async function stopLiveKitEgress(liveId: string): Promise<void> {
  const stopped = await stopLiveKitEgressIfActive(liveId);
  if (!stopped) throw new Error('Aucun egress actif pour ce live.');
}
