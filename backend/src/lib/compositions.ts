import crypto from 'crypto';
import { db, type UserComposition } from '../models/schema';
import {
  deleteCompositionFileIfLocal,
  isValidCompositionFileUrl,
  resolveCompositionFileUrl,
} from './compositionAssets';
import {
  scheduleDeleteCompositionFromPg,
  scheduleDeleteCompositionsByUserFromPg,
  schedulePersistCompositionToPg,
} from './pgCompositions';

export type PublicComposition = {
  id: string;
  userId: string;
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
}

export function createUserComposition(
  userId: string,
  input: CreateCompositionInput
): PublicComposition | { error: string } {
  const title = input.title.trim();
  const artist = input.artist?.trim();
  const rawFileUrl = input.fileUrl.trim();

  if (!title) {
    return { error: 'Titre requis' };
  }
  if (!isValidCompositionFileUrl(rawFileUrl)) {
    return { error: 'Fichier audio invalide (mp3, wav, m4a, ogg — max 30 Mo)' };
  }

  let fileUrl: string;
  try {
    fileUrl = resolveCompositionFileUrl(rawFileUrl);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible d\'enregistrer le fichier audio' };
  }

  const composition: UserComposition = {
    id: `comp-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    title: title.slice(0, 120),
    ...(artist ? { artist: artist.slice(0, 120) } : {}),
    fileUrl,
    createdAt: Date.now(),
    ...(normalizeDurationSec(input.durationSec) != null
      ? { durationSec: normalizeDurationSec(input.durationSec) }
      : {}),
  };

  db.compositions.push(composition);
  schedulePersistCompositionToPg(composition);
  return publicComposition(composition);
}

export function deleteUserComposition(compositionId: string, userId: string): boolean {
  const index = db.compositions.findIndex((c) => c.id === compositionId && c.userId === userId);
  if (index < 0) return false;
  const [removed] = db.compositions.splice(index, 1);
  deleteCompositionFileIfLocal(removed.fileUrl);
  scheduleDeleteCompositionFromPg(compositionId);
  return true;
}

export function deleteCompositionsByUser(userId: string): void {
  const toRemove = db.compositions.filter((c) => c.userId === userId);
  db.compositions = db.compositions.filter((c) => c.userId !== userId);
  for (const c of toRemove) {
    deleteCompositionFileIfLocal(c.fileUrl);
  }
  scheduleDeleteCompositionsByUserFromPg(userId);
}
