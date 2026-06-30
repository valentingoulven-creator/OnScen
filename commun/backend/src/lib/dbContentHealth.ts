import { getPool, isPostgresEnabled } from '../db/pool';
import { db } from '../models/schema';
import { countFeedPostsInPg } from './pgFeedPosts';
import { countStoriesInPg } from './pgStories';

export interface DbTableCounts {
  users: number;
  feed_posts: number;
  feed_post_comments: number;
  feed_post_likes: number;
  stories: number;
  user_reels: number;
  user_albums: number;
  user_compositions: number;
  notifications: number;
}

export interface DbContentHealthReport {
  postgresEnabled: boolean;
  connected: boolean;
  tables: DbTableCounts;
  memory: {
    feedPosts: number;
    stories: number;
    userReels: number;
    albums: number;
    compositions: number;
  };
  drift: {
    feedPosts: number;
    stories: number;
    userReels: number;
    albums: number;
    compositions: number;
  };
  ok: boolean;
  warnings: string[];
}

async function countTable(table: keyof DbTableCounts): Promise<number> {
  const res = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table}`
  );
  return Number(res.rows[0]?.count ?? 0);
}

/** Compare les comptes PostgreSQL vs mémoire pour le contenu utilisateur critique. */
export async function getDbContentHealthReport(): Promise<DbContentHealthReport> {
  const warnings: string[] = [];
  const memory = {
    feedPosts: db.feedPosts.length,
    stories: db.stories.length,
    userReels: db.userReels.length,
    albums: db.albums.length,
    compositions: db.compositions.length,
  };

  if (!isPostgresEnabled()) {
    return {
      postgresEnabled: false,
      connected: false,
      tables: {
        users: db.users.size,
        feed_posts: memory.feedPosts,
        feed_post_comments: 0,
        feed_post_likes: 0,
        stories: memory.stories,
        user_reels: memory.userReels,
        user_albums: memory.albums,
        user_compositions: memory.compositions,
        notifications: db.notifications.length,
      },
      memory,
      drift: {
        feedPosts: 0,
        stories: 0,
        userReels: 0,
        albums: 0,
        compositions: 0,
      },
      ok: true,
      warnings: ['PostgreSQL désactivé — persistance fichier store.json uniquement'],
    };
  }

  let connected: boolean;
  let tables: DbTableCounts = {
    users: 0,
    feed_posts: 0,
    feed_post_comments: 0,
    feed_post_likes: 0,
    stories: 0,
    user_reels: 0,
    user_albums: 0,
    user_compositions: 0,
    notifications: 0,
  };

  try {
    await getPool().query('SELECT 1');
    connected = true;
    tables = {
      users: await countTable('users'),
      feed_posts: await countFeedPostsInPg(),
      feed_post_comments: await countTable('feed_post_comments'),
      feed_post_likes: await countTable('feed_post_likes'),
      stories: await countStoriesInPg(),
      user_reels: await countTable('user_reels'),
      user_albums: await countTable('user_albums'),
      user_compositions: await countTable('user_compositions'),
      notifications: await countTable('notifications'),
    };
  } catch (e) {
    warnings.push(`Connexion PostgreSQL échouée: ${e instanceof Error ? e.message : String(e)}`);
    return {
      postgresEnabled: true,
      connected: false,
      tables,
      memory,
      drift: {
        feedPosts: 0,
        stories: 0,
        userReels: 0,
        albums: 0,
        compositions: 0,
      },
      ok: false,
      warnings,
    };
  }

  const drift = {
    feedPosts: tables.feed_posts - memory.feedPosts,
    stories: tables.stories - memory.stories,
    userReels: tables.user_reels - memory.userReels,
    albums: tables.user_albums - memory.albums,
    compositions: tables.user_compositions - memory.compositions,
  };

  const DRIFT_TOLERANCE = 5;
  for (const [key, value] of Object.entries(drift)) {
    if (Math.abs(value) > DRIFT_TOLERANCE) {
      warnings.push(`Écart mémoire/PG ${key}: ${value > 0 ? '+' : ''}${value}`);
    }
  }

  if (tables.users === 0) {
    warnings.push('Table users vide — base non initialisée ou corruption');
  }

  return {
    postgresEnabled: true,
    connected,
    tables,
    memory,
    drift,
    ok: connected && warnings.length === 0,
    warnings,
  };
}
