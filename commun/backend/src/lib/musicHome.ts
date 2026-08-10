import { db, type UserAlbum, type UserComposition, type UserReel } from '../models/schema';
import { getCompositionUpvoteCount, userHasCompositionUpvote } from './compositionUpvotes';
import { getWeeklyCompositionPlayCounts } from './compositionPlays';
import { getFollowingIds } from './follows';
import { ensureFavoritesAlbum, favoritesAlbumId } from './musicFavorites';
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
  weeklyPlayCount?: number;
  createdAt: number;
  /** Fichier audio jouable (lecteur global façon Spotify). */
  fileUrl: string;
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
  /** Pistes d’artistes déjà appréciées (upvote / écoute), hors titres déjà upvotés. */
  recommended: MusicHomeSection;
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
    fileUrl: c.fileUrl,
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

function buildPopularSection(viewerId: string): MusicHomeSection {
  const weeklyPlays = getWeeklyCompositionPlayCounts();

  const tracks: MusicTrackItem[] = [...weeklyPlays.entries()]
    .sort((a, b) => b[1] - a[1] || 0)
    .slice(0, 12)
    .flatMap(([compositionId, weeklyPlayCount]) => {
      const composition = db.compositions.find((c) => c.id === compositionId);
      if (!composition) return [];
      return [
        {
          ...compositionTrack(composition, viewerId),
          weeklyPlayCount,
        },
      ];
    });

  const albums: MusicAlbumItem[] = db.albums
    .map((album) => {
      const item = albumItem(album);
      const plays = db.compositions
        .filter((c) => c.albumId === album.id && c.userId === album.userId)
        .reduce((sum, c) => sum + (weeklyPlays.get(c.id) ?? 0), 0);
      return { item, plays };
    })
    .filter(({ plays }) => plays > 0)
    .sort((a, b) => b.plays - a.plays || b.item.updatedAt - a.item.updatedAt)
    .slice(0, 12)
    .map(({ item }) => item);

  return { albums, tracks };
}

function buildRecommendedSection(viewerId: string): MusicHomeSection {
  const upvotedIds = new Set(
    db.compositionUpvotes.filter((u) => u.userId === viewerId).map((u) => u.compositionId)
  );
  const artistIds = new Set<string>();
  for (const upvote of db.compositionUpvotes) {
    if (upvote.userId !== viewerId) continue;
    const comp = db.compositions.find((c) => c.id === upvote.compositionId);
    if (comp) artistIds.add(comp.userId);
  }
  for (const play of db.compositionPlays) {
    if (play.listenerId !== viewerId) continue;
    const comp = db.compositions.find((c) => c.id === play.compositionId);
    if (comp) artistIds.add(comp.userId);
  }

  const tracks: MusicTrackItem[] = db.compositions
    .filter((c) => artistIds.has(c.userId) && !upvotedIds.has(c.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((c) => compositionTrack(c, viewerId));

  const albums = albumsForUserIds(artistIds, 8);
  return { albums, tracks };
}

export function buildMusicHome(viewerId: string): MusicHomePayload {
  const following = new Set(getFollowingIds(viewerId));
  const everyone = allUserIds();

  const popular = buildPopularSection(viewerId);

  const looseTracks = db.compositions
    .filter((c) => c.userId === viewerId && !c.albumId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((c) => compositionTrack(c, viewerId));

  ensureFavoritesAlbum(viewerId);
  const favId = favoritesAlbumId(viewerId);
  const libraryAlbums = db.albums
    .filter((a) => a.userId === viewerId)
    .sort((a, b) => {
      if (a.id === favId) return -1;
      if (b.id === favId) return 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 12)
    .map(albumItem);

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
      albums: libraryAlbums,
      tracks: looseTracks,
    },
    popular,
    weeklyTrend: buildWeeklyTrendSection(viewerId),
    recommended: buildRecommendedSection(viewerId),
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
