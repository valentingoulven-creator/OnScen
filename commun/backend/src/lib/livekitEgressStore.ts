import { redisDel, redisGet, redisSetEx } from './optionalRedis';

const EGRESS_TTL_SEC = 6 * 60 * 60;

/** In-memory L1 cache — synced with Redis when available. */
const activeEgresses = new Map<string, string>();

function egressRedisKey(liveId: string): string {
  return `livekit:egress:${liveId}`;
}

export async function getLiveKitEgressId(liveId: string): Promise<string | undefined> {
  const cached = activeEgresses.get(liveId);
  if (cached) return cached;

  const fromRedis = await redisGet(egressRedisKey(liveId));
  if (fromRedis) {
    activeEgresses.set(liveId, fromRedis);
    return fromRedis;
  }
  return undefined;
}

export async function setLiveKitEgressId(liveId: string, egressId: string): Promise<void> {
  activeEgresses.set(liveId, egressId);
  await redisSetEx(egressRedisKey(liveId), EGRESS_TTL_SEC, egressId);
}

export async function clearLiveKitEgressId(liveId: string): Promise<void> {
  activeEgresses.delete(liveId);
  await redisDel(egressRedisKey(liveId));
}

/** Sync read from L1 only (hot path after local write). */
export function getLiveKitEgressIdSync(liveId: string): string | undefined {
  return activeEgresses.get(liveId);
}
