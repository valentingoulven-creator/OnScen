import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { User } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertUser(db: DbExec, user: User): Promise<void> {
  await db.query(
    `INSERT INTO users (id, email, username, payload) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       username = EXCLUDED.username,
       payload = EXCLUDED.payload`,
    [user.id, user.email?.toLowerCase() ?? null, user.username ?? null, JSON.stringify(user)]
  );
}

export async function deleteUserFromPg(db: DbExec, userId: string): Promise<void> {
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function countUsersInPg(db: DbExec): Promise<number> {
  const res = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  return Number(res.rows[0]?.count ?? 0);
}

/** Écriture immédiate d'un utilisateur (inscription, profil, mot de passe). */
export async function persistUserToPg(user: User): Promise<void> {
  if (!isPostgresEnabled()) return;
  await upsertUser(getPool(), user);
}

/** Suppression explicite d'un compte en PostgreSQL (jamais de DELETE global). */
export async function removeUserFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteUserFromPg(getPool(), userId);
}

export function schedulePersistUserToPg(user: User): void {
  if (!isPostgresEnabled()) return;
  void persistUserToPg(user).catch((e) => {
    console.error('[pgUsers] Échec upsert utilisateur PostgreSQL:', e);
  });
}

export function scheduleRemoveUserFromPg(userId: string): void {
  if (!isPostgresEnabled()) return;
  void removeUserFromPg(userId).catch((e) => {
    console.error('[pgUsers] Échec suppression utilisateur PostgreSQL:', e);
  });
}
