/** Per-user chat flood protection (salon, live, DM). Redis when available — cluster-safe. */

import { redisIncrWithWindow } from './optionalRedis';

const WINDOW_MS = 10_000;
const WINDOW_SEC = Math.ceil(WINDOW_MS / 1000);
const MAX_MESSAGES = 12;

const buckets = new Map<string, { count: number; resetAt: number }>();

let lastCleanup = 0;

function maybeCleanup(now: number): void {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

function memoryCheck(userId: string): boolean {
  const now = Date.now();
  maybeCleanup(now);
  let bucket = buckets.get(userId);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(userId, bucket);
  }
  bucket.count += 1;
  return bucket.count <= MAX_MESSAGES;
}

/** Returns true when the message is allowed; false when rate-limited. */
export async function checkChatRateLimit(userId: string): Promise<boolean> {
  const redisCount = await redisIncrWithWindow(`chat:rl:${userId}`, WINDOW_SEC, MAX_MESSAGES);
  if (redisCount >= 0) return redisCount <= MAX_MESSAGES;
  return memoryCheck(userId);
}

/** @deprecated Sync alias — prefer async checkChatRateLimit. */
export function checkChatRateLimitSync(userId: string): boolean {
  return memoryCheck(userId);
}

export const CHAT_RATE_LIMIT_MAX = MAX_MESSAGES;
export const CHAT_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
