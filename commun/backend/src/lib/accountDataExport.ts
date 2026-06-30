import { db, User } from '../models/schema';
import { publicProfile } from './profile';
import { publicPlatformLinks } from './platformConnect';

export interface ChatExportMessage {
  id: string;
  roomId: string;
  roomType: 'salon' | 'live';
  direction: 'sent' | 'received';
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface UserDataExport {
  exportedAt: string;
  formatVersion: 2;
  profile: ReturnType<typeof publicProfile>;
  platformLinks: ReturnType<typeof publicPlatformLinks>;
  feedPosts: Array<{
    id: string;
    content: string;
    imageUrl?: string;
    createdAt: number;
    resharedFromId?: string;
  }>;
  reels: Array<{
    id: string;
    title: string;
    artist: string;
    genre: string;
    mediaType: string;
    createdAt: number;
    visibility?: string;
  }>;
  stories: Array<{
    id: string;
    content?: string;
    imageUrl?: string;
    musicTrack?: object;
    createdAt: number;
    expiresAt: number;
  }>;
  directMessages: Array<{
    id: string;
    peerId: string;
    direction: 'sent' | 'received';
    content: string;
    timestamp: number;
    accepted: boolean;
  }>;
  /** Messages envoyés dans les groupes dont l'utilisateur est membre. */
  groupMessages: Array<{
    id: string;
    groupId: string;
    groupName: string;
    content: string;
    timestamp: number;
  }>;
  /** Messages reçus dans les groupes dont l'utilisateur est membre. */
  groupMessagesReceived: Array<{
    id: string;
    groupId: string;
    groupName: string;
    senderId: string;
    content: string;
    timestamp: number;
  }>;
  /** Messages de chat salon (envoyés + reçus dans les salons participés). */
  salonChatMessages: ChatExportMessage[];
  /** Messages de chat live (envoyés + reçus dans les lives participés). */
  liveChatMessages: ChatExportMessage[];
  salonsHosted: Array<{
    id: string;
    title: string;
    platform: string;
    createdAt: number;
    isPublic: boolean;
  }>;
  livesHosted: Array<{
    id: string;
    title: string;
    platform: string;
    startedAt: number;
    isActive: boolean;
  }>;
  preferences: {
    isGhostMode: boolean;
    shareDistance?: boolean;
    locationPrecision?: string;
    allowPrivateMessages?: boolean;
    showAge?: boolean;
    hideBirthDateOnProfile?: boolean;
    birthDate?: string;
    language?: string;
    ageConfirmedAt?: number;
  };
  social: {
    following: string[];
    followers: string[];
    blockedUserIds: string[];
    mutedUserIds: string[];
    matches: Array<{ id: string; userAId: string; userBId: string; createdAt: number }>;
    heartsSent: Array<{ toUserId: string; at: number }>;
    heartsReceived: Array<{ fromUserId: string; at: number }>;
  };
  payments: {
    donations: Array<{
      id: string;
      liveId: string;
      amountCents: number;
      status: string;
      createdAt: number;
    }>;
    creatorSubscriptions: Array<{
      id: string;
      creatorId: string;
      tierId: string;
      status: string;
      createdAt: number;
    }>;
  };
  feedPostFavorites: string[];
  compositions: Array<{
    id: string;
    title: string;
    artist?: string;
    createdAt: number;
  }>;
}

function collectParticipatedSalonIds(userId: string): Set<string> {
  const ids = new Set<string>();
  for (const salon of db.salons.values()) {
    if (salon.hostId === userId) ids.add(salon.id);
  }
  for (const [salonId, messages] of db.salonChats) {
    if (messages.some((m) => m.senderId === userId)) ids.add(salonId);
  }
  return ids;
}

function collectParticipatedLiveIds(userId: string): Set<string> {
  const ids = new Set<string>();
  for (const live of db.lives.values()) {
    if (live.hostId === userId) ids.add(live.id);
  }
  for (const [liveId, messages] of db.liveChats) {
    if (messages.some((m) => m.senderId === userId)) ids.add(liveId);
  }
  return ids;
}

function exportRoomChatMessages(
  userId: string,
  roomIds: Set<string>,
  roomType: 'salon' | 'live',
  store: Map<string, import('../models/schema').ChatMessage[]>
): ChatExportMessage[] {
  const out: ChatExportMessage[] = [];
  for (const roomId of roomIds) {
    const messages = store.get(roomId) ?? [];
    for (const m of messages) {
      out.push({
        id: m.id,
        roomId: m.roomId || roomId,
        roomType,
        direction: m.senderId === userId ? 'sent' : 'received',
        senderId: m.senderId,
        senderName: m.senderName,
        content: m.content,
        timestamp: m.timestamp,
      });
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

export function buildUserDataExport(user: User): UserDataExport {
  const userId = user.id;

  const directMessages = db.directMessages
    .filter((m) => m.senderId === userId || m.receiverId === userId)
    .map((m) => ({
      id: m.id,
      peerId: m.senderId === userId ? m.receiverId : m.senderId,
      direction: m.senderId === userId ? ('sent' as const) : ('received' as const),
      content: m.content,
      timestamp: m.timestamp,
      accepted: m.accepted,
    }));

  const memberGroupIds = new Set(
    db.messageGroups.filter((g) => g.memberIds.includes(userId)).map((g) => g.id)
  );
  const groupNameById = new Map(db.messageGroups.map((g) => [g.id, g.name]));

  const groupMessages = db.groupMessages
    .filter((m) => m.senderId === userId && memberGroupIds.has(m.groupId))
    .map((m) => ({
      id: m.id,
      groupId: m.groupId,
      groupName: groupNameById.get(m.groupId) ?? m.groupId,
      content: m.content,
      timestamp: m.timestamp,
    }));

  const groupMessagesReceived = db.groupMessages
    .filter((m) => m.senderId !== userId && memberGroupIds.has(m.groupId))
    .map((m) => ({
      id: m.id,
      groupId: m.groupId,
      groupName: groupNameById.get(m.groupId) ?? m.groupId,
      senderId: m.senderId,
      content: m.content,
      timestamp: m.timestamp,
    }));

  const salonIds = collectParticipatedSalonIds(userId);
  const liveIds = collectParticipatedLiveIds(userId);
  const salonChatMessages = exportRoomChatMessages(userId, salonIds, 'salon', db.salonChats);
  const liveChatMessages = exportRoomChatMessages(userId, liveIds, 'live', db.liveChats);

  const following = [...(db.userFollows.get(userId) ?? new Set<string>())];
  const followers: string[] = [];
  for (const [followerId, set] of db.userFollows) {
    if (set.has(userId)) followers.push(followerId);
  }

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
    profile: publicProfile(user, true, userId),
    platformLinks: publicPlatformLinks(user),
    feedPosts: db.feedPosts
      .filter((p) => p.userId === userId)
      .map(({ id, content, imageUrl, videoUrl, createdAt, resharedFromId }) => ({
        id,
        content,
        imageUrl,
        videoUrl,
        createdAt,
        resharedFromId,
      })),
    reels: db.userReels
      .filter((r) => r.authorId === userId)
      .map(({ id, title, artist, genre, mediaType, createdAt, visibility }) => ({
        id,
        title,
        artist,
        genre,
        mediaType,
        createdAt,
        visibility,
      })),
    stories: db.stories
      .filter((s) => s.userId === userId)
      .map(({ id, content, imageUrl, musicTrack, createdAt, expiresAt }) => ({
        id,
        content,
        imageUrl,
        musicTrack,
        createdAt,
        expiresAt,
      })),
    directMessages,
    groupMessages,
    groupMessagesReceived,
    salonChatMessages,
    liveChatMessages,
    salonsHosted: [...db.salons.values()]
      .filter((s) => s.hostId === userId)
      .map(({ id, title, platform, createdAt, isPublic }) => ({
        id,
        title,
        platform,
        createdAt,
        isPublic,
      })),
    livesHosted: [...db.lives.values()]
      .filter((l) => l.hostId === userId)
      .map(({ id, title, platform, startedAt, isActive }) => ({
        id,
        title,
        platform,
        startedAt,
        isActive,
      })),
    preferences: {
      isGhostMode: user.isGhostMode,
      shareDistance: user.shareDistance,
      locationPrecision: user.locationPrecision,
      allowPrivateMessages: user.allowPrivateMessages,
      showAge: user.showAge,
      hideBirthDateOnProfile: user.hideBirthDateOnProfile,
      birthDate: user.birthDate,
      ageConfirmedAt: user.ageConfirmedAt,
    },
    social: {
      following,
      followers,
      blockedUserIds: db.userBlocks.filter((b) => b.blockerId === userId).map((b) => b.blockedId),
      mutedUserIds: db.userMutes.filter((m) => m.muterId === userId).map((m) => m.mutedId),
      matches: db.matches
        .filter((m) => m.userIdA === userId || m.userIdB === userId)
        .map(({ id, userIdA, userIdB, createdAt }) => ({
          id,
          userAId: userIdA,
          userBId: userIdB,
          createdAt,
        })),
      heartsSent: db.heartEvents
        .filter((h) => h.fromId === userId)
        .map(({ toId, createdAt }) => ({ toUserId: toId, at: createdAt })),
      heartsReceived: db.heartEvents
        .filter((h) => h.toId === userId)
        .map(({ fromId, createdAt }) => ({ fromUserId: fromId, at: createdAt })),
    },
    payments: {
      donations: db.donationPayments
        .filter((d) => d.senderId === userId || d.hostId === userId)
        .map(({ id, liveId, amountCents, status, createdAt }) => ({
          id,
          liveId,
          amountCents,
          status,
          createdAt,
        })),
      creatorSubscriptions: db.creatorSubscriptions
        .filter((s) => s.subscriberId === userId || s.creatorId === userId)
        .map(({ id, creatorId, tierId, status, createdAt }) => ({
          id,
          creatorId,
          tierId,
          status,
          createdAt,
        })),
    },
    feedPostFavorites: [...(db.feedPostFavorites.get(userId) ?? new Set<string>())],
    compositions: db.compositions
      .filter((c) => c.userId === userId)
      .map(({ id, title, artist, createdAt }) => ({
        id,
        title,
        artist,
        createdAt,
      })),
  };
}
