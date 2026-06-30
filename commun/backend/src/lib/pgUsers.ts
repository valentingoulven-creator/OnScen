import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { User } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertUser(db: DbExec, user: User): Promise<void> {
  // Fix #6: stocker le hash bcrypt dans une colonne dédiée, hors du JSONB payload
  // (évite l'exposition dans les logs PG, les exports JSONB, et les snapshots pgStore)
  const { passwordHash, ...payloadWithoutHash } = user;
  await db.query(
    `INSERT INTO users (id, email, username, password_hash, latitude, longitude, geom, payload)
     VALUES (
       $1, $2, $3, $4, $5::double precision, $6::double precision,
       CASE WHEN $5::double precision IS NOT NULL AND $6::double precision IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint($6::double precision, $5::double precision), 4326)::geography
         ELSE NULL
       END,
       $7::jsonb
     )
     ON CONFLICT (id) DO UPDATE SET
       email         = EXCLUDED.email,
       username      = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash,
       latitude      = EXCLUDED.latitude,
       longitude     = EXCLUDED.longitude,
       geom          = EXCLUDED.geom,
       payload       = EXCLUDED.payload`,
    [
      user.id,
      user.email?.toLowerCase() ?? null,
      user.username ?? null,
      passwordHash ?? null,
      user.latitude ?? null,
      user.longitude ?? null,
      JSON.stringify(payloadWithoutHash),
    ]
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
