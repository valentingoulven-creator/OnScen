import crypto from 'crypto';
import { db, type UserComposition } from '../models/schema';

const MAX_COMPOSITIONS_PER_USER = parseInt(process.env.MAX_COMPOSITIONS_PER_USER ?? '50', 10) || 50;
import {
  deleteCompositionFileIfLocal,
  decodeCompositionDataUrl,
  isValidCompositionFileUrl,
  saveCompositionBuffer,
  COMPOSITION_AUDIO_DATA_RE,
  UPLOADS_FILE_RE,
} from './compositionAssets';
import { checkUploadedAudioCopyright } from './acrCloud';
import { getAcrCloudMaxSampleBytes } from './acrCloudConfig';
import {
  scheduleDeleteCompositionFromPg,
  scheduleDeleteCompositionsByUserFromPg,
  schedulePersistCompositionToPg,
} from './pgCompositions';
import { schedulePersistAlbumToPg } from './pgAlbums';
import { deleteCompositionUpvotes } from './compositionUpvotes';
import { removeCompositionPlays } from './compositionPlays';
import { schedulePersist } from './persist';

export type PublicComposition = {
  id: string;
  userId: string;
  albumId?: string;
  title: string;
  artist?: string;
  fileUrl: string;
  durationSec?: number;
  createdAt: number;
};

function normalizeDurationSec(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.round(value), 24 * 60 * 60);
}

export function publicComposition(c: UserComposition): PublicComposition {
  return {
    id: c.id,
    userId: c.userId,
    ...(c.albumId ? { albumId: c.albumId } : {}),
    title: c.title,
    ...(c.artist?.trim() ? { artist: c.artist.trim() } : {}),
    fileUrl: c.fileUrl,
    ...(c.durationSec != null ? { durationSec: c.durationSec } : {}),
    createdAt: c.createdAt,
  };
}

export function listUserCompositions(userId: string): PublicComposition[] {
  return db.compositions
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicComposition);
}

export interface CreateCompositionInput {
  title: string;
  artist?: string;
  fileUrl: string;
  durationSec?: number;
  albumId?: string;
  rightsConfirmed?: boolean;
}

export async function createUserComposition(
  userId: string,
  input: CreateCompositionInput
): Promise<PublicComposition | { error: string }> {
  if (input.rightsConfirmed !== true) {
    return {
      error:
        'Vous devez confirmer être l\'auteur de ce morceau ou disposer des droits nécessaires pour le publier.',
    };
  }
  const title = input.title.trim();
  const artist = input.artist?.trim();
  const rawFileUrl = input.fileUrl.trim();

  if (!title) {
    return { error: 'Titre requis' };
  }

  const existingCount = db.compositions.filter((c) => c.userId === userId).length;
  if (existingCount >= MAX_COMPOSITIONS_PER_USER) {
    return {
      error: `Limite de compositions atteinte (${MAX_COMPOSITIONS_PER_USER} max). Supprimez des fichiers pour en ajouter d'autres.`,
    };
  }

  if (!isValidCompositionFileUrl(rawFileUrl)) {
    return { error: 'Fichier audio invalide (mp3, wav, m4a, ogg — max 30 Mo)' };
  }

  const albumId = input.albumId?.trim();
  if (albumId) {
    const album = db.albums.find((a) => a.id === albumId && a.userId === userId);
    if (!album) {
      return { error: 'Album introuvable' };
    }
  }

  let fileUrl: string;
  try {
    const trimmed = rawFileUrl.trim();
    if (COMPOSITION_AUDIO_DATA_RE.test(trimmed)) {
      const decoded = decodeCompositionDataUrl(trimmed);
      const copyrightError = await checkUploadedAudioCopyright(
        decoded.buffer.subarray(0, getAcrCloudMaxSampleBytes())
      );
      if (copyrightError) {
        return { error: copyrightError };
      }
      fileUrl = saveCompositionBuffer(decoded.buffer, decoded.mime);
    } else if (UPLOADS_FILE_RE.test(trimmed)) {
      fileUrl = trimmed;
    } else {
      throw new Error('Fichier audio invalide (mp3, wav, m4a, ogg — max 30 Mo)');
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible d\'enregistrer le fichier audio' };
  }

  const now = Date.now();
  const composition: UserComposition = {
    id: `comp-${userId}-${now}-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    ...(albumId ? { albumId } : {}),
    title: title.slice(0, 120),
    ...(artist ? { artist: artist.slice(0, 120) } : {}),
    fileUrl,
    createdAt: now,
    ...(normalizeDurationSec(input.durationSec) != null
      ? { durationSec: normalizeDurationSec(input.durationSec) }
      : {}),
  };

  db.compositions.push(composition);
  if (albumId) {
    const album = db.albums.find((a) => a.id === albumId && a.userId === userId);
    if (album) {
      album.updatedAt = now;
      schedulePersistAlbumToPg(album);
    }
  }
  schedulePersistCompositionToPg(composition);
  schedulePersist();
  return publicComposition(composition);
}

export function deleteUserComposition(compositionId: string, userId: string): boolean {
  const index = db.compositions.findIndex((c) => c.id === compositionId && c.userId === userId);
  if (index < 0) return false;
  const [removed] = db.compositions.splice(index, 1);
  deleteCompositionUpvotes(compositionId);
  removeCompositionPlays(compositionId);
  deleteCompositionFileIfLocal(removed.fileUrl);
  scheduleDeleteCompositionFromPg(compositionId);
  if (removed.albumId) {
    const album = db.albums.find((a) => a.id === removed.albumId && a.userId === userId);
    if (album) {
      album.updatedAt = Date.now();
      schedulePersistAlbumToPg(album);
    }
  }
  schedulePersist();
  return true;
}

export function deleteCompositionsByUser(userId: string): void {
  const toRemove = db.compositions.filter((c) => c.userId === userId);
  db.compositions = db.compositions.filter((c) => c.userId !== userId);
  for (const c of toRemove) {
    deleteCompositionFileIfLocal(c.fileUrl);
  }
  scheduleDeleteCompositionsByUserFromPg(userId);
  schedulePersist();
}
