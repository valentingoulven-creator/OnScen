import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { db, type User, type FeedPost, type UserReel, type Story, type UserAlbum, type UserComposition } from '../models/schema';
import { getDataDir } from '../paths';

/**
 * Restauration d'un compte depuis l'admin (spec : commun/docs/RESTORE-COMPTE-ADMIN.md).
 *
 * Portée v1 : profil (champs métier uniquement — jamais les champs de sécurité,
 * voir RESTORABLE_PROFILE_FIELDS) + contenu possédé (feed, reels, stories,
 * albums, compositions). Explicitement hors scope v1 : DM, chats, follows,
 * paiements (données de tiers, cf. roadmap §7 de la spec).
 *
 * Stockage : fichiers locaux hors public/ (pas de migration DB en v1) —
 * voir getDataDir(). Restauration toujours via le store applicatif RAM
 * (db.* + schedulePersist), jamais de SQL direct — cf. contrainte flush
 * périodique documentée dans pgStore.ts:397-416.
 */

const FORMAT_VERSION = 1;

/**
 * Champs de profil restaurables (allowlist volontaire, pas une denylist) —
 * tout champ absent de cette liste n'est JAMAIS écrit par une restauration,
 * en particulier : passwordHash, mustChangePassword, isAdmin, accountStatus,
 * blockedUntil/Reason, emailVerified, totpSecret, twoFactorEnabled/BackupCodes,
 * tokenVersion, verificationToken/resetToken, meloCoins, email, username,
 * lastSeenAt, latitude/longitude.
 */
const RESTORABLE_PROFILE_FIELDS = [
  'usernameColor',
  'usernameWaveFrom',
  'usernameWaveTo',
  'avatarUrl',
  'profilePhotos',
  'bio',
  'interests',
  'favoriteGenres',
  'favoriteArtists',
  'connectedPlatforms',
  'platformAccounts',
  'city',
  'listeningRole',
  'profileType',
  'relationshipStatus',
  'relationshipStatusCustom',
  'birthDate',
  'hideBirthDateOnProfile',
  'age',
  'showAge',
  'shareDistance',
  'allowPrivateMessages',
  'allowExternalEventTags',
  'locationPrecision',
  'instagramHandle',
  'youtubeChannel',
  'isGhostMode',
  'salonCreateSetup',
  'liveMediaSetup',
] as const satisfies readonly (keyof User)[];

type RestorableProfile = Pick<User, (typeof RESTORABLE_PROFILE_FIELDS)[number]>;

export interface UserSnapshotItemCounts {
  feedPosts: number;
  reels: number;
  stories: number;
  albums: number;
  compositions: number;
}

export interface UserSnapshotMeta {
  id: string;
  userId: string;
  createdAt: number;
  createdBy?: string;
  reason?: string;
  sizeBytes: number;
  formatVersion: number;
  itemCounts: UserSnapshotItemCounts;
}

interface UserSnapshotPayload {
  formatVersion: 1;
  snapshotId: string;
  userId: string;
  createdAt: number;
  profile: RestorableProfile;
  feedPosts: FeedPost[];
  reels: UserReel[];
  stories: Story[];
  albums: UserAlbum[];
  compositions: UserComposition[];
}

function snapshotsDir(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(getDataDir(), 'user-snapshots', safeUserId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function contentPath(userId: string, snapshotId: string): string {
  return path.join(snapshotsDir(userId), `${snapshotId}.json.gz`);
}

function metaPath(userId: string, snapshotId: string): string {
  return path.join(snapshotsDir(userId), `${snapshotId}.meta.json`);
}

function extractRestorableProfile(user: User): RestorableProfile {
  const out = {} as RestorableProfile;
  for (const key of RESTORABLE_PROFILE_FIELDS) {
    // Cast : chaque clé provient de RESTORABLE_PROFILE_FIELDS (typé keyof User).
    (out as Record<string, unknown>)[key] = user[key];
  }
  return out;
}

/** Crée un snapshot restaurable du compte (profil + contenu possédé). */
export function createUserSnapshot(
  user: User,
  opts: { reason?: string; createdBy?: string } = {}
): UserSnapshotMeta {
  const userId = user.id;
  const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = Date.now();

  const feedPosts = db.feedPosts.filter((p) => p.userId === userId);
  const reels = db.userReels.filter((r) => r.authorId === userId);
  const stories = db.stories.filter((s) => s.userId === userId);
  const albums = db.albums.filter((a) => a.userId === userId);
  const compositions = db.compositions.filter((c) => c.userId === userId);

  const payload: UserSnapshotPayload = {
    formatVersion: FORMAT_VERSION,
    snapshotId,
    userId,
    createdAt,
    profile: extractRestorableProfile(user),
    feedPosts,
    reels,
    stories,
    albums,
    compositions,
  };

  const json = JSON.stringify(payload);
  const gzipped = zlib.gzipSync(Buffer.from(json, 'utf8'));
  fs.writeFileSync(contentPath(userId, snapshotId), gzipped);

  const meta: UserSnapshotMeta = {
    id: snapshotId,
    userId,
    createdAt,
    createdBy: opts.createdBy,
    reason: opts.reason,
    sizeBytes: gzipped.byteLength,
    formatVersion: FORMAT_VERSION,
    itemCounts: {
      feedPosts: feedPosts.length,
      reels: reels.length,
      stories: stories.length,
      albums: albums.length,
      compositions: compositions.length,
    },
  };
  fs.writeFileSync(metaPath(userId, snapshotId), JSON.stringify(meta));

  return meta;
}

/** Liste les snapshots existants d'un compte, du plus récent au plus ancien. */
export function listUserSnapshots(userId: string): UserSnapshotMeta[] {
  const dir = snapshotsDir(userId);
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const metas: UserSnapshotMeta[] = [];
  for (const file of files) {
    if (!file.endsWith('.meta.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      metas.push(JSON.parse(raw) as UserSnapshotMeta);
    } catch {
      // Fichier corrompu/partiel — ignoré silencieusement, n'empêche pas la liste.
    }
  }
  return metas.sort((a, b) => b.createdAt - a.createdAt);
}

export class SnapshotNotFoundError extends Error {}

function loadSnapshotPayload(userId: string, snapshotId: string): UserSnapshotPayload {
  let gzipped: Buffer;
  try {
    gzipped = fs.readFileSync(contentPath(userId, snapshotId));
  } catch {
    throw new SnapshotNotFoundError(`Snapshot introuvable : ${snapshotId}`);
  }
  const json = zlib.gunzipSync(gzipped).toString('utf8');
  const payload = JSON.parse(json) as UserSnapshotPayload;
  if (payload.userId !== userId) {
    throw new SnapshotNotFoundError('Snapshot invalide (userId ne correspond pas)');
  }
  return payload;
}

export interface RestoreUserSnapshotResult {
  user: User;
  itemCounts: UserSnapshotItemCounts;
}

/**
 * Restaure un compte depuis un snapshot — profil (champs métier only) +
 * remplacement du contenu possédé par cet utilisateur uniquement (jamais les
 * données des autres comptes). Écrit exclusivement dans le store RAM puis
 * planifie la persistance (schedulePersist) — jamais de SQL direct.
 */
export function restoreUserFromSnapshot(userId: string, snapshotId: string): RestoreUserSnapshotResult {
  const payload = loadSnapshotPayload(userId, snapshotId);
  const user = db.users.get(userId);
  if (!user) {
    throw new SnapshotNotFoundError('Compte introuvable — restauration annulée');
  }

  for (const key of RESTORABLE_PROFILE_FIELDS) {
    (user as unknown as Record<string, unknown>)[key] = (payload.profile as Record<string, unknown>)[key];
  }
  db.users.set(userId, user);

  db.feedPosts = [...db.feedPosts.filter((p) => p.userId !== userId), ...payload.feedPosts];
  db.userReels = [...db.userReels.filter((r) => r.authorId !== userId), ...payload.reels];
  db.stories = [...db.stories.filter((s) => s.userId !== userId), ...payload.stories];
  db.albums = [...db.albums.filter((a) => a.userId !== userId), ...payload.albums];
  db.compositions = [...db.compositions.filter((c) => c.userId !== userId), ...payload.compositions];

  return {
    user,
    itemCounts: {
      feedPosts: payload.feedPosts.length,
      reels: payload.reels.length,
      stories: payload.stories.length,
      albums: payload.albums.length,
      compositions: payload.compositions.length,
    },
  };
}
