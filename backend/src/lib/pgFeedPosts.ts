import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { FeedPost, FeedPostComment } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertFeedPost(dbExec: DbExec, post: FeedPost): Promise<void> {
  await dbExec.query(
    `INSERT INTO feed_posts (id, user_id, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, payload = EXCLUDED.payload`,
    [post.id, post.userId, JSON.stringify(post)]
  );
}

export async function deleteFeedPostFromPg(dbExec: DbExec, postId: string): Promise<void> {
  await dbExec.query('DELETE FROM feed_post_likes WHERE post_id = $1', [postId]);
  await dbExec.query('DELETE FROM feed_post_comments WHERE post_id = $1', [postId]);
  await dbExec.query('DELETE FROM feed_post_favorites WHERE post_id = $1', [postId]);
  await dbExec.query('DELETE FROM feed_posts WHERE id = $1', [postId]);
}

export async function upsertFeedPostLike(
  dbExec: DbExec,
  postId: string,
  userId: string
): Promise<void> {
  await dbExec.query(
    `INSERT INTO feed_post_likes (post_id, user_id) VALUES ($1, $2)
     ON CONFLICT (post_id, user_id) DO NOTHING`,
    [postId, userId]
  );
}

export async function deleteFeedPostLikeFromPg(
  dbExec: DbExec,
  postId: string,
  userId: string
): Promise<void> {
  await dbExec.query('DELETE FROM feed_post_likes WHERE post_id = $1 AND user_id = $2', [
    postId,
    userId,
  ]);
}

export async function upsertFeedPostComment(dbExec: DbExec, comment: FeedPostComment): Promise<void> {
  await dbExec.query(
    `INSERT INTO feed_post_comments (id, post_id, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET post_id = EXCLUDED.post_id, payload = EXCLUDED.payload`,
    [comment.id, comment.postId, JSON.stringify(comment)]
  );
}

export async function upsertFeedPostFavorite(
  dbExec: DbExec,
  userId: string,
  postId: string
): Promise<void> {
  await dbExec.query(
    `INSERT INTO feed_post_favorites (user_id, post_id) VALUES ($1, $2)
     ON CONFLICT (user_id, post_id) DO NOTHING`,
    [userId, postId]
  );
}

export async function deleteFeedPostFavoriteFromPg(
  dbExec: DbExec,
  userId: string,
  postId: string
): Promise<void> {
  await dbExec.query('DELETE FROM feed_post_favorites WHERE user_id = $1 AND post_id = $2', [
    userId,
    postId,
  ]);
}

export function schedulePersistFeedPostToPg(post: FeedPost): void {
  if (!isPostgresEnabled()) return;
  void upsertFeedPost(getPool(), post).catch((e) => {
    console.error('[pgFeedPosts] Échec upsert publication PostgreSQL:', e);
  });
}

export function scheduleDeleteFeedPostFromPg(postId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteFeedPostFromPg(getPool(), postId).catch((e) => {
    console.error('[pgFeedPosts] Échec suppression publication PostgreSQL:', e);
  });
}

export function schedulePersistFeedPostLike(postId: string, userId: string, liked: boolean): void {
  if (!isPostgresEnabled()) return;
  const pool = getPool();
  const job = liked
    ? upsertFeedPostLike(pool, postId, userId)
    : deleteFeedPostLikeFromPg(pool, postId, userId);
  void job.catch((e) => {
    console.error('[pgFeedPosts] Échec persistance like publication PostgreSQL:', e);
  });
}

export function schedulePersistFeedPostComment(comment: FeedPostComment): void {
  if (!isPostgresEnabled()) return;
  void upsertFeedPostComment(getPool(), comment).catch((e) => {
    console.error('[pgFeedPosts] Échec persistance commentaire publication PostgreSQL:', e);
  });
}

export function schedulePersistFeedPostFavorite(
  userId: string,
  postId: string,
  favorited: boolean
): void {
  if (!isPostgresEnabled()) return;
  const pool = getPool();
  const job = favorited
    ? upsertFeedPostFavorite(pool, userId, postId)
    : deleteFeedPostFavoriteFromPg(pool, userId, postId);
  void job.catch((e) => {
    console.error('[pgFeedPosts] Échec persistance favori publication PostgreSQL:', e);
  });
}

export async function countFeedPostsInPg(): Promise<number> {
  if (!isPostgresEnabled()) return 0;
  const res = await getPool().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM feed_posts');
  return Number(res.rows[0]?.count ?? 0);
}
