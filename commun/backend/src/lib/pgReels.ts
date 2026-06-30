import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type ReelComment, type UserReel } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

/** Colonne `visibility` PostgreSQL — exporté pour tests unitaires. */
export function reelPgVisibility(reel: UserReel): 'public' | 'private' {
  return reel.visibility === 'private' ? 'private' : 'public';
}

export async function upsertReel(dbExec: DbExec, reel: UserReel): Promise<void> {
  const visibility = reelPgVisibility(reel);
  await dbExec.query(
    `INSERT INTO user_reels (id, author_id, created_at, visibility, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       author_id = EXCLUDED.author_id,
       created_at = EXCLUDED.created_at,
       visibility = EXCLUDED.visibility,
       payload = EXCLUDED.payload`,
    [reel.id, reel.authorId, reel.createdAt, visibility, JSON.stringify(reel)]
  );
}

export async function deleteReelFromPg(dbExec: DbExec, reelId: string): Promise<void> {
  await dbExec.query('DELETE FROM reel_likes WHERE reel_id = $1', [reelId]);
  await dbExec.query('DELETE FROM reel_comments WHERE reel_id = $1', [reelId]);
  await dbExec.query('DELETE FROM reel_shares WHERE reel_id = $1', [reelId]);
  await dbExec.query('DELETE FROM reel_views WHERE reel_id = $1', [reelId]);
  await dbExec.query('DELETE FROM user_reels WHERE id = $1', [reelId]);
}

export async function deleteReelsByAuthorFromPg(dbExec: DbExec, authorId: string): Promise<void> {
  const res = await dbExec.query<{ id: string }>(
    'SELECT id FROM user_reels WHERE author_id = $1',
    [authorId]
  );
  for (const row of res.rows) {
    await deleteReelFromPg(dbExec, row.id);
  }
}

export async function deleteReelEngagementByUserFromPg(dbExec: DbExec, userId: string): Promise<void> {
  await dbExec.query('DELETE FROM reel_likes WHERE user_id = $1', [userId]);
  await dbExec.query('DELETE FROM reel_comments WHERE user_id = $1', [userId]);
  await dbExec.query('DELETE FROM reel_shares WHERE user_id = $1', [userId]);
  await dbExec.query('DELETE FROM reel_views WHERE user_id = $1', [userId]);
}

export async function upsertReelLike(dbExec: DbExec, reelId: string, userId: string): Promise<void> {
  await dbExec.query(
    `INSERT INTO reel_likes (reel_id, user_id) VALUES ($1, $2)
     ON CONFLICT (reel_id, user_id) DO NOTHING`,
    [reelId, userId]
  );
}

export async function deleteReelLikeFromPg(
  dbExec: DbExec,
  reelId: string,
  userId: string
): Promise<void> {
  await dbExec.query('DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2', [reelId, userId]);
}

export async function upsertReelComment(dbExec: DbExec, comment: ReelComment): Promise<void> {
  await dbExec.query(
    `INSERT INTO reel_comments (id, reel_id, user_id, created_at, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       reel_id = EXCLUDED.reel_id,
       user_id = EXCLUDED.user_id,
       created_at = EXCLUDED.created_at,
       payload = EXCLUDED.payload`,
    [comment.id, comment.reelId, comment.userId, comment.createdAt, JSON.stringify(comment)]
  );
}

export async function upsertReelShare(dbExec: DbExec, reelId: string, userId: string): Promise<void> {
  await dbExec.query(
    `INSERT INTO reel_shares (reel_id, user_id) VALUES ($1, $2)
     ON CONFLICT (reel_id, user_id) DO NOTHING`,
    [reelId, userId]
  );
}

export async function upsertReelView(dbExec: DbExec, reelId: string, userId: string): Promise<void> {
  await dbExec.query(
    `INSERT INTO reel_views (reel_id, user_id) VALUES ($1, $2)
     ON CONFLICT (reel_id, user_id) DO NOTHING`,
    [reelId, userId]
  );
}

export async function loadReelsFromPg(): Promise<{
  reels: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}> {
  const pool = getPool();
  const [reelsRes, likesRes, commentsRes, sharesRes, viewsRes] = await Promise.all([
    pool.query<{ payload: UserReel }>('SELECT payload FROM user_reels ORDER BY created_at DESC'),
    pool.query<{ reel_id: string; user_id: string }>('SELECT reel_id, user_id FROM reel_likes'),
    pool.query<{ payload: ReelComment }>('SELECT payload FROM reel_comments'),
    pool.query<{ reel_id: string; user_id: string }>('SELECT reel_id, user_id FROM reel_shares'),
    pool.query<{ reel_id: string; user_id: string }>('SELECT reel_id, user_id FROM reel_views'),
  ]);

  db.userReels.length = 0;
  for (const row of reelsRes.rows) {
    const reel = row.payload;
    if (reel?.id && reel.authorId) db.userReels.push(reel);
  }

  db.reelLikes.clear();
  for (const row of likesRes.rows) {
    if (!db.reelLikes.has(row.reel_id)) db.reelLikes.set(row.reel_id, new Set());
    db.reelLikes.get(row.reel_id)!.add(row.user_id);
  }

  db.reelComments.clear();
  for (const row of commentsRes.rows) {
    const comment = row.payload;
    if (!comment?.id || !comment.reelId) continue;
    const list = db.reelComments.get(comment.reelId) ?? [];
    list.push(comment);
    db.reelComments.set(comment.reelId, list);
  }

  db.reelShares.clear();
  for (const row of sharesRes.rows) {
    if (!db.reelShares.has(row.reel_id)) db.reelShares.set(row.reel_id, new Set());
    db.reelShares.get(row.reel_id)!.add(row.user_id);
  }

  db.reelViews.clear();
  for (const row of viewsRes.rows) {
    if (!db.reelViews.has(row.reel_id)) db.reelViews.set(row.reel_id, new Set());
    db.reelViews.get(row.reel_id)!.add(row.user_id);
  }

  return {
    reels: db.userReels.length,
    likes: likesRes.rows.length,
    comments: commentsRes.rows.length,
    shares: sharesRes.rows.length,
    views: viewsRes.rows.length,
  };
}

export async function persistReelToPg(reel: UserReel): Promise<void> {
  if (!isPostgresEnabled()) return;
  await upsertReel(getPool(), reel);
}

export async function removeReelFromPg(reelId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteReelFromPg(getPool(), reelId);
}

export async function removeReelsByAuthorFromPg(authorId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteReelsByAuthorFromPg(getPool(), authorId);
}

export async function removeReelEngagementByUserFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteReelEngagementByUserFromPg(getPool(), userId);
}

export function schedulePersistReelToPg(reel: UserReel): void {
  if (!isPostgresEnabled()) return;
  void persistReelToPg(reel).catch((e) => {
    console.error('[pgReels] Échec upsert reel PostgreSQL:', e);
  });
}

export function scheduleDeleteReelFromPg(reelId: string): void {
  if (!isPostgresEnabled()) return;
  void removeReelFromPg(reelId).catch((e) => {
    console.error('[pgReels] Échec suppression reel PostgreSQL:', e);
  });
}

export function scheduleDeleteReelsByAuthorFromPg(authorId: string): void {
  if (!isPostgresEnabled()) return;
  void removeReelsByAuthorFromPg(authorId).catch((e) => {
    console.error('[pgReels] Échec suppression reels auteur PostgreSQL:', e);
  });
}

export function scheduleDeleteReelEngagementByUserFromPg(userId: string): void {
  if (!isPostgresEnabled()) return;
  void removeReelEngagementByUserFromPg(userId).catch((e) => {
    console.error('[pgReels] Échec suppression engagement reel PostgreSQL:', e);
  });
}

export function schedulePersistReelLike(reelId: string, userId: string, liked: boolean): void {
  if (!isPostgresEnabled()) return;
  const pool = getPool();
  const job = liked
    ? upsertReelLike(pool, reelId, userId)
    : deleteReelLikeFromPg(pool, reelId, userId);
  void job.catch((e) => {
    console.error('[pgReels] Échec persistance like reel PostgreSQL:', e);
  });
}

export function schedulePersistReelComment(comment: ReelComment): void {
  if (!isPostgresEnabled()) return;
  void upsertReelComment(getPool(), comment).catch((e) => {
    console.error('[pgReels] Échec persistance commentaire reel PostgreSQL:', e);
  });
}

export function schedulePersistReelShare(reelId: string, userId: string): void {
  if (!isPostgresEnabled()) return;
  void upsertReelShare(getPool(), reelId, userId).catch((e) => {
    console.error('[pgReels] Échec persistance partage reel PostgreSQL:', e);
  });
}

export function schedulePersistReelView(reelId: string, userId: string): void {
  if (!isPostgresEnabled()) return;
  void upsertReelView(getPool(), reelId, userId).catch((e) => {
    console.error('[pgReels] Échec persistance vue reel PostgreSQL:', e);
  });
}
