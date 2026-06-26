import type { IncrementResponse, Options, Store } from 'express-rate-limit';

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

let redisClient: {
  isOpen: boolean;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
  pTTL: (key: string) => Promise<number>;
  decr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
} | null = null;

let initPromise: Promise<void> | null = null;

function memoryIncrement(key: string, windowMs: number): IncrementResponse {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return { totalHits: bucket.count, resetTime: new Date(bucket.resetAt) };
}

function memoryDecrement(key: string): void {
  const bucket = memoryBuckets.get(key);
  if (bucket && bucket.count > 0) bucket.count -= 1;
}

function memoryReset(key: string): void {
  memoryBuckets.delete(key);
}

/**
 * Connecte Redis pour les limiteurs express-rate-limit (partagé entre workers PM2).
 * Appelé depuis bootstrap avant le chargement de server.ts en production.
 */
export async function initRateLimitStore(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return;
  if (redisClient?.isOpen) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      const { createClient } = await import('redis');
      const client = createClient({ url: redisUrl });
      await client.connect();
      redisClient = client;
      console.log('[rate-limit] Redis store actif — limites partagées multi-workers');
    } catch (err) {
      console.warn(
        '[rate-limit] REDIS_URL défini mais connexion impossible — limiteurs en mémoire locale:',
        err
      );
      redisClient = null;
    }
  })();

  await initPromise;
}

/** Store hybride : Redis si disponible, sinon mémoire locale (msdev / fallback). */
export function createRateLimitStore(prefix: string): Store {
  let windowMs = 60_000;

  return {
    init(options: Options) {
      windowMs = options.windowMs;
    },
    async increment(key: string): Promise<IncrementResponse> {
      const fullKey = `rl:${prefix}:${key}`;
      if (redisClient?.isOpen) {
        const totalHits = await redisClient.incr(fullKey);
        if (totalHits === 1) {
          await redisClient.expire(fullKey, Math.max(1, Math.ceil(windowMs / 1000)));
        }
        const ttlMs = await redisClient.pTTL(fullKey);
        const resetTime =
          ttlMs > 0 ? new Date(Date.now() + ttlMs) : new Date(Date.now() + windowMs);
        return { totalHits, resetTime };
      }
      return memoryIncrement(fullKey, windowMs);
    },
    async decrement(key: string): Promise<void> {
      const fullKey = `rl:${prefix}:${key}`;
      if (redisClient?.isOpen) {
        await redisClient.decr(fullKey);
        return;
      }
      memoryDecrement(fullKey);
    },
    async resetKey(key: string): Promise<void> {
      const fullKey = `rl:${prefix}:${key}`;
      if (redisClient?.isOpen) {
        await redisClient.del(fullKey);
        return;
      }
      memoryReset(fullKey);
    },
  };
}
