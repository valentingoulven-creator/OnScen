import { db, User } from '../models/schema';
import { publicProfile } from './profile';
import { publicPlatformLinks } from './platformConnect';

export interface UserDataExport {
  exportedAt: string;
  formatVersion: 1;
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
  groupMessages: Array<{
    id: string;
    groupId: string;
    groupName: string;
    content: string;
    timestamp: number;
  }>;
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
    showAge?: boolean;
    hideBirthDateOnProfile?: boolean;
    birthDate?: string;
    language?: string;
  };
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

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
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
      showAge: user.showAge,
      hideBirthDateOnProfile: user.hideBirthDateOnProfile,
      birthDate: user.birthDate,
    },
  };
}
