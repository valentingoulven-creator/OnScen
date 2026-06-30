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
  type Sponsor,
  type SponsorPlatformConfig,
  type UserAlbum,
  type UserComposition,
  type CompositionUpvote,
  type UserReel,
} from '../models/schema';
import { ensureDefaultSponsorPlatformConfig } from './sponsorPlatformConfig';
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
import { purgeUnboundedChatHistory } from './chatHistory';

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
  sponsors?: Sponsor[];
  /** IDs of default sponsors explicitly deleted by an admin — prevents re-seeding on restart. */
  deletedDefaultSponsorIds?: string[];
  sponsorPlatformConfig?: SponsorPlatformConfig;
  /** Albums Discographie (dev / store.json ; prod utilise aussi user_albums PostgreSQL). */
  albums?: UserAlbum[];
  /** Morceaux Discographie (dev / store.json ; prod utilise aussi user_compositions PostgreSQL). */
  compositions?: UserComposition[];
  compositionUpvotes?: CompositionUpvote[];
  /** Reels utilisateur (dev / store.json ; prod utilise aussi user_reels PostgreSQL). */
  userReels?: UserReel[];
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
  purgeUnboundedChatHistory();

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
    sponsors: [...db.sponsors],
    deletedDefaultSponsorIds: [...db.deletedDefaultSponsorIds],
    sponsorPlatformConfig: { ...db.sponsorPlatformConfig },
    albums: [...db.albums],
    compositions: [...db.compositions],
    compositionUpvotes: [...db.compositionUpvotes],
    userReels: [...db.userReels],
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

  db.sponsors.length = 0;
  db.sponsors.push(...(data.sponsors ?? []));
  db.deletedDefaultSponsorIds.clear();
  for (const id of data.deletedDefaultSponsorIds ?? []) {
    db.deletedDefaultSponsorIds.add(id);
  }
  if (data.sponsorPlatformConfig) {
    db.sponsorPlatformConfig = { ...data.sponsorPlatformConfig };
  }
  ensureDefaultSponsorPlatformConfig();

  db.albums.length = 0;
  db.albums.push(...(data.albums ?? []));

  db.compositions.length = 0;
  db.compositions.push(...(data.compositions ?? []));

  db.compositionUpvotes.length = 0;
  db.compositionUpvotes.push(...(data.compositionUpvotes ?? []));

  db.userReels.length = 0;
  db.userReels.push(...(data.userReels ?? []));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isValidTimestamp(v: unknown): boolean {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  const min = Date.UTC(2020, 0, 1);
  const max = Date.now() + 86_400_000;
  return v >= min && v <= max;
}

function isValidChatRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  for (const val of Object.values(record as Record<string, unknown>)) {
    if (!Array.isArray(val)) return false;
    for (const msg of val) {
      if (!msg || typeof msg !== 'object') return false;
      const m = msg as ChatMessage;
      if (!isNonEmptyString(m.id) || !isNonEmptyString(m.senderId)) return false;
      if (typeof m.content !== 'string') return false;
      if (!isValidTimestamp(m.timestamp)) return false;
      if (m.roomType !== undefined && m.roomType !== 'salon' && m.roomType !== 'live') return false;
    }
  }
  return true;
}

export function isValidUserRecord(u: unknown): u is User {
  if (!u || typeof u !== 'object') return false;
  const user = u as User;
  if (!isNonEmptyString(user.id)) return false;
  if (typeof user.username !== 'string' || typeof user.email !== 'string') return false;
  if (typeof user.passwordHash !== 'string') return false;
  if (typeof user.meloCoins !== 'number' || !Number.isFinite(user.meloCoins)) return false;
  if (typeof user.isGhostMode !== 'boolean') return false;
  if (typeof user.lastSeenAt !== 'number' || !Number.isFinite(user.lastSeenAt)) return false;
  return true;
}

/** Filtre les utilisateurs invalides individuellement (ne rejette pas tout le store). */
export function filterValidUsers(users: unknown[]): { valid: User[]; skippedIds: string[] } {
  const valid: User[] = [];
  const seenIds = new Set<string>();
  const skippedIds: string[] = [];
  for (const u of users) {
    if (!isValidUserRecord(u)) {
      const id =
        u && typeof u === 'object' && 'id' in u && typeof (u as User).id === 'string'
          ? (u as User).id
          : '?';
      const email =
        u && typeof u === 'object' && 'email' in u && typeof (u as User).email === 'string'
          ? (u as User).email
          : '?';
      console.warn(`[storeCore] Utilisateur ignoré (données invalides): id=${id} email=${email}`);
      skippedIds.push(id);
      continue;
    }
    if (seenIds.has(u.id)) {
      console.warn(`[storeCore] Utilisateur ignoré (id dupliqué): ${u.id}`);
      skippedIds.push(u.id);
      continue;
    }
    seenIds.add(u.id);
    valid.push(u);
  }
  return { valid, skippedIds };
}

function isValidUserArray(users: unknown): users is User[] {
  if (!Array.isArray(users)) return false;
  const { valid, skippedIds } = filterValidUsers(users);
  return skippedIds.length === 0 && valid.length === users.length;
}

function isValidDirectMessages(dms: unknown): boolean {
  if (dms === undefined) return true;
  if (!Array.isArray(dms)) return false;
  for (const dm of dms) {
    if (!dm || typeof dm !== 'object') return false;
    const m = dm as DirectMessage;
    if (!isNonEmptyString(m.id)) return false;
  }
  return true;
}

function isValidArchivedLives(lives: unknown): boolean {
  if (lives === undefined) return true;
  if (!Array.isArray(lives)) return false;
  for (const live of lives) {
    if (!live || typeof live !== 'object') return false;
    const l = live as Live;
    if (!isNonEmptyString(l.id)) return false;
    if (typeof l.isActive !== 'boolean') return false;
  }
  return true;
}

export function isValidPersistedStore(raw: unknown): raw is PersistedStore {
  if (!raw || typeof raw !== 'object') return false;
  const data = raw as PersistedStore;
  if (data.version !== 1) return false;
  if (!isValidTimestamp(data.savedAt)) return false;
  if (!isValidUserArray(data.users)) return false;
  if (!isValidDirectMessages(data.directMessages)) return false;
  if (!isValidChatRecord(data.salonChats ?? {})) return false;
  if (!isValidChatRecord(data.liveChats ?? {})) return false;
  if (!isValidArchivedLives(data.archivedLives)) return false;
  if (data.accessPolicy !== undefined) {
    const mode = data.accessPolicy.registrationMode;
    if (mode !== 'open' && mode !== 'invite_only' && mode !== 'admin_approval' && mode !== 'closed') {
      return false;
    }
    if (!isValidTimestamp(data.accessPolicy.updatedAt)) return false;
  }
  return true;
}
