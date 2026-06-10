import crypto from 'node:crypto';

const EXCHANGE_TTL_MS = 5 * 60 * 1000;

interface OAuthExchangeEntry {
  userId: string;
  isNew: boolean;
  expiresAt: number;
}

const oauthExchangeCodes = new Map<string, OAuthExchangeEntry>();

function pruneExchangeCodes(): void {
  const now = Date.now();
  for (const [code, entry] of oauthExchangeCodes.entries()) {
    if (now > entry.expiresAt) oauthExchangeCodes.delete(code);
  }
}

export function createOAuthExchangeCode(userId: string, isNew: boolean): string {
  pruneExchangeCodes();
  const code = crypto.randomBytes(32).toString('hex');
  oauthExchangeCodes.set(code, {
    userId,
    isNew,
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  });
  return code;
}

export function peekOAuthExchangeCode(code: string): OAuthExchangeEntry | null {
  pruneExchangeCodes();
  const entry = oauthExchangeCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry;
}

export function consumeOAuthExchangeCode(code: string): OAuthExchangeEntry | null {
  const entry = peekOAuthExchangeCode(code);
  if (!entry) return null;
  oauthExchangeCodes.delete(code);
  return entry;
}
