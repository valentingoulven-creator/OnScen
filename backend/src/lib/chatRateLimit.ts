/** Per-user chat flood protection (salon, live, DM). In-memory — sufficient for single-node VPS. */

const WINDOW_MS = 10_000;
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

/** Returns true when the message is allowed; false when rate-limited. */
export function checkChatRateLimit(userId: string): boolean {
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
