import { redisGetDelJson, redisSetJsonEx } from './optionalRedis';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_TTL_SEC = Math.ceil(CHALLENGE_TTL_MS / 1000);

export interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}

const challengeStore = new Map<string, ChallengeEntry>();

function redisKey(key: string): string {
  return `webauthn:challenge:${key}`;
}

function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, entry] of challengeStore.entries()) {
    if (now > entry.expiresAt) challengeStore.delete(key);
  }
}

export async function storeWebAuthnChallenge(key: string, challenge: string): Promise<void> {
  pruneExpiredChallenges();
  const entry: ChallengeEntry = {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  };
  challengeStore.set(key, entry);
  await redisSetJsonEx(redisKey(key), CHALLENGE_TTL_SEC, entry);
}

export async function consumeWebAuthnChallenge(key: string): Promise<ChallengeEntry | null> {
  pruneExpiredChallenges();
  const fromRedis = await redisGetDelJson<ChallengeEntry>(redisKey(key));
  if (fromRedis) {
    challengeStore.delete(key);
    if (Date.now() > fromRedis.expiresAt) return null;
    return fromRedis;
  }

  const entry = challengeStore.get(key);
  challengeStore.delete(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry;
}

export function webAuthnChallengeStoreSize(): number {
  return challengeStore.size;
}

export const WEBAUTHN_CHALLENGE_MAX_ENTRIES = 5000;

export function pruneWebAuthnChallengesIfNeeded(): void {
  if (challengeStore.size > WEBAUTHN_CHALLENGE_MAX_ENTRIES) pruneExpiredChallenges();
}
