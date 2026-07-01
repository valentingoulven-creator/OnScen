import { db, type UserAlbum, type UserComposition, type UserReel } from '../models/schema';
import { getCompositionUpvoteCount, userHasCompositionUpvote } from './compositionUpvotes';
import { getFollowingIds } from './follows';
import { isAdminBlockedReel, isPrivateReel } from './reels';
import {
  getWeekStart,
  getWeeklyCompositionUpvoteCounts,
  getWeeklyReelUpvoteCounts,
} from './weeklyVotes';

export interface MusicAlbumItem {
  id: string;
  userId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  updatedAt: number;
}

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  source: 'composition';
  hostId: string;
  creatorName: string;
  albumId?: string;
  albumTitle?: string;
  durationSec?: number;
  upvoteCount?: number;
  userHasUpvoted?: boolean;
  createdAt: number;
}

export interface MusicWeeklyReelItem {
  id: string;
  title: string;
  artist: string;
  posterUrl: string;
  authorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  weeklyUpvoteCount: number;
  durationSec?: number;
}

export interface MusicHomeSection {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}

export interface MusicHomeWeeklySection extends MusicHomeSection {
  weekStart: number;
  reels: MusicWeeklyReelItem[];
}

export interface MusicHomePayload {
  discover: MusicHomeSection;
  following: MusicHomeSection;
  library: MusicHomeSection;
  popular: MusicHomeSection;
  weeklyTrend: MusicHomeWeeklySection;
}

export interface MusicSearchPayload {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}

function trackCountForAlbum(userId: string, albumId: string): number {
  return db.compositions.filter((c) => c.userId === userId && c.albumId === albumId).length;
}

function albumItem(album: UserAlbum): MusicAlbumItem {
  const user = db.users.get(album.userId);
  return {
    id: album.id,
    userId: album.userId,
    creatorName: user?.username ?? 'Utilisateur',
    ...(user?.avatarUrl ? { creatorAvatarUrl: user.avatarUrl } : {}),
    title: album.title,
    ...(album.description?.trim() ? { description: album.description.trim() } : {}),
    ...(album.coverUrl?.trim() ? { coverUrl: album.coverUrl.trim() } : {}),
    trackCount: trackCountForAlbum(album.userId, album.id),
    updatedAt: album.updatedAt,
  };
}

function compositionTrack(c: UserComposition, viewerId: string): MusicTrackItem {
  const user = db.users.get(c.userId);
  const album = c.albumId ? db.albums.find((a) => a.id === c.albumId && a.userId === c.userId) : undefined;
  return {
    id: c.id,
    title: c.title,
    artist: c.artist?.trim() || user?.username || 'Artiste',
    ...(album?.coverUrl?.trim() ? { albumArtUrl: album.coverUrl.trim() } : {}),
    source: 'composition',
    hostId: c.userId,
    creatorName: user?.username ?? 'Utilisateur',
    ...(c.albumId ? { albumId: c.albumId } : {}),
    ...(album?.title ? { albumTitle: album.title } : {}),
    ...(c.durationSec != null ? { durationSec: c.durationSec } : {}),
    upvoteCount: getCompositionUpvoteCount(c.id),
    userHasUpvoted: userHasCompositionUpvote(c.id, viewerId),
    createdAt: c.createdAt,
  };
}

function albumsForUserIds(userIds: Set<string>, limit: number): MusicAlbumItem[] {
  return db.albums
    .filter((a) => userIds.has(a.userId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(albumItem);
}

function tracksForUserIds(userIds: Set<string>, viewerId: string, limit: number): MusicTrackItem[] {
  return db.compositions
    .filter((c) => userIds.has(c.userId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((c) => compositionTrack(c, viewerId));
}

function allUserIds(): Set<string> {
  return new Set([...db.users.keys()]);
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function matchesQuery(text: string | undefined, q: string): boolean {
  if (!q) return true;
  return (text ?? '').toLowerCase().includes(q);
}

function weeklyReelItem(reel: UserReel, weeklyUpvotes: number): MusicWeeklyReelItem {
  const user = db.users.get(reel.authorId);
  const legacyMediaUrl = (reel as UserReel & { mediaUrl?: string }).mediaUrl;
  const posterUrl =
    reel.posterUrl ||
    (reel.mediaType === 'image' ? legacyMediaUrl : undefined) ||
    reel.videoUrl ||
    '';
  return {
    id: reel.id,
    title: reel.title,
    artist: reel.artist,
    posterUrl,
    authorId: reel.authorId,
    creatorName: user?.username ?? 'Utilisateur',
    ...(user?.avatarUrl ? { creatorAvatarUrl: user.avatarUrl } : {}),
    weeklyUpvoteCount: weeklyUpvotes,
    ...(reel.durationSec != null && reel.durationSec > 0 ? { durationSec: reel.durationSec } : {}),
  };
}

function buildWeeklyTrendSection(viewerId: string): MusicHomeWeeklySection {
  const weekStart = getWeekStart();
  const weeklyCounts = getWeeklyCompositionUpvoteCounts();
  const reelCounts = getWeeklyReelUpvoteCounts();

  const tracks: MusicTrackItem[] = [...weeklyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .flatMap(([compositionId, weeklyUpvotes]) => {
      const composition = db.compositions.find((c) => c.id === compositionId);
      if (!composition) return [];
      return [
        {
          ...compositionTrack(composition, viewerId),
          upvoteCount: weeklyUpvotes,
        },
      ];
    });

  const albums: MusicAlbumItem[] = db.albums
    .map((album) => {
      const weeklyUpvotes = db.compositions
        .filter((c) => c.userId === album.userId && c.albumId === album.id)
        .reduce((sum, c) => sum + (weeklyCounts.get(c.id) ?? 0), 0);
      return { album, weeklyUpvotes };
    })
    .filter(({ weeklyUpvotes }) => weeklyUpvotes > 0)
    .sort((a, b) => b.weeklyUpvotes - a.weeklyUpvotes || b.album.updatedAt - a.album.updatedAt)
    .slice(0, 12)
    .map(({ album }) => albumItem(album));

  const reels: MusicWeeklyReelItem[] = [...reelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .flatMap(([reelId, weeklyUpvotes]) => {
      const reel = db.userReels.find((r) => r.id === reelId);
      if (!reel || isPrivateReel(reel) || isAdminBlockedReel(reel)) return [];
      return [weeklyReelItem(reel, weeklyUpvotes)];
    });

  return { albums, tracks, reels, weekStart };
}

export function buildMusicHome(viewerId: string): MusicHomePayload {
  const following = new Set(getFollowingIds(viewerId));
  const everyone = allUserIds();

  const popularTracks = [...db.compositions]
    .map((c) => compositionTrack(c, viewerId))
    .sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0) || b.createdAt - a.createdAt)
    .slice(0, 12);

  const popularAlbums = [...db.albums]
    .map((album) => {
      const item = albumItem(album);
      const likes = db.compositions
        .filter((c) => c.albumId === album.id && c.userId === album.userId)
        .reduce((sum, c) => sum + getCompositionUpvoteCount(c.id), 0);
      return { item, likes };
    })
    .sort((a, b) => b.likes - a.likes || b.item.updatedAt - a.item.updatedAt)
    .slice(0, 12)
    .map(({ item }) => item);

  const looseTracks = db.compositions
    .filter((c) => c.userId === viewerId && !c.albumId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((c) => compositionTrack(c, viewerId));

  return {
    discover: {
      albums: albumsForUserIds(everyone, 16),
      tracks: tracksForUserIds(everyone, viewerId, 16),
    },
    following: {
      albums: albumsForUserIds(following, 12),
      tracks: tracksForUserIds(following, viewerId, 12),
    },
    library: {
      albums: db.albums
        .filter((a) => a.userId === viewerId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map(albumItem),
      tracks: looseTracks,
    },
    popular: {
      albums: popularAlbums,
      tracks: popularTracks,
    },
    weeklyTrend: buildWeeklyTrendSection(viewerId),
  };
}

export function searchCommunityMusic(
  viewerId: string,
  queryRaw: string,
  limit = 20
): MusicSearchPayload {
  const q = normalizeQuery(queryRaw);
  if (q.length < 2) return { albums: [], tracks: [] };

  const albums: MusicAlbumItem[] = [];
  for (const album of db.albums) {
    const user = db.users.get(album.userId);
    const creatorName = user?.username ?? '';
    if (
      !matchesQuery(album.title, q) &&
      !matchesQuery(album.description, q) &&
      !matchesQuery(creatorName, q)
    ) {
      continue;
    }
    albums.push(albumItem(album));
    if (albums.length >= limit) break;
  }

  const tracks: MusicTrackItem[] = [];
  for (const c of db.compositions) {
    const user = db.users.get(c.userId);
    const album = c.albumId
      ? db.albums.find((a) => a.id === c.albumId && a.userId === c.userId)
      : undefined;
    const artist = c.artist?.trim() || user?.username || '';
    if (
      !matchesQuery(c.title, q) &&
      !matchesQuery(artist, q) &&
      !matchesQuery(album?.title, q) &&
      !matchesQuery(user?.username, q)
    ) {
      continue;
    }
    tracks.push(compositionTrack(c, viewerId));
    if (tracks.length >= limit) break;
  }

  return { albums, tracks };
}
