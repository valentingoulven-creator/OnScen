import crypto from 'node:crypto';
import { redisGetDelJson, redisGetJson, redisSetJsonEx } from './optionalRedis';

const EXCHANGE_TTL_MS = 5 * 60 * 1000;
const EXCHANGE_TTL_SEC = Math.ceil(EXCHANGE_TTL_MS / 1000);

interface OAuthExchangeEntry {
  userId: string;
  isNew: boolean;
  expiresAt: number;
}

const oauthExchangeCodes = new Map<string, OAuthExchangeEntry>();

function redisKey(code: string): string {
  return `oauth:exchange:${code}`;
}

function pruneExchangeCodes(): void {
  const now = Date.now();
  for (const [code, entry] of oauthExchangeCodes.entries()) {
    if (now > entry.expiresAt) oauthExchangeCodes.delete(code);
  }
}

export function createOAuthExchangeCode(userId: string, isNew: boolean): string {
  pruneExchangeCodes();
  const code = crypto.randomBytes(32).toString('hex');
  const entry: OAuthExchangeEntry = {
    userId,
    isNew,
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  };
  oauthExchangeCodes.set(code, entry);
  void redisSetJsonEx(redisKey(code), EXCHANGE_TTL_SEC, entry);
  return code;
}

export async function peekOAuthExchangeCode(code: string): Promise<OAuthExchangeEntry | null> {
  pruneExchangeCodes();
  const fromRedis = await redisGetJson<OAuthExchangeEntry>(redisKey(code));
  if (fromRedis && Date.now() <= fromRedis.expiresAt) return fromRedis;

  const entry = oauthExchangeCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry;
}

export async function consumeOAuthExchangeCode(code: string): Promise<OAuthExchangeEntry | null> {
  const fromRedis = await redisGetDelJson<OAuthExchangeEntry>(redisKey(code));
  if (fromRedis && Date.now() <= fromRedis.expiresAt) {
    oauthExchangeCodes.delete(code);
    return fromRedis;
  }

  const entry = await peekOAuthExchangeCode(code);
  if (!entry) return null;
  oauthExchangeCodes.delete(code);
  return entry;
}

/** Sync peek for legacy callers — memory only. */
export function peekOAuthExchangeCodeSync(code: string): OAuthExchangeEntry | null {
  pruneExchangeCodes();
  const entry = oauthExchangeCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry;
}
