type RedisKv = {
  isOpen: boolean;
  connect: () => Promise<unknown>;
  setEx: (key: string, seconds: number, value: string) => Promise<string>;
  get: (key: string) => Promise<string | null>;
  getDel: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
};

let client: RedisKv | null = null;
let initPromise: Promise<void> | null = null;

/** Client Redis partagé (optionnel) — rate limits, OAuth state, challenges, etc. */
export async function getOptionalRedis(): Promise<RedisKv | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;
  if (client?.isOpen) return client;
  if (initPromise) {
    await initPromise;
    return client;
  }

  initPromise = (async () => {
    try {
      const { createClient } = await import('redis');
      const c = createClient({ url: redisUrl });
      await c.connect();
      client = c as unknown as RedisKv;
    } catch (err) {
      console.warn('[redis] Connexion impossible — fallback mémoire locale:', err);
      client = null;
    }
  })();

  await initPromise;
  return client;
}

export async function redisSetJsonEx(key: string, ttlSec: number, value: unknown): Promise<boolean> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return false;
  await redis.setEx(key, ttlSec, JSON.stringify(value));
  return true;
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisGetDelJson<T>(key: string): Promise<T | null> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return null;
  const raw = await redis.getDel(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return false;
  await redis.del(key);
  return true;
}

export async function redisSetEx(key: string, ttlSec: number, value: string): Promise<boolean> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return false;
  await redis.setEx(key, ttlSec, value);
  return true;
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return null;
  return redis.get(key);
}

/**
 * Sliding window counter. Returns current count after increment, or -1 if Redis unavailable.
 * When peek=true, reads without incrementing (uses GET + parse, approximate).
 */
export async function redisIncrWithWindow(
  key: string,
  windowSec: number,
  _max: number,
  opts?: { peek?: boolean }
): Promise<number> {
  const redis = await getOptionalRedis();
  if (!redis?.isOpen) return -1;

  if (opts?.peek) {
    const raw = await redis.get(key);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, Math.max(1, windowSec));
  }
  return count;
}

/** Reset shared client (tests). */
export function resetOptionalRedisForTests(): void {
  client = null;
  initPromise = null;
}
