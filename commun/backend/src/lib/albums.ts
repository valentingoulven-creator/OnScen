import crypto from 'crypto';
import { db, type UserAlbum } from '../models/schema';
import {
  deleteAlbumCoverIfLocal,
  isValidAlbumCoverUrl,
  resolveAlbumCoverUrl,
} from './albumCoverAssets';
import {
  deleteUserComposition,
  listUserCompositions,
  type PublicComposition,
} from './compositions';
import { isFavoritesAlbumId } from './musicFavoritesIds';
import {
  scheduleDeleteAlbumFromPg,
  scheduleDeleteAlbumsByUserFromPg,
  schedulePersistAlbumToPg,
} from './pgAlbums';
import { schedulePersist } from './persist';
import { notifyFollowersCreatorActivity } from './followActivityNotifications';

const MAX_ALBUMS_PER_USER = parseInt(process.env.MAX_ALBUMS_PER_USER ?? '30', 10) || 30;

export type PublicAlbum = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
};

function trackCountForAlbum(userId: string, albumId: string | null): number {
  return db.compositions.filter(
    (c) => c.userId === userId && (albumId ? c.albumId === albumId : !c.albumId)
  ).length;
}

function publicAlbum(album: UserAlbum): PublicAlbum {
  return {
    id: album.id,
    userId: album.userId,
    title: album.title,
    ...(album.description?.trim() ? { description: album.description.trim() } : {}),
    ...(album.coverUrl?.trim() ? { coverUrl: album.coverUrl.trim() } : {}),
    trackCount: trackCountForAlbum(album.userId, album.id),
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

export function listUserAlbums(userId: string): PublicAlbum[] {
  return db.albums
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(publicAlbum);
}

export function getUserAlbum(albumId: string, userId: string): UserAlbum | undefined {
  const album = db.albums.find((a) => a.id === albumId && a.userId === userId);
  return album;
}

export function listAlbumTracks(userId: string, albumId: string | null): PublicComposition[] {
  if (albumId) {
    const album = getUserAlbum(albumId, userId);
    if (!album) return [];
  }
  return listUserCompositions(userId).filter((c) =>
    albumId ? c.albumId === albumId : !c.albumId
  );
}

export interface CreateAlbumInput {
  title: string;
  description?: string;
  coverUrl?: string;
}

export function createUserAlbum(
  userId: string,
  input: CreateAlbumInput
): PublicAlbum | { error: string } {
  const title = input.title.trim();
  if (!title) {
    return { error: 'Titre requis' };
  }

  const existingCount = db.albums.filter((a) => a.userId === userId).length;
  if (existingCount >= MAX_ALBUMS_PER_USER) {
    return {
      error: `Limite d'albums atteinte (${MAX_ALBUMS_PER_USER} max). Supprimez un album pour en créer un autre.`,
    };
  }

  let coverUrl: string | undefined;
  const rawCover = input.coverUrl?.trim();
  if (rawCover) {
    if (!isValidAlbumCoverUrl(rawCover)) {
      return { error: 'Image de couverture invalide (jpeg, png, webp, gif — max 3 Mo)' };
    }
    try {
      coverUrl = resolveAlbumCoverUrl(rawCover);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Impossible d\'enregistrer la couverture',
      };
    }
  }

  const now = Date.now();
  const album: UserAlbum = {
    id: `album-${userId}-${now}-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    title: title.slice(0, 120),
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 500) } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    createdAt: now,
    updatedAt: now,
  };

  db.albums.push(album);
  schedulePersistAlbumToPg(album);
  schedulePersist();
  const author = db.users.get(userId);
  if (author) {
    notifyFollowersCreatorActivity({
      creator: author,
      type: 'album_published',
      message: `${author.username} a publié l'album « ${album.title} » 💿`,
      albumId: album.id,
    });
  }
  return publicAlbum(album);
}

export function deleteUserAlbum(albumId: string, userId: string): boolean {
  if (isFavoritesAlbumId(albumId, userId)) {
    return false;
  }
  const index = db.albums.findIndex((a) => a.id === albumId && a.userId === userId);
  if (index < 0) return false;

  const [removed] = db.albums.splice(index, 1);
  if (removed.coverUrl) deleteAlbumCoverIfLocal(removed.coverUrl);

  const tracks = db.compositions.filter((c) => c.albumId === albumId && c.userId === userId);
  for (const track of tracks) {
    deleteUserComposition(track.id, userId);
  }

  scheduleDeleteAlbumFromPg(albumId);
  schedulePersist();
  return true;
}

export function deleteAlbumsByUser(userId: string): void {
  const toRemove = db.albums.filter((a) => a.userId === userId);
  db.albums = db.albums.filter((a) => a.userId !== userId);
  for (const album of toRemove) {
    if (album.coverUrl) deleteAlbumCoverIfLocal(album.coverUrl);
  }
  scheduleDeleteAlbumsByUserFromPg(userId);
  schedulePersist();
}

export function looseTrackCount(userId: string): number {
  return trackCountForAlbum(userId, null);
}
