import { getPool, isPostgresEnabled } from '../db/pool';

export interface WebAuthnCredential {
  id: number;
  userId: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[] | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: Date;
}

// ── In-memory fallback for msdev / development (no Postgres) ─────────────────
const devStore = new Map<string, WebAuthnCredential[]>();
let devIdSeq = 1;

export async function listCredentialsForUser(userId: string): Promise<WebAuthnCredential[]> {
  if (!isPostgresEnabled()) {
    return devStore.get(userId) ?? [];
  }
  const pool = getPool();
  const { rows } = await pool.query<{
    id: number;
    user_id: string;
    credential_id: string;
    public_key: Buffer;
    counter: string;
    transports: string[] | null;
    device_type: string | null;
    backed_up: boolean;
    created_at: Date;
  }>(
    `SELECT id, user_id, credential_id, public_key, counter, transports,
            device_type, backed_up, created_at
     FROM webauthn_credentials
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    credentialId: r.credential_id,
    publicKey: r.public_key,
    counter: Number(r.counter),
    transports: r.transports,
    deviceType: r.device_type,
    backedUp: r.backed_up,
    createdAt: r.created_at,
  }));
}

export async function findCredentialById(credentialId: string): Promise<WebAuthnCredential | null> {
  if (!isPostgresEnabled()) {
    for (const creds of devStore.values()) {
      const found = creds.find((c) => c.credentialId === credentialId);
      if (found) return found;
    }
    return null;
  }
  const pool = getPool();
  const { rows } = await pool.query<{
    id: number;
    user_id: string;
    credential_id: string;
    public_key: Buffer;
    counter: string;
    transports: string[] | null;
    device_type: string | null;
    backed_up: boolean;
    created_at: Date;
  }>(
    `SELECT id, user_id, credential_id, public_key, counter, transports,
            device_type, backed_up, created_at
     FROM webauthn_credentials
     WHERE credential_id = $1`,
    [credentialId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    userId: r.user_id,
    credentialId: r.credential_id,
    publicKey: r.public_key,
    counter: Number(r.counter),
    transports: r.transports,
    deviceType: r.device_type,
    backedUp: r.backed_up,
    createdAt: r.created_at,
  };
}

export async function saveCredential(
  cred: Omit<WebAuthnCredential, 'id' | 'createdAt'>
): Promise<WebAuthnCredential> {
  if (!isPostgresEnabled()) {
    const id = devIdSeq++;
    const now = new Date();
    const record: WebAuthnCredential = { ...cred, id, createdAt: now };
    const existing = devStore.get(cred.userId) ?? [];
    devStore.set(cred.userId, [...existing, record]);
    return record;
  }
  const pool = getPool();
  const { rows } = await pool.query<{ id: number; created_at: Date }>(
    `INSERT INTO webauthn_credentials
       (user_id, credential_id, public_key, counter, transports, device_type, backed_up)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING id, created_at`,
    [
      cred.userId,
      cred.credentialId,
      cred.publicKey,
      cred.counter,
      JSON.stringify(cred.transports ?? []),
      cred.deviceType,
      cred.backedUp,
    ]
  );
  return { ...cred, id: rows[0].id, createdAt: rows[0].created_at };
}

export async function updateCredentialCounter(credentialId: string, newCounter: number): Promise<void> {
  if (!isPostgresEnabled()) {
    for (const [userId, creds] of devStore.entries()) {
      const idx = creds.findIndex((c) => c.credentialId === credentialId);
      if (idx !== -1) {
        const updated = { ...creds[idx], counter: newCounter };
        devStore.set(userId, [...creds.slice(0, idx), updated, ...creds.slice(idx + 1)]);
        return;
      }
    }
    return;
  }
  const pool = getPool();
  await pool.query(
    'UPDATE webauthn_credentials SET counter = $1 WHERE credential_id = $2',
    [newCounter, credentialId]
  );
}

export async function deleteCredential(credentialId: string, userId: string): Promise<boolean> {
  if (!isPostgresEnabled()) {
    const creds = devStore.get(userId) ?? [];
    const idx = creds.findIndex((c) => c.credentialId === credentialId);
    if (idx === -1) return false;
    devStore.set(userId, [...creds.slice(0, idx), ...creds.slice(idx + 1)]);
    return true;
  }
  const pool = getPool();
  const { rowCount } = await pool.query(
    'DELETE FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2',
    [credentialId, userId]
  );
  return (rowCount ?? 0) > 0;
}
