import type { Pool, PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { runMigrations } from '../db/migrate';
import { db, type AppNotification, type HostRating } from '../models/schema';
import {
  filterValidUsers,
  isValidPersistedStore,
  restoreStore,
  snapshotStore,
  type PersistedStore,
} from './storeCore';
import { countUsersInPg, upsertUser } from './pgUsers';
import type { AccessPolicy } from './accessControl';
import { syncFeedTablesToPg, syncNotificationsToPg } from './pgStoreFeedSync';
import { syncStoriesToPg } from './pgStories';
import {
  syncHeartEventsToPg,
  syncSocialTablesFromStore,
} from './pgStoreSocialSync';

let initialized = false;

/** Sérialise les écritures PostgreSQL (évite les courses DELETE+INSERT concurrentes). */
let pgSaveTail: Promise<void> = Promise.resolve();

export async function initPostgresPersistence(): Promise<void> {
  if (initialized) return;
  await runMigrations();
  const { ensureMajorCitiesSeeded } = await import('./majorCities');
  await ensureMajorCitiesSeeded().catch((err) => {
    console.error('[major-cities] startup seed skipped:', err);
  });
  const { pruneOldDiagnosticLogs, canPersistDiagnosticLogs } = await import('./appDiagnosticLogs');
  if (canPersistDiagnosticLogs()) {
    void pruneOldDiagnosticLogs().catch((err) => {
      console.error('[diagnostic-logs] startup prune failed:', err);
    });
  }
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
  db.hostRatings.length = 0;
  db.hostRatings.push(...loaded.hostRatings);
  db.notifications.length = 0;
  db.notifications.push(...loaded.notifications);
  return true;
}

async function savePersistedStoreToPostgresOnce(): Promise<void> {
  await initPostgresPersistence();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const data = snapshotStore();
    await assertSafeUserSnapshot(client, data);
    if (!isValidPersistedStore(data)) {
      throw new Error('[pgStore] Snapshot invalide — sauvegarde PostgreSQL annulée');
    }
    await writeStore(client, data);
  } finally {
    client.release();
  }
}

function isProductionStrictEnv(): boolean {
  return process.env.APP_ENV === 'production';
}

/** Bloque toute écriture qui effacerait les comptes en production (store vide en mémoire). */
async function assertSafeUserSnapshot(client: PoolClient, data: PersistedStore): Promise<void> {
  if (data.users.length > 0) return;

  const pgUserCount = await countUsersInPg(client);
  if (pgUserCount > 0) {
    throw new Error(
      `[pgStore] Refus d'écrire un store sans utilisateurs alors que PostgreSQL en contient ${pgUserCount} — aucune suppression en masse`
    );
  }
  if (isProductionStrictEnv()) {
    throw new Error(
      '[pgStore] Refus de persister un store sans utilisateurs en production'
    );
  }
}

export function savePersistedStoreToPostgres(): Promise<void> {
  const job = pgSaveTail.then(() => savePersistedStoreToPostgresOnce());
  pgSaveTail = job.catch(() => {});
  return job;
}

// Uses the pool directly (no single held client) so all 19 SELECTs can run in parallel
// across multiple pool connections.  writeStore still uses a dedicated client+transaction.
interface LoadedStore {
  store: PersistedStore;
  heartEvents: { fromId: string; toId: string; createdAt: number }[];
  hostRatings: HostRating[];
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
    hostRatingsRes,
    notificationsRes,
    supportContactRes,
    sponsorsRes,
  ] = await Promise.all([
    pool.query<{ version: number; saved_at: string; analytics_buckets: Record<string, number> }>(
      'SELECT version, saved_at, analytics_buckets FROM store_meta WHERE id = 1'
    ),
    pool.query<{ payload: PersistedStore['users'][number]; password_hash: string | null }>(
      'SELECT payload, password_hash FROM users'
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
      host_id: string;
      rater_id: string;
      stars: number;
      timestamp: string;
      payload: Pick<HostRating, 'salonId' | 'liveId'>;
    }>('SELECT id, host_id, rater_id, stars, timestamp, payload FROM host_ratings'),
    pool.query<{
      id: string;
      recipient_id: string;
      sender_id: string;
      type: string;
      read: boolean;
      created_at: string;
      payload: AppNotification;
    }>('SELECT id, recipient_id, sender_id, type, read, created_at, payload FROM notifications'),
    pool.query<{ payload: NonNullable<PersistedStore['supportContactMessages']>[number] }>(
      'SELECT payload FROM support_contact_messages'
    ),
    pool.query<{ payload: NonNullable<PersistedStore['sponsors']>[number] }>(
      'SELECT payload FROM sponsors'
    ),
  ]);

  const savedAt = metaRes.rows[0] ? Number(metaRes.rows[0].saved_at) : Date.now();
  // Fix #6: restaurer passwordHash depuis la colonne dédiée si absent du payload
  // (migration path : les payloads récents ne contiennent plus passwordHash)
  const rawUsers = usersRes.rows.map((r) => {
    const user = r.payload;
    if (user && !user.passwordHash && r.password_hash) {
      user.passwordHash = r.password_hash;
    }
    return user;
  });
  const { valid: users, skippedIds } = filterValidUsers(rawUsers);
  if (skippedIds.length > 0) {
    console.warn(
      `[pgStore] ${skippedIds.length} utilisateur(s) ignoré(s) à la lecture PostgreSQL (store partiel conservé)`
    );
  }
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
    analyticsBuckets: metaRes.rows[0]?.analytics_buckets ?? {},
    supportContactMessages: supportContactRes.rows.map((r) => r.payload),
    sponsors: sponsorsRes.rows.map((r) => r.payload),
  };

  if (!isValidPersistedStore(store)) return null;

  const heartEvents = heartsRes.rows.map((row) => ({
    fromId: row.from_id,
    toId: row.to_id,
    createdAt: Number(row.created_at),
  }));

  const hostRatings: HostRating[] = hostRatingsRes.rows.map((row) => ({
    id: row.id,
    hostId: row.host_id,
    raterId: row.rater_id,
    stars: row.stars,
    salonId: row.payload?.salonId,
    liveId: row.payload?.liveId,
    timestamp: Number(row.timestamp),
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
      supportMessageId: n.supportMessageId,
    };
  });

  return { store, heartEvents, hostRatings, notifications };
}

async function writeStore(client: PoolClient, data: PersistedStore): Promise<void> {
  await client.query('BEGIN');
  try {
    // users: jamais DELETE FROM users — upsert individuel uniquement (voir writeUsersToPg)

    if (data.accessPolicy) {
      await client.query(
        `INSERT INTO access_policy (id, registration_mode, updated_at)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET registration_mode = EXCLUDED.registration_mode, updated_at = EXCLUDED.updated_at`,
        [data.accessPolicy.registrationMode, data.accessPolicy.updatedAt]
      );
    }

    await writeUsersToPg(client, data.users);
    await syncSocialTablesFromStore(client, data);

    await syncFeedTablesToPg(client, data);
    await syncStoriesToPg(client, data.stories ?? []);
    await syncHeartEventsToPg(client, db.heartEvents);
    await syncNotificationsToPg(client, db.notifications);

    await client.query(
      `INSERT INTO store_meta (id, version, saved_at, analytics_buckets)
       VALUES (1, $1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         version = EXCLUDED.version,
         saved_at = EXCLUDED.saved_at,
         analytics_buckets = EXCLUDED.analytics_buckets`,
      [data.version, data.savedAt, JSON.stringify(data.analyticsBuckets ?? {})]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/** UPSERT par utilisateur — pas de DELETE global sur la table users. */
async function writeUsersToPg(client: PoolClient, users: PersistedStore['users']): Promise<void> {
  for (const user of users) {
    await upsertUser(client, user);
  }
}
