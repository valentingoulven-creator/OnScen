import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { runMigrations } from '../db/migrate';
import { db, type AppNotification } from '../models/schema';
import {
  isValidPersistedStore,
  restoreStore,
  snapshotStore,
  type PersistedStore,
} from './storeCore';
import type { AccessPolicy } from './accessControl';

let initialized = false;

export async function initPostgresPersistence(): Promise<void> {
  if (initialized) return;
  await runMigrations();
  initialized = true;
}

export async function loadPersistedStoreFromPostgres(): Promise<boolean> {
  await initPostgresPersistence();
  const pool = getPool();
  const loaded = await readStore(pool);
  if (!loaded || loaded.store.users.length === 0) return false;
  restoreStore(loaded.store);
  db.heartEvents.length = 0;
  db.heartEvents.push(...loaded.heartEvents);
  db.notifications.length = 0;
  db.notifications.push(...loaded.notifications);
  return true;
}

export async function savePersistedStoreToPostgres(): Promise<void> {
  await initPostgresPersistence();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await writeStore(client, snapshotStore());
  } finally {
    client.release();
  }
}

// Uses the pool directly (no single held client) so all 19 SELECTs can run in parallel
// across multiple pool connections.  writeStore still uses a dedicated client+transaction.
interface LoadedStore {
  store: PersistedStore;
  heartEvents: { fromId: string; toId: string; createdAt: number }[];
  notifications: AppNotification[];
}

async function readStore(pool: Pool): Promise<LoadedStore | null> {
  const [
    metaRes,
    usersRes,
    policyRes,
    codesRes,
    dmsRes,
    groupsRes,
    groupMsgsRes,
    groupCursorsRes,
    dmCursorsRes,
    salonChatsRes,
    liveChatsRes,
    liveBansRes,
    blocksRes,
    mutesRes,
    followsRes,
    favoritesRes,
    postsRes,
    likesRes,
    commentsRes,
    postFavsRes,
    storiesRes,
    heartsRes,
    notificationsRes,
  ] = await Promise.all([
    pool.query<{ version: number; saved_at: string }>(
      'SELECT version, saved_at FROM store_meta WHERE id = 1'
    ),
    pool.query<{ payload: PersistedStore['users'][number] }>(
      'SELECT payload FROM users'
    ),
    pool.query<{ registration_mode: AccessPolicy['registrationMode']; updated_at: string }>(
      'SELECT registration_mode, updated_at FROM access_policy WHERE id = 1'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['accessInviteCodes']>[number] }>(
      'SELECT payload FROM access_invite_codes'
    ),
    pool.query<{ payload: PersistedStore['directMessages'][number] }>(
      'SELECT payload FROM direct_messages'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['messageGroups']>[number] }>(
      'SELECT payload FROM message_groups'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['groupMessages']>[number] }>(
      'SELECT payload FROM group_messages'
    ),
    pool.query<{ user_id: string; group_id: string; last_read_at: string }>(
      'SELECT user_id, group_id, last_read_at FROM group_read_cursors'
    ),
    pool.query<{ user_id: string; peer_id: string; last_read_at: string }>(
      'SELECT user_id, peer_id, last_read_at FROM dm_read_cursors'
    ),
    pool.query<{ salon_id: string; messages: PersistedStore['salonChats'][string] }>(
      'SELECT salon_id, messages FROM salon_chats'
    ),
    pool.query<{ live_id: string; messages: PersistedStore['liveChats'][string] }>(
      'SELECT live_id, messages FROM live_chats'
    ),
    pool.query<{
      live_id: string;
      user_id: string;
      payload: PersistedStore['liveBans'][number]['ban'];
    }>('SELECT live_id, user_id, payload FROM live_bans'),
    pool.query<{ payload: PersistedStore['userBlocks'][number] }>(
      'SELECT payload FROM user_blocks'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['userMutes']>[number] }>(
      'SELECT payload FROM user_mutes'
    ),
    pool.query<{ follower_id: string; followed_id: string }>(
      'SELECT follower_id, followed_id FROM user_follows'
    ),
    pool.query<{
      fan_id: string;
      host_id: string;
      payload: NonNullable<PersistedStore['userFavorites']>[number]['entry'];
    }>('SELECT fan_id, host_id, payload FROM user_favorites'),
    pool.query<{ payload: NonNullable<PersistedStore['feedPosts']>[number] }>(
      'SELECT payload FROM feed_posts'
    ),
    pool.query<{ post_id: string; user_id: string }>(
      'SELECT post_id, user_id FROM feed_post_likes'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['feedPostComments']>[string][number] }>(
      'SELECT payload FROM feed_post_comments'
    ),
    pool.query<{ user_id: string; post_id: string }>(
      'SELECT user_id, post_id FROM feed_post_favorites'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['stories']>[number] }>(
      'SELECT payload FROM stories'
    ),
    pool.query<{ from_id: string; to_id: string; created_at: string }>(
      'SELECT from_id, to_id, created_at FROM heart_events'
    ),
    pool.query<{
      id: string;
      recipient_id: string;
      sender_id: string;
      type: string;
      read: boolean;
      created_at: string;
      payload: AppNotification;
    }>('SELECT id, recipient_id, sender_id, type, read, created_at, payload FROM notifications'),
  ]);

  const savedAt = metaRes.rows[0] ? Number(metaRes.rows[0].saved_at) : Date.now();
  const users = usersRes.rows.map((r) => r.payload);
  if (!users.length) return null;

  const accessPolicy = policyRes.rows[0]
    ? {
        registrationMode: policyRes.rows[0].registration_mode,
        updatedAt: Number(policyRes.rows[0].updated_at),
      }
    : undefined;

  const groupReadCursors: NonNullable<PersistedStore['groupReadCursors']> = {};
  for (const row of groupCursorsRes.rows) {
    if (!groupReadCursors[row.user_id]) groupReadCursors[row.user_id] = {};
    groupReadCursors[row.user_id][row.group_id] = Number(row.last_read_at);
  }

  const dmReadCursors: NonNullable<PersistedStore['dmReadCursors']> = {};
  for (const row of dmCursorsRes.rows) {
    if (!dmReadCursors[row.user_id]) dmReadCursors[row.user_id] = {};
    dmReadCursors[row.user_id][row.peer_id] = Number(row.last_read_at);
  }

  const salonChats: PersistedStore['salonChats'] = {};
  for (const row of salonChatsRes.rows) {
    salonChats[row.salon_id] = row.messages ?? [];
  }

  const liveChats: PersistedStore['liveChats'] = {};
  for (const row of liveChatsRes.rows) {
    liveChats[row.live_id] = row.messages ?? [];
  }

  const userFollows: PersistedStore['userFollows'] = {};
  for (const row of followsRes.rows) {
    if (!userFollows[row.follower_id]) userFollows[row.follower_id] = [];
    userFollows[row.follower_id].push(row.followed_id);
  }

  const feedPostLikes: NonNullable<PersistedStore['feedPostLikes']> = {};
  for (const row of likesRes.rows) {
    if (!feedPostLikes[row.post_id]) feedPostLikes[row.post_id] = [];
    feedPostLikes[row.post_id].push(row.user_id);
  }

  const feedPostComments: NonNullable<PersistedStore['feedPostComments']> = {};
  for (const row of commentsRes.rows) {
    const comment = row.payload;
    if (!feedPostComments[comment.postId]) feedPostComments[comment.postId] = [];
    feedPostComments[comment.postId].push(comment);
  }

  const feedPostFavorites: NonNullable<PersistedStore['feedPostFavorites']> = {};
  for (const row of postFavsRes.rows) {
    if (!feedPostFavorites[row.user_id]) feedPostFavorites[row.user_id] = [];
    feedPostFavorites[row.user_id].push(row.post_id);
  }

  const store: PersistedStore = {
    version: 1,
    savedAt,
    accessPolicy,
    accessInviteCodes: codesRes.rows.map((r) => r.payload),
    users,
    directMessages: dmsRes.rows.map((r) => r.payload),
    messageGroups: groupsRes.rows.map((r) => r.payload),
    groupMessages: groupMsgsRes.rows.map((r) => r.payload),
    groupReadCursors,
    dmReadCursors,
    salonChats,
    liveChats,
    liveBans: liveBansRes.rows.map((r) => ({
      liveId: r.live_id,
      userId: r.user_id,
      ban: r.payload,
    })),
    userBlocks: blocksRes.rows.map((r) => r.payload),
    userMutes: mutesRes.rows.map((r) => r.payload),
    userFollows,
    userFavorites: favoritesRes.rows.map((r) => ({
      fanId: r.fan_id,
      hostId: r.host_id,
      entry: r.payload,
    })),
    feedPosts: postsRes.rows.map((r) => r.payload),
    feedPostLikes,
    feedPostComments,
    feedPostFavorites,
    stories: storiesRes.rows.map((r) => r.payload),
  };

  if (!isValidPersistedStore(store)) return null;

  const heartEvents = heartsRes.rows.map((row) => ({
    fromId: row.from_id,
    toId: row.to_id,
    createdAt: Number(row.created_at),
  }));

  const notifications: AppNotification[] = notificationsRes.rows.map((row) => {
    const n = row.payload ?? ({} as AppNotification);
    return {
      id: row.id,
      recipientId: row.recipient_id,
      senderId: row.sender_id,
      senderName: n.senderName ?? 'Utilisateur',
      senderAvatarUrl: n.senderAvatarUrl,
      type: row.type as AppNotification['type'],
      message: n.message ?? '',
      read: row.read,
      createdAt: Number(row.created_at),
      matchId: n.matchId,
      liveId: n.liveId,
      salonId: n.salonId,
      peerUserId: n.peerUserId,
      groupId: n.groupId,
      postId: n.postId,
      reelId: n.reelId,
    };
  });

  return { store, heartEvents, notifications };
}

async function writeStore(client: PoolClient, data: PersistedStore): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query('DELETE FROM feed_post_favorites');
    await client.query('DELETE FROM feed_post_comments');
    await client.query('DELETE FROM feed_post_likes');
    await client.query('DELETE FROM feed_posts');
    await client.query('DELETE FROM stories');
    await client.query('DELETE FROM heart_events');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM user_favorites');
    await client.query('DELETE FROM user_follows');
    await client.query('DELETE FROM user_mutes');
    await client.query('DELETE FROM user_blocks');
    await client.query('DELETE FROM live_bans');
    await client.query('DELETE FROM live_chats');
    await client.query('DELETE FROM salon_chats');
    await client.query('DELETE FROM dm_read_cursors');
    await client.query('DELETE FROM group_read_cursors');
    await client.query('DELETE FROM group_messages');
    await client.query('DELETE FROM message_groups');
    await client.query('DELETE FROM direct_messages');
    await client.query('DELETE FROM access_invite_codes');
    await client.query('DELETE FROM users');

    if (data.accessPolicy) {
      await client.query(
        `INSERT INTO access_policy (id, registration_mode, updated_at)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET registration_mode = EXCLUDED.registration_mode, updated_at = EXCLUDED.updated_at`,
        [data.accessPolicy.registrationMode, data.accessPolicy.updatedAt]
      );
    }

    for (const code of data.accessInviteCodes ?? []) {
      await client.query('INSERT INTO access_invite_codes (id, payload) VALUES ($1, $2::jsonb)', [
        code.id,
        JSON.stringify(code),
      ]);
    }

    for (const user of data.users) {
      await client.query(
        'INSERT INTO users (id, email, username, payload) VALUES ($1, $2, $3, $4::jsonb)',
        [user.id, user.email?.toLowerCase() ?? null, user.username ?? null, JSON.stringify(user)]
      );
    }

    for (const dm of data.directMessages) {
      await client.query('INSERT INTO direct_messages (id, payload) VALUES ($1, $2::jsonb)', [
        dm.id,
        JSON.stringify(dm),
      ]);
    }

    for (const group of data.messageGroups ?? []) {
      await client.query('INSERT INTO message_groups (id, payload) VALUES ($1, $2::jsonb)', [
        group.id,
        JSON.stringify(group),
      ]);
    }

    for (const msg of data.groupMessages ?? []) {
      await client.query('INSERT INTO group_messages (id, payload) VALUES ($1, $2::jsonb)', [
        msg.id,
        JSON.stringify(msg),
      ]);
    }

    for (const [userId, groups] of Object.entries(data.groupReadCursors ?? {})) {
      for (const [groupId, lastReadAt] of Object.entries(groups)) {
        await client.query(
          'INSERT INTO group_read_cursors (user_id, group_id, last_read_at) VALUES ($1, $2, $3)',
          [userId, groupId, lastReadAt]
        );
      }
    }

    for (const [userId, peers] of Object.entries(data.dmReadCursors ?? {})) {
      for (const [peerId, lastReadAt] of Object.entries(peers)) {
        await client.query(
          'INSERT INTO dm_read_cursors (user_id, peer_id, last_read_at) VALUES ($1, $2, $3)',
          [userId, peerId, lastReadAt]
        );
      }
    }

    for (const [salonId, messages] of Object.entries(data.salonChats ?? {})) {
      await client.query('INSERT INTO salon_chats (salon_id, messages) VALUES ($1, $2::jsonb)', [
        salonId,
        JSON.stringify(messages),
      ]);
    }

    for (const [liveId, messages] of Object.entries(data.liveChats ?? {})) {
      await client.query('INSERT INTO live_chats (live_id, messages) VALUES ($1, $2::jsonb)', [
        liveId,
        JSON.stringify(messages),
      ]);
    }

    for (const { liveId, userId, ban } of data.liveBans ?? []) {
      await client.query('INSERT INTO live_bans (live_id, user_id, payload) VALUES ($1, $2, $3::jsonb)', [
        liveId,
        userId,
        JSON.stringify(ban),
      ]);
    }

    for (const block of data.userBlocks ?? []) {
      await client.query(
        'INSERT INTO user_blocks (blocker_id, blocked_id, payload) VALUES ($1, $2, $3::jsonb)',
        [block.blockerId, block.blockedId, JSON.stringify(block)]
      );
    }

    for (const mute of data.userMutes ?? []) {
      await client.query('INSERT INTO user_mutes (muter_id, muted_id, payload) VALUES ($1, $2, $3::jsonb)', [
        mute.muterId,
        mute.mutedId,
        JSON.stringify(mute),
      ]);
    }

    for (const [followerId, followedIds] of Object.entries(data.userFollows ?? {})) {
      for (const followedId of followedIds) {
        await client.query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [
          followerId,
          followedId,
        ]);
      }
    }

    for (const { fanId, hostId, entry } of data.userFavorites ?? []) {
      await client.query('INSERT INTO user_favorites (fan_id, host_id, payload) VALUES ($1, $2, $3::jsonb)', [
        fanId,
        hostId,
        JSON.stringify(entry),
      ]);
    }

    for (const post of data.feedPosts ?? []) {
      await client.query('INSERT INTO feed_posts (id, user_id, payload) VALUES ($1, $2, $3::jsonb)', [
        post.id,
        post.userId,
        JSON.stringify(post),
      ]);
    }

    for (const [postId, userIds] of Object.entries(data.feedPostLikes ?? {})) {
      for (const userId of userIds) {
        await client.query('INSERT INTO feed_post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      }
    }

    for (const [postId, comments] of Object.entries(data.feedPostComments ?? {})) {
      for (const comment of comments) {
        await client.query('INSERT INTO feed_post_comments (id, post_id, payload) VALUES ($1, $2, $3::jsonb)', [
          comment.id,
          postId,
          JSON.stringify(comment),
        ]);
      }
    }

    for (const [userId, postIds] of Object.entries(data.feedPostFavorites ?? {})) {
      for (const postId of postIds) {
        await client.query('INSERT INTO feed_post_favorites (user_id, post_id) VALUES ($1, $2)', [userId, postId]);
      }
    }

    for (const story of data.stories ?? []) {
      await client.query('INSERT INTO stories (id, user_id, payload) VALUES ($1, $2, $3::jsonb)', [
        story.id,
        story.userId,
        JSON.stringify(story),
      ]);
    }

    for (const heart of db.heartEvents) {
      await client.query(
        'INSERT INTO heart_events (from_id, to_id, created_at) VALUES ($1, $2, $3)',
        [heart.fromId, heart.toId, heart.createdAt]
      );
    }

    for (const n of db.notifications) {
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
      };
      await client.query(
        `INSERT INTO notifications (id, recipient_id, sender_id, type, read, created_at, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [n.id, n.recipientId, n.senderId, n.type, n.read, n.createdAt, JSON.stringify(payload)]
      );
    }

    await client.query(
      `INSERT INTO store_meta (id, version, saved_at)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, saved_at = EXCLUDED.saved_at`,
      [data.version, data.savedAt]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
