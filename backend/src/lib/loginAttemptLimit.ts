/** Per-email login brute-force protection (complements IP-based authLimiter). */

import { redisIncrWithWindow } from './optionalRedis';

const WINDOW_SEC = 15 * 60;
const MAX_FAILURES = 10;

type MemoryBucket = { count: number; resetAt: number };
const memoryFailures = new Map<string, MemoryBucket>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function memoryIsBlocked(key: string): boolean {
  const bucket = memoryFailures.get(key);
  if (!bucket) return false;
  if (Date.now() >= bucket.resetAt) {
    memoryFailures.delete(key);
    return false;
  }
  return bucket.count >= MAX_FAILURES;
}

function memoryRecordFailure(key: string): void {
  const now = Date.now();
  let bucket = memoryFailures.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_SEC * 1000 };
    memoryFailures.set(key, bucket);
  }
  bucket.count += 1;
}

function memoryClear(key: string): void {
  memoryFailures.delete(key);
}

export async function isLoginBlocked(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  if (!key) return false;

  const redisCount = await redisIncrWithWindow(`login:fail:${key}`, WINDOW_SEC, MAX_FAILURES, {
    peek: true,
  });
  if (redisCount >= 0) return redisCount >= MAX_FAILURES;

  return memoryIsBlocked(key);
}

export async function recordLoginFailure(email: string): Promise<void> {
  const key = normalizeEmail(email);
  if (!key) return;

  const redisCount = await redisIncrWithWindow(`login:fail:${key}`, WINDOW_SEC, MAX_FAILURES);
  if (redisCount >= 0) return;

  memoryRecordFailure(key);
}

export async function clearLoginFailures(email: string): Promise<void> {
  const key = normalizeEmail(email);
  if (!key) return;
  memoryClear(key);
  // Redis key expires naturally via TTL on increment window.
}
