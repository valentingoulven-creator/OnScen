import crypto from 'crypto';
import { db, type UserAlbum, type UserComposition } from '../models/schema';
import { favoritesAlbumId, isFavoritesAlbumId } from './musicFavoritesIds';
import { scheduleDeleteCompositionFromPg, schedulePersistCompositionToPg } from './pgCompositions';
import { schedulePersistAlbumToPg } from './pgAlbums';
import { schedulePersist } from './persist';

export const FAVORITES_ALBUM_TITLE = 'Mes favoris';

export { favoritesAlbumId, isFavoritesAlbumId };

export function ensureFavoritesAlbum(userId: string): UserAlbum {
  const id = favoritesAlbumId(userId);
  const existing = db.albums.find((a) => a.id === id && a.userId === userId);
  if (existing) return existing;

  const now = Date.now();
  const album: UserAlbum = {
    id,
    userId,
    title: FAVORITES_ALBUM_TITLE,
    description: 'Morceaux enregistrés depuis le lecteur Soundy.',
    createdAt: now,
    updatedAt: now,
  };
  db.albums.push(album);
  schedulePersistAlbumToPg(album);
  schedulePersist();
  return album;
}

function favoritesAlbumForUser(userId: string): UserAlbum | undefined {
  const id = favoritesAlbumId(userId);
  return db.albums.find((a) => a.id === id && a.userId === userId);
}

export function listFavoriteSourceCompositionIds(userId: string): string[] {
  const album = favoritesAlbumForUser(userId);
  if (!album) return [];
  return db.compositions
    .filter((c) => c.userId === userId && c.albumId === album.id)
    .map((c) => c.sourceCompositionId ?? c.id);
}

export function isTrackFavorited(userId: string, compositionId: string): boolean {
  const album = favoritesAlbumForUser(userId);
  if (!album) return false;
  const comp = db.compositions.find((c) => c.id === compositionId);
  if (comp?.userId === userId && comp.albumId === album.id) return true;
  return db.compositions.some(
    (c) =>
      c.userId === userId &&
      c.albumId === album.id &&
      (c.sourceCompositionId === compositionId || c.id === compositionId)
  );
}

export function addTrackToFavorites(
  userId: string,
  sourceCompositionId: string
): { ok: true; alreadySaved: boolean } | { error: string } {
  const favAlbum = ensureFavoritesAlbum(userId);
  return saveTrackToAlbum(userId, favAlbum.id, sourceCompositionId);
}

function isTrackInAlbum(userId: string, albumId: string, compositionId: string): boolean {
  return db.compositions.some(
    (c) =>
      c.userId === userId &&
      c.albumId === albumId &&
      (c.id === compositionId || c.sourceCompositionId === compositionId)
  );
}

/**
 * Ajoute une référence d'un morceau (ex. lecture depuis l'onglet Musique) dans une
 * playlist/album possédé par l'utilisateur, façon « Ajouter à une playlist » Spotify.
 * Généralisation de la mécanique `addTrackToFavorites` (copie légère avec
 * `sourceCompositionId`) à n'importe quel album appartenant à `userId`.
 */
export function saveTrackToAlbum(
  userId: string,
  targetAlbumId: string,
  sourceCompositionId: string
): { ok: true; alreadySaved: boolean } | { error: string } {
  const source = db.compositions.find((c) => c.id === sourceCompositionId);
  if (!source) {
    return { error: 'Morceau introuvable' };
  }

  const album = db.albums.find((a) => a.id === targetAlbumId && a.userId === userId);
  if (!album) {
    return { error: 'Playlist introuvable' };
  }

  if (isTrackInAlbum(userId, album.id, sourceCompositionId)) {
    return { ok: true, alreadySaved: true };
  }

  const now = Date.now();
  const bookmark: UserComposition = {
    id: `comp-${userId}-${now}-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    albumId: album.id,
    title: source.title,
    ...(source.artist?.trim() ? { artist: source.artist.trim() } : {}),
    fileUrl: source.fileUrl,
    ...(source.durationSec != null ? { durationSec: source.durationSec } : {}),
    sourceCompositionId: source.id,
    createdAt: now,
  };

  db.compositions.push(bookmark);
  album.updatedAt = now;
  schedulePersistCompositionToPg(bookmark);
  schedulePersistAlbumToPg(album);
  schedulePersist();
  return { ok: true, alreadySaved: false };
}

export function removeTrackFromFavorites(
  userId: string,
  compositionId: string
): { ok: true; removed: boolean } | { error: string } {
  const album = favoritesAlbumForUser(userId);
  if (!album) return { ok: true, removed: false };

  const index = db.compositions.findIndex(
    (c) =>
      c.userId === userId &&
      c.albumId === album.id &&
      (c.id === compositionId ||
        c.sourceCompositionId === compositionId ||
        (c.sourceCompositionId == null && c.id === compositionId))
  );
  if (index < 0) return { ok: true, removed: false };

  const [removed] = db.compositions.splice(index, 1);
  album.updatedAt = Date.now();
  scheduleDeleteCompositionFromPg(removed.id);
  schedulePersistAlbumToPg(album);
  schedulePersist();
  return { ok: true, removed: true };
}
