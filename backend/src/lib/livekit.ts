import { AccessToken } from 'livekit-server-sdk';

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
