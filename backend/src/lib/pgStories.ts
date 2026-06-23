import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { Story } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertStory(dbExec: DbExec, story: Story): Promise<void> {
  await dbExec.query(
    `INSERT INTO stories (id, user_id, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, payload = EXCLUDED.payload`,
    [story.id, story.userId, JSON.stringify(story)]
  );
}

export async function deleteStoryFromPg(dbExec: DbExec, storyId: string): Promise<void> {
  await dbExec.query('DELETE FROM stories WHERE id = $1', [storyId]);
}

export function schedulePersistStoryToPg(story: Story): void {
  if (!isPostgresEnabled()) return;
  void upsertStory(getPool(), story).catch((e) => {
    console.error('[pgStories] Échec upsert story PostgreSQL:', e);
  });
}

export function scheduleDeleteStoryFromPg(storyId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteStoryFromPg(getPool(), storyId).catch((e) => {
    console.error('[pgStories] Échec suppression story PostgreSQL:', e);
  });
}

/** Upsert stories puis prune des ids absents du snapshot mémoire. */
export async function syncStoriesToPg(
  client: PoolClient,
  stories: Story[]
): Promise<void> {
  const ids = stories.map((s) => s.id);
  for (const story of stories) {
    await upsertStory(client, story);
  }
  if (ids.length) {
    await client.query('DELETE FROM stories WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM stories');
  }
}

export async function countStoriesInPg(): Promise<number> {
  if (!isPostgresEnabled()) return 0;
  const res = await getPool().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM stories');
  return Number(res.rows[0]?.count ?? 0);
}
