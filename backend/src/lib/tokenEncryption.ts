import crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev') {
      return crypto.createHash('sha256').update('msdev-dev-only-token-key').digest();
    }
    throw new Error('ENCRYPTION_KEY or JWT_SECRET required for token encryption');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/** Chiffre un jeton OAuth au repos (AES-256-GCM). */
export function encryptToken(plain: string): string {
  if (!plain || plain.startsWith(ENC_PREFIX)) return plain;
  if (plain.startsWith('mock_') || plain.startsWith('legacy_')) return plain;
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}

/** Déchiffre un jeton ; retourne la valeur en clair si non chiffrée (migration). */
export function decryptToken(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const payload = stored.slice(ENC_PREFIX.length);
  const [ivB64, dataB64, tagB64] = payload.split('.');
  if (!ivB64 || !dataB64 || !tagB64) return undefined;
  try {
    const key = deriveKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}

export function encryptPlatformTokens<T extends { accessToken?: string; refreshToken?: string }>(
  account: T
): T {
  return {
    ...account,
    accessToken: account.accessToken ? encryptToken(account.accessToken) : account.accessToken,
    refreshToken: account.refreshToken ? encryptToken(account.refreshToken) : account.refreshToken,
  };
}

export function decryptPlatformTokens<T extends { accessToken?: string; refreshToken?: string }>(
  account: T
): T {
  return {
    ...account,
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptToken(account.refreshToken),
  };
}
