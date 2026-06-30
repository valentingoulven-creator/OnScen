import type { PoolClient } from 'pg';
import type { AppNotification } from '../models/schema';
import type { PersistedStore } from './storeCore';

/** Upsert feed tables then prune rows absent from the in-memory snapshot. */
export async function syncFeedTablesToPg(
  client: PoolClient,
  data: Pick<
    PersistedStore,
    'feedPosts' | 'feedPostLikes' | 'feedPostComments' | 'feedPostFavorites'
  >
): Promise<void> {
  const posts = data.feedPosts ?? [];
  const postIds = posts.map((p) => p.id);

  for (const post of posts) {
    await client.query(
      `INSERT INTO feed_posts (id, user_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, payload = EXCLUDED.payload`,
      [post.id, post.userId, JSON.stringify(post)]
    );
  }

  if (postIds.length) {
    await client.query('DELETE FROM feed_posts WHERE NOT (id = ANY($1::text[]))', [postIds]);
  } else {
    await client.query('DELETE FROM feed_posts');
  }

  const likePairs: Array<[string, string]> = [];
  for (const [postId, userIds] of Object.entries(data.feedPostLikes ?? {})) {
    for (const userId of userIds) {
      likePairs.push([postId, userId]);
    }
  }

  for (const [postId, userId] of likePairs) {
    await client.query(
      `INSERT INTO feed_post_likes (post_id, user_id) VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, userId]
    );
  }

  if (likePairs.length) {
    const flat = likePairs.flat();
    await client.query(
      `DELETE FROM feed_post_likes
       WHERE NOT EXISTS (
         SELECT 1 FROM unnest($1::text[], $2::text[]) AS t(post_id, user_id)
         WHERE feed_post_likes.post_id = t.post_id AND feed_post_likes.user_id = t.user_id
       )`,
      [flat.filter((_, i) => i % 2 === 0), flat.filter((_, i) => i % 2 === 1)]
    );
  } else {
    await client.query('DELETE FROM feed_post_likes');
  }

  const commentsById = new Map<
    string,
    NonNullable<PersistedStore['feedPostComments']>[string][number]
  >();
  for (const comments of Object.values(data.feedPostComments ?? {})) {
    for (const comment of comments) {
      if (comment?.id) commentsById.set(comment.id, comment);
    }
  }
  const commentIds = [...commentsById.keys()];

  for (const comment of commentsById.values()) {
    await client.query(
      `INSERT INTO feed_post_comments (id, post_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET post_id = EXCLUDED.post_id, payload = EXCLUDED.payload`,
      [comment.id, comment.postId, JSON.stringify(comment)]
    );
  }

  if (commentIds.length) {
    await client.query('DELETE FROM feed_post_comments WHERE NOT (id = ANY($1::text[]))', [commentIds]);
  } else {
    await client.query('DELETE FROM feed_post_comments');
  }

  const favPairs: Array<[string, string]> = [];
  for (const [userId, postIdsForUser] of Object.entries(data.feedPostFavorites ?? {})) {
    for (const postId of postIdsForUser) {
      favPairs.push([userId, postId]);
    }
  }

  for (const [userId, postId] of favPairs) {
    await client.query(
      `INSERT INTO feed_post_favorites (user_id, post_id) VALUES ($1, $2)
       ON CONFLICT (user_id, post_id) DO NOTHING`,
      [userId, postId]
    );
  }

  if (favPairs.length) {
    const userIds = favPairs.map(([u]) => u);
    const postIdsFav = favPairs.map(([, p]) => p);
    await client.query(
      `DELETE FROM feed_post_favorites
       WHERE NOT EXISTS (
         SELECT 1 FROM unnest($1::text[], $2::text[]) AS t(user_id, post_id)
         WHERE feed_post_favorites.user_id = t.user_id AND feed_post_favorites.post_id = t.post_id
       )`,
      [userIds, postIdsFav]
    );
  } else {
    await client.query('DELETE FROM feed_post_favorites');
  }
}

/** Upsert notifications then prune stale rows. */
export async function syncNotificationsToPg(
  client: PoolClient,
  notifications: AppNotification[]
): Promise<void> {
  const ids = notifications.map((n) => n.id);

  for (const n of notifications) {
    const payload: AppNotification = {
      id: n.id,
      recipientId: n.recipientId,
      senderId: n.senderId,
      senderName: n.senderName,
      senderAvatarUrl: n.senderAvatarUrl,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      matchId: n.matchId,
      liveId: n.liveId,
      salonId: n.salonId,
      peerUserId: n.peerUserId,
      groupId: n.groupId,
      postId: n.postId,
      reelId: n.reelId,
      supportMessageId: n.supportMessageId,
    };
    await client.query(
      `INSERT INTO notifications (id, recipient_id, sender_id, type, read, created_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         recipient_id = EXCLUDED.recipient_id,
         sender_id = EXCLUDED.sender_id,
         type = EXCLUDED.type,
         read = EXCLUDED.read,
         created_at = EXCLUDED.created_at,
         payload = EXCLUDED.payload`,
      [n.id, n.recipientId, n.senderId, n.type, n.read, n.createdAt, JSON.stringify(payload)]
    );
  }

  if (ids.length) {
    await client.query('DELETE FROM notifications WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM notifications');
  }
}
