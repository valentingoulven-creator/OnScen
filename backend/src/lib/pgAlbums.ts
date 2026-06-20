import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type UserAlbum } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertAlbum(dbExec: DbExec, album: UserAlbum): Promise<void> {
  await dbExec.query(
    `INSERT INTO user_albums (id, user_id, created_at, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       created_at = EXCLUDED.created_at,
       payload = EXCLUDED.payload`,
    [album.id, album.userId, album.createdAt, JSON.stringify(album)]
  );
}

export async function deleteAlbumFromPg(dbExec: DbExec, albumId: string): Promise<void> {
  await dbExec.query('DELETE FROM user_albums WHERE id = $1', [albumId]);
}

export async function deleteAlbumsByUserFromPg(dbExec: DbExec, userId: string): Promise<void> {
  await dbExec.query('DELETE FROM user_albums WHERE user_id = $1', [userId]);
}

export async function loadAlbumsFromPg(): Promise<{ albums: number }> {
  const pool = getPool();
  const res = await pool.query<{ payload: UserAlbum }>(
    'SELECT payload FROM user_albums ORDER BY created_at DESC'
  );

  db.albums.length = 0;
  for (const row of res.rows) {
    const album = row.payload;
    if (album?.id && album.userId) db.albums.push(album);
  }

  return { albums: db.albums.length };
}

export async function persistAlbumToPg(album: UserAlbum): Promise<void> {
  if (!isPostgresEnabled()) return;
  await upsertAlbum(getPool(), album);
}

export async function removeAlbumFromPg(albumId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteAlbumFromPg(getPool(), albumId);
}

export async function removeAlbumsByUserFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteAlbumsByUserFromPg(getPool(), userId);
}

export function schedulePersistAlbumToPg(album: UserAlbum): void {
  if (!isPostgresEnabled()) return;
  void persistAlbumToPg(album).catch((e) => {
    console.error('[pgAlbums] Échec upsert album PostgreSQL:', e);
  });
}

export function scheduleDeleteAlbumFromPg(albumId: string): void {
  if (!isPostgresEnabled()) return;
  void removeAlbumFromPg(albumId).catch((e) => {
    console.error('[pgAlbums] Échec suppression album PostgreSQL:', e);
  });
}

export function scheduleDeleteAlbumsByUserFromPg(userId: string): void {
  if (!isPostgresEnabled()) return;
  void removeAlbumsByUserFromPg(userId).catch((e) => {
    console.error('[pgAlbums] Échec suppression albums utilisateur PostgreSQL:', e);
  });
}
