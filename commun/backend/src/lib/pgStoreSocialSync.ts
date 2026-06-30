import type { PoolClient } from 'pg';
import type {
  HostRating,
  HeartEvent,
  LiveBan,
  MessageGroup,
  GroupMessage,
  Sponsor,
  SupportContactMessage,
  UserBlock,
  UserMute,
  UserFavorite,
  ChatMessage,
} from '../models/schema';
import type { AccessInviteCode } from './accessControl';
import type { PersistedStore } from './storeCore';
import { syncDirectMessagesToPg } from './pgDirectMessages';

type MapOfSets = Record<string, string[]>;

async function pruneCompositePairs(
  client: PoolClient,
  table: string,
  colA: string,
  colB: string,
  pairs: Array<[string, string]>
): Promise<void> {
  if (pairs.length) {
    const a = pairs.map(([x]) => x);
    const b = pairs.map(([, y]) => y);
    await client.query(
      `DELETE FROM ${table}
       WHERE NOT EXISTS (
         SELECT 1 FROM unnest($1::text[], $2::text[]) AS t(a, b)
         WHERE ${table}.${colA} = t.a AND ${table}.${colB} = t.b
       )`,
      [a, b]
    );
  } else {
    await client.query(`DELETE FROM ${table}`);
  }
}

export async function syncAccessInviteCodesToPg(
  client: PoolClient,
  codes: AccessInviteCode[]
): Promise<void> {
  const ids = codes.map((c) => c.id);
  for (const code of codes) {
    await client.query(
      `INSERT INTO access_invite_codes (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [code.id, JSON.stringify(code)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM access_invite_codes WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM access_invite_codes');
  }
}

export async function syncMessageGroupsToPg(
  client: PoolClient,
  groups: MessageGroup[]
): Promise<void> {
  const ids = groups.map((g) => g.id);
  for (const group of groups) {
    await client.query(
      `INSERT INTO message_groups (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [group.id, JSON.stringify(group)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM message_groups WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM message_groups');
  }
}

export async function syncGroupMessagesToPg(
  client: PoolClient,
  messages: GroupMessage[]
): Promise<void> {
  const ids = messages.map((m) => m.id);
  for (const msg of messages) {
    await client.query(
      `INSERT INTO group_messages (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [msg.id, JSON.stringify(msg)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM group_messages WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM group_messages');
  }
}

export async function syncGroupReadCursorsToPg(
  client: PoolClient,
  cursors: Record<string, Record<string, number>>
): Promise<void> {
  const pairs: Array<[string, string, number]> = [];
  for (const [userId, groups] of Object.entries(cursors)) {
    for (const [groupId, lastReadAt] of Object.entries(groups)) {
      pairs.push([userId, groupId, lastReadAt]);
    }
  }
  for (const [userId, groupId, lastReadAt] of pairs) {
    await client.query(
      `INSERT INTO group_read_cursors (user_id, group_id, last_read_at) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, group_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [userId, groupId, lastReadAt]
    );
  }
  await pruneCompositePairs(
    client,
    'group_read_cursors',
    'user_id',
    'group_id',
    pairs.map(([u, g]) => [u, g])
  );
}

export async function syncDmReadCursorsToPg(
  client: PoolClient,
  cursors: Record<string, Record<string, number>>
): Promise<void> {
  const pairs: Array<[string, string, number]> = [];
  for (const [userId, peers] of Object.entries(cursors)) {
    for (const [peerId, lastReadAt] of Object.entries(peers)) {
      pairs.push([userId, peerId, lastReadAt]);
    }
  }
  for (const [userId, peerId, lastReadAt] of pairs) {
    await client.query(
      `INSERT INTO dm_read_cursors (user_id, peer_id, last_read_at) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, peer_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [userId, peerId, lastReadAt]
    );
  }
  await pruneCompositePairs(
    client,
    'dm_read_cursors',
    'user_id',
    'peer_id',
    pairs.map(([u, p]) => [u, p])
  );
}

export async function syncSalonChatsToPg(
  client: PoolClient,
  salonChats: Record<string, ChatMessage[]>
): Promise<void> {
  const ids = Object.keys(salonChats);
  for (const [salonId, messages] of Object.entries(salonChats)) {
    await client.query(
      `INSERT INTO salon_chats (salon_id, messages) VALUES ($1, $2::jsonb)
       ON CONFLICT (salon_id) DO UPDATE SET messages = EXCLUDED.messages`,
      [salonId, JSON.stringify(messages)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM salon_chats WHERE NOT (salon_id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM salon_chats');
  }
}

export async function syncLiveChatsToPg(
  client: PoolClient,
  liveChats: Record<string, ChatMessage[]>
): Promise<void> {
  const ids = Object.keys(liveChats);
  for (const [liveId, messages] of Object.entries(liveChats)) {
    await client.query(
      `INSERT INTO live_chats (live_id, messages) VALUES ($1, $2::jsonb)
       ON CONFLICT (live_id) DO UPDATE SET messages = EXCLUDED.messages`,
      [liveId, JSON.stringify(messages)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM live_chats WHERE NOT (live_id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM live_chats');
  }
}

export async function syncLiveBansToPg(
  client: PoolClient,
  liveBans: { liveId: string; userId: string; ban: LiveBan }[]
): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const { liveId, userId, ban } of liveBans) {
    pairs.push([liveId, userId]);
    await client.query(
      `INSERT INTO live_bans (live_id, user_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (live_id, user_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [liveId, userId, JSON.stringify(ban)]
    );
  }
  await pruneCompositePairs(client, 'live_bans', 'live_id', 'user_id', pairs);
}

export async function syncUserBlocksToPg(client: PoolClient, blocks: UserBlock[]): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const block of blocks) {
    pairs.push([block.blockerId, block.blockedId]);
    await client.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [block.blockerId, block.blockedId, JSON.stringify(block)]
    );
  }
  await pruneCompositePairs(client, 'user_blocks', 'blocker_id', 'blocked_id', pairs);
}

export async function syncUserMutesToPg(client: PoolClient, mutes: UserMute[]): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const mute of mutes) {
    pairs.push([mute.muterId, mute.mutedId]);
    await client.query(
      `INSERT INTO user_mutes (muter_id, muted_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (muter_id, muted_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [mute.muterId, mute.mutedId, JSON.stringify(mute)]
    );
  }
  await pruneCompositePairs(client, 'user_mutes', 'muter_id', 'muted_id', pairs);
}

export async function syncUserFollowsToPg(client: PoolClient, follows: MapOfSets): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const [followerId, followedIds] of Object.entries(follows)) {
    for (const followedId of followedIds) {
      pairs.push([followerId, followedId]);
      await client.query(
        `INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)
         ON CONFLICT (follower_id, followed_id) DO NOTHING`,
        [followerId, followedId]
      );
    }
  }
  await pruneCompositePairs(client, 'user_follows', 'follower_id', 'followed_id', pairs);
}

export async function syncUserFavoritesToPg(
  client: PoolClient,
  favorites: { fanId: string; hostId: string; entry: UserFavorite }[]
): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const { fanId, hostId, entry } of favorites) {
    pairs.push([fanId, hostId]);
    await client.query(
      `INSERT INTO user_favorites (fan_id, host_id, payload) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (fan_id, host_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [fanId, hostId, JSON.stringify(entry)]
    );
  }
  await pruneCompositePairs(client, 'user_favorites', 'fan_id', 'host_id', pairs);
}

export async function syncHeartEventsToPg(client: PoolClient, hearts: HeartEvent[]): Promise<void> {
  const pairs: Array<[string, string]> = [];
  for (const heart of hearts) {
    pairs.push([heart.fromId, heart.toId]);
    await client.query(
      `INSERT INTO heart_events (from_id, to_id, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (from_id, to_id) DO UPDATE SET created_at = EXCLUDED.created_at`,
      [heart.fromId, heart.toId, heart.createdAt]
    );
  }
  await pruneCompositePairs(client, 'heart_events', 'from_id', 'to_id', pairs);
}

export async function syncHostRatingsToPg(client: PoolClient, ratings: HostRating[]): Promise<void> {
  const ids = ratings.map((r) => r.id);
  for (const rating of ratings) {
    await client.query(
      `INSERT INTO host_ratings (id, host_id, rater_id, stars, timestamp, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         host_id = EXCLUDED.host_id,
         rater_id = EXCLUDED.rater_id,
         stars = EXCLUDED.stars,
         timestamp = EXCLUDED.timestamp,
         payload = EXCLUDED.payload`,
      [
        rating.id,
        rating.hostId,
        rating.raterId,
        rating.stars,
        rating.timestamp,
        JSON.stringify({ salonId: rating.salonId, liveId: rating.liveId }),
      ]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM host_ratings WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM host_ratings');
  }
}

export async function syncSupportContactMessagesToPg(
  client: PoolClient,
  messages: SupportContactMessage[]
): Promise<void> {
  const ids = messages.map((m) => m.id);
  for (const msg of messages) {
    await client.query(
      `INSERT INTO support_contact_messages (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [msg.id, JSON.stringify(msg)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM support_contact_messages WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM support_contact_messages');
  }
}

export async function syncSponsorsToPg(client: PoolClient, sponsors: Sponsor[]): Promise<void> {
  const ids = sponsors.map((s) => s.id);
  for (const sponsor of sponsors) {
    await client.query(
      `INSERT INTO sponsors (id, payload) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [sponsor.id, JSON.stringify(sponsor)]
    );
  }
  if (ids.length) {
    await client.query('DELETE FROM sponsors WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM sponsors');
  }
}

/** Sync all social/DM/chat tables from a PersistedStore snapshot (sans notifications/hearts). */
export async function syncSocialTablesFromStore(
  client: PoolClient,
  data: Pick<
    PersistedStore,
    | 'accessInviteCodes'
    | 'directMessages'
    | 'messageGroups'
    | 'groupMessages'
    | 'groupReadCursors'
    | 'dmReadCursors'
    | 'salonChats'
    | 'liveChats'
    | 'liveBans'
    | 'userBlocks'
    | 'userMutes'
    | 'userFollows'
    | 'userFavorites'
    | 'hostRatings'
    | 'supportContactMessages'
    | 'sponsors'
  >
): Promise<void> {
  await syncAccessInviteCodesToPg(client, data.accessInviteCodes ?? []);
  await syncDirectMessagesToPg(client, data.directMessages);
  await syncMessageGroupsToPg(client, data.messageGroups ?? []);
  await syncGroupMessagesToPg(client, data.groupMessages ?? []);
  await syncGroupReadCursorsToPg(client, data.groupReadCursors ?? {});
  await syncDmReadCursorsToPg(client, data.dmReadCursors ?? {});
  await syncSalonChatsToPg(client, data.salonChats ?? {});
  await syncLiveChatsToPg(client, data.liveChats ?? {});
  await syncLiveBansToPg(client, data.liveBans ?? []);
  await syncUserBlocksToPg(client, data.userBlocks ?? []);
  await syncUserMutesToPg(client, data.userMutes ?? []);
  await syncUserFollowsToPg(client, data.userFollows ?? {});
  await syncUserFavoritesToPg(client, data.userFavorites ?? []);
  await syncHostRatingsToPg(client, data.hostRatings ?? []);
  await syncSupportContactMessagesToPg(client, data.supportContactMessages ?? []);
  await syncSponsorsToPg(client, data.sponsors ?? []);
}
