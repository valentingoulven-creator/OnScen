import fs from 'fs';
import path from 'path';
import {
  db,
  type ChatMessage,
  type DirectMessage,
  type FeedPostComment,
  type GroupMessage,
  type LiveBan,
  type MessageGroup,
  type User,
  type FeedPost,
  type Story,
  type UserBlock,
  type UserMute,
  type UserFavorite,
} from '../models/schema';
import { getMsdevEnvPath } from '../paths';
import { isValidLatLng } from './mapCoords';
import { refreshUserPublicCoords } from './locationPrivacy';
import { migrateUserRelationshipStatus } from './profile';
import { migrateUserProfileType } from './profileTypes';
import {
  loadAccessControlFromPersist,
  snapshotAccessControl,
  type AccessInviteCode,
  type AccessPolicy,
} from './accessControl';

function getStorePath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'data', 'store.json');
}

type MapOfSets = Record<string, string[]>;

type DmReadCursorsRecord = Record<string, Record<string, number>>;

type GroupReadCursorsRecord = Record<string, Record<string, number>>;

interface PersistedStore {
  version: 1;
  savedAt: number;
  accessPolicy?: AccessPolicy;
  accessInviteCodes?: AccessInviteCode[];
  users: User[];
  directMessages: DirectMessage[];
  messageGroups?: MessageGroup[];
  groupMessages?: GroupMessage[];
  groupReadCursors?: GroupReadCursorsRecord;
  dmReadCursors?: DmReadCursorsRecord;
  salonChats: Record<string, ChatMessage[]>;
  liveChats: Record<string, ChatMessage[]>;
  liveBans: { liveId: string; userId: string; ban: LiveBan }[];
  userBlocks: UserBlock[];
  userMutes?: UserMute[];
  userFollows: MapOfSets;
  userFavorites?: { fanId: string; hostId: string; entry: UserFavorite }[];
  feedPosts?: FeedPost[];
  feedPostLikes?: MapOfSets;
  feedPostComments?: Record<string, FeedPostComment[]>;
  feedPostFavorites?: MapOfSets;
  stories?: Story[];
}

function recordToMap<V>(record: Record<string, V> | undefined): Map<string, V> {
  const map = new Map<string, V>();
  if (!record) return map;
  for (const [k, v] of Object.entries(record)) map.set(k, v);
  return map;
}

function setsToRecord(map: Map<string, Set<string>>): MapOfSets {
  const out: MapOfSets = {};
  for (const [k, set] of map.entries()) out[k] = [...set];
  return out;
}

function recordToSets(record: MapOfSets | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!record) return map;
  for (const [k, arr] of Object.entries(record)) map.set(k, new Set(arr));
  return map;
}

function snapshot(): PersistedStore {
  const salonChats: Record<string, ChatMessage[]> = {};
  for (const [id, list] of db.salonChats.entries()) salonChats[id] = list ?? [];

  const liveChats: Record<string, ChatMessage[]> = {};
  for (const [id, list] of db.liveChats.entries()) liveChats[id] = list ?? [];

  const liveBans: PersistedStore['liveBans'] = [];
  for (const [liveId, bans] of db.liveBans.entries()) {
    for (const [userId, ban] of bans.entries()) liveBans.push({ liveId, userId, ban });
  }

  const access = snapshotAccessControl();
  return {
    version: 1,
    savedAt: Date.now(),
    accessPolicy: access.accessPolicy,
    accessInviteCodes: access.accessInviteCodes,
    users: [...db.users.values()],
    directMessages: [...db.directMessages],
    messageGroups: [...db.messageGroups],
    groupMessages: [...db.groupMessages],
    groupReadCursors: (() => {
      const out: GroupReadCursorsRecord = {};
      for (const [userId, groups] of db.groupReadCursors.entries()) {
        out[userId] = Object.fromEntries(groups.entries());
      }
      return out;
    })(),
    dmReadCursors: (() => {
      const out: DmReadCursorsRecord = {};
      for (const [userId, peers] of db.dmReadCursors.entries()) {
        out[userId] = Object.fromEntries(peers.entries());
      }
      return out;
    })(),
    salonChats,
    liveChats,
    liveBans,
    userBlocks: [...db.userBlocks],
    userMutes: [...db.userMutes],
    userFollows: setsToRecord(db.userFollows),
    userFavorites: (() => {
      const out: PersistedStore['userFavorites'] = [];
      for (const [fanId, hosts] of db.userFavorites.entries()) {
        for (const [hostId, entry] of hosts.entries()) {
          out.push({ fanId, hostId, entry });
        }
      }
      return out;
    })(),
    feedPosts: [...db.feedPosts],
    feedPostLikes: setsToRecord(db.feedPostLikes),
    feedPostComments: (() => {
      const out: Record<string, FeedPostComment[]> = {};
      for (const [k, arr] of db.feedPostComments.entries()) out[k] = arr;
      return out;
    })(),
    feedPostFavorites: setsToRecord(db.feedPostFavorites),
    stories: [...db.stories],
  };
}

function restore(data: PersistedStore): void {
  loadAccessControlFromPersist(data.accessPolicy, data.accessInviteCodes);
  db.users.clear();
  for (const u of data.users) {
    if (isValidLatLng(u.latitude, u.longitude)) {
      refreshUserPublicCoords(u);
    }
    migrateUserRelationshipStatus(u);
    migrateUserProfileType(u);
    db.users.set(u.id, u);
  }

  db.directMessages.length = 0;
  db.directMessages.push(...data.directMessages);

  db.messageGroups.length = 0;
  db.messageGroups.push(...(data.messageGroups ?? []));

  db.groupMessages.length = 0;
  db.groupMessages.push(...(data.groupMessages ?? []));

  db.groupReadCursors.clear();
  for (const [userId, groups] of Object.entries(data.groupReadCursors ?? {})) {
    db.groupReadCursors.set(userId, new Map(Object.entries(groups)));
  }

  db.dmReadCursors.clear();
  for (const [userId, peers] of Object.entries(data.dmReadCursors ?? {})) {
    db.dmReadCursors.set(userId, new Map(Object.entries(peers)));
  }

  db.salonChats.clear();
  for (const [id, list] of Object.entries(data.salonChats ?? {})) {
    db.salonChats.set(id, list);
  }

  db.liveChats.clear();
  for (const [id, list] of Object.entries(data.liveChats ?? {})) {
    db.liveChats.set(id, list);
  }

  db.liveBans.clear();
  for (const { liveId, userId, ban } of data.liveBans ?? []) {
    if (!db.liveBans.has(liveId)) db.liveBans.set(liveId, new Map());
    db.liveBans.get(liveId)!.set(userId, ban);
  }

  db.userBlocks.length = 0;
  db.userBlocks.push(...(data.userBlocks ?? []));

  db.userMutes.length = 0;
  db.userMutes.push(...(data.userMutes ?? []));

  db.userFollows.clear();
  for (const [k, arr] of Object.entries(data.userFollows ?? {})) {
    db.userFollows.set(k, new Set(arr));
  }

  db.userFavorites.clear();
  for (const { fanId, hostId, entry } of data.userFavorites ?? []) {
    if (!db.userFavorites.has(fanId)) db.userFavorites.set(fanId, new Map());
    db.userFavorites.get(fanId)!.set(hostId, entry);
  }

  db.feedPosts.length = 0;
  db.feedPosts.push(...(data.feedPosts ?? []));

  db.feedPostLikes.clear();
  for (const [k, arr] of Object.entries(data.feedPostLikes ?? {})) {
    db.feedPostLikes.set(k, new Set(arr));
  }

  db.feedPostComments.clear();
  for (const [k, arr] of Object.entries(data.feedPostComments ?? {})) {
    db.feedPostComments.set(k, arr);
  }

  db.feedPostFavorites.clear();
  for (const [k, arr] of Object.entries(data.feedPostFavorites ?? {})) {
    db.feedPostFavorites.set(k, new Set(arr));
  }

  db.stories.length = 0;
  db.stories.push(...(data.stories ?? []));
}

export function loadPersistedStore(): boolean {
  const file = getStorePath();
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as PersistedStore;
    if (raw.version !== 1 || !Array.isArray(raw.users)) return false;
    restore(raw);
    return db.users.size > 0;
  } catch {
    return false;
  }
}

export function savePersistedStore(): void {
  const file = getStorePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot(), null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistInterval: ReturnType<typeof setInterval> | null = null;

export function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      savePersistedStore();
    } catch (e) {
      console.warn('[melosong] Échec sauvegarde locale:', e);
    }
  }, 800);
}

export function startPersistLoop(): void {
  if (persistInterval) return;
  persistInterval = setInterval(() => schedulePersist(), 30_000);
}

export function stopPersistLoop(): void {
  if (persistInterval) clearInterval(persistInterval);
  persistInterval = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    savePersistedStore();
  } catch {
    /* ignore */
  }
}
