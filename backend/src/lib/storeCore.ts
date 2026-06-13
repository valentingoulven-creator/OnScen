import {
  db,
  type ChatMessage,
  type DirectMessage,
  type FeedPost,
  type FeedPostComment,
  type GroupMessage,
  type LiveBan,
  type MessageGroup,
  type Story,
  type User,
  type UserBlock,
  type UserFavorite,
  type UserMute,
  type HostRating,
  type Live,
  type SupportContactMessage,
} from '../models/schema';
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
import { restoreAnalyticsBuckets, snapshotAnalyticsBuckets } from './analytics';

type MapOfSets = Record<string, string[]>;

type DmReadCursorsRecord = Record<string, Record<string, number>>;

type GroupReadCursorsRecord = Record<string, Record<string, number>>;

export interface PersistedStore {
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
  hostRatings?: HostRating[];
  analyticsBuckets?: Record<string, number>;
  /** Lives terminés (archivés sur le profil). */
  archivedLives?: Live[];
  supportContactMessages?: SupportContactMessage[];
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

export function snapshotStore(): PersistedStore {
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
    hostRatings: [...db.hostRatings],
    analyticsBuckets: snapshotAnalyticsBuckets(),
    archivedLives: [...db.lives.values()].filter((l) => !l.isActive),
    supportContactMessages: [...db.supportContactMessages],
  };
}

export function restoreStore(data: PersistedStore): void {
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

  db.hostRatings.length = 0;
  db.hostRatings.push(...(data.hostRatings ?? []));

  restoreAnalyticsBuckets(data.analyticsBuckets);

  for (const live of data.archivedLives ?? []) {
    if (!db.lives.has(live.id)) {
      db.lives.set(live.id, live);
    }
  }

  db.supportContactMessages.length = 0;
  db.supportContactMessages.push(...(data.supportContactMessages ?? []));
}

export function isValidPersistedStore(raw: unknown): raw is PersistedStore {
  if (!raw || typeof raw !== 'object') return false;
  const data = raw as PersistedStore;
  return data.version === 1 && Array.isArray(data.users);
}
