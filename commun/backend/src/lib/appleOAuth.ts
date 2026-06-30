import crypto from 'node:crypto';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_ISSUER = 'https://appleid.apple.com';

interface AppleJwk {
  kty: string;
  kid: string;
  use?: string;
  alg: string;
  n: string;
  e: string;
}

let jwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
let clientSecretCache: { value: string; expiresAt: number } | null = null;

export function isAppleOAuthConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID?.trim() &&
      process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_CALLBACK_URL?.trim() &&
      loadApplePrivateKeyOrNull()
  );
}

function loadApplePrivateKeyOrNull(): string | null {
  const inline = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (inline?.includes('BEGIN PRIVATE KEY')) return inline;
  const keyPath = process.env.APPLE_PRIVATE_KEY_PATH?.trim();
  if (keyPath && fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  return null;
}

function loadApplePrivateKey(): string {
  const key = loadApplePrivateKeyOrNull();
  if (!key) throw new Error('Apple private key not configured');
  return key;
}

function buildAppleClientSecret(): string {
  const now = Date.now();
  if (clientSecretCache && clientSecretCache.expiresAt > now + 60_000) {
    return clientSecretCache.value;
  }

  const teamId = process.env.APPLE_TEAM_ID!.trim();
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const keyId = process.env.APPLE_KEY_ID!.trim();
  const privateKey = loadApplePrivateKey();

  const value = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '5m',
    issuer: teamId,
    audience: APPLE_ISSUER,
    subject: clientId,
    keyid: keyId,
  });

  clientSecretCache = { value, expiresAt: now + 4 * 60_000 };
  return value;
}

async function fetchAppleJwks(): Promise<AppleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 3_600_000) {
    return jwksCache.keys;
  }
  const res = await fetch(APPLE_KEYS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Apple JWKS HTTP ${res.status}`);
  const data = (await res.json()) as { keys?: AppleJwk[] };
  const keys = data.keys ?? [];
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function jwkToPem(jwk: AppleJwk): string {
  const keyObject = crypto.createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk',
  });
  return keyObject.export({ type: 'spki', format: 'pem' }) as string;
}

export async function verifyAppleIdToken(
  idToken: string
): Promise<{ sub: string; email?: string }> {
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Invalid Apple id_token');
  }

  const keys = await fetchAppleJwks();
  const jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) throw new Error('Apple JWKS key not found');

  const payload = jwt.verify(idToken, jwkToPem(jwk), {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: clientId,
  }) as { sub?: string; email?: string };

  if (!payload.sub) throw new Error('Apple id_token missing sub');
  return { sub: payload.sub, email: payload.email };
}

export interface AppleAuthProfile {
  sub: string;
  email: string;
  name: string;
}

export function parseAppleUserName(userJson: unknown): string {
  if (typeof userJson !== 'string' || !userJson.trim()) return '';
  try {
    const parsed = JSON.parse(userJson) as {
      name?: { firstName?: string; lastName?: string };
    };
    const parts = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean);
    return parts.join(' ').trim();
  } catch {
    return '';
  }
}

export async function exchangeAppleAuthCode(code: string): Promise<AppleAuthProfile> {
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const redirectUri = process.env.APPLE_CALLBACK_URL!.trim();
  const clientSecret = buildAppleClientSecret();

  const res = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.id_token) {
    throw new Error(json.error_description || json.error || 'Apple token exchange failed');
  }

  const { sub, email } = await verifyAppleIdToken(json.id_token);
  if (!email) {
    throw new Error('Apple profile has no email — authorize with email scope');
  }

  return { sub, email, name: '' };
}
