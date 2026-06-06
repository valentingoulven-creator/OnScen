import { db, User, type MusicPlatform, type PlaybackState, type RelationshipStatus } from '../models/schema';
import { ensurePlatformAccountsFromLegacy, publicPlatformLinks } from './platformConnect';
import { getHostRatingSummary } from './ratings';
import { migrateUserProfileType } from './profileTypes';
import { isFollowing } from './follows';
import { getFavoriteCount } from './favorites';
import {
  getActiveLiveIdForHost,
  getLiveViewersCountForHost,
  isUserHostingLive,
} from './liveStatus';
import { getAccountStatus, isAccessAdmin } from './accessControl';

export const DEFAULT_INTERESTS = [
  'Découvertes live',
  'Écoute partagée',
  'Nouveaux morceaux',
];

export const DEFAULT_GENRES = ['Électro', 'Indie', 'Hip-hop'];

export const MAX_PROFILE_PHOTOS = 6;

export const MIN_PROFILE_AGE = 13;
export const MAX_PROFILE_AGE = 120;

const VALID_RELATIONSHIP_STATUSES: RelationshipStatus[] = ['celibataire', 'en_couple'];

export function parseAgeInput(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: "L'âge doit être un nombre entier entre 13 et 120." };
  }
  if (n < MIN_PROFILE_AGE || n > MAX_PROFILE_AGE) {
    return {
      ok: false,
      error: `L'âge doit être entre ${MIN_PROFILE_AGE} et ${MAX_PROFILE_AGE} ans.`,
    };
  }
  return { ok: true, value: n };
}

export function applyAgeSettings(
  user: User,
  body: { age?: unknown; showAge?: unknown }
): { ok: true } | { ok: false; error: string } {
  if (body.age !== undefined) {
    const parsed = parseAgeInput(body.age);
    if (!parsed.ok) return parsed;
    if (parsed.value === null) {
      delete user.age;
    } else {
      user.age = parsed.value;
    }
  }
  if (body.showAge !== undefined) {
    if (typeof body.showAge !== 'boolean') {
      return { ok: false, error: 'showAge doit être un booléen.' };
    }
    user.showAge = body.showAge;
  }
  return { ok: true };
}

function publicAgeField(u: User, isOwner: boolean): number | undefined {
  if (u.age == null) return undefined;
  if (isOwner || u.showAge === true) return u.age;
  return undefined;
}

/** Rétrocompat : utilisateurs sans champ ou valeur invalide → non affiché (undefined). */
export function migrateUserRelationshipStatus(user: User): boolean {
  if (user.relationshipStatus === undefined) return false;
  if (!VALID_RELATIONSHIP_STATUSES.includes(user.relationshipStatus)) {
    delete user.relationshipStatus;
    return true;
  }
  return false;
}

export function migrateAllUsersRelationshipStatus(): number {
  let changed = 0;
  for (const user of db.users.values()) {
    if (migrateUserRelationshipStatus(user)) changed += 1;
  }
  return changed;
}

export function migrateAllUsersProfileType(): number {
  let changed = 0;
  for (const user of db.users.values()) {
    if (migrateUserProfileType(user)) changed += 1;
  }
  return changed;
}

export function normalizeProfilePhotos(user: User): string[] {
  const fromList = (user.profilePhotos ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromList.length > 0) return fromList.slice(0, MAX_PROFILE_PHOTOS);
  if (user.avatarUrl?.trim()) return [user.avatarUrl.trim()];
  return [];
}

export function syncProfilePhotos(user: User, photos: string[]): void {
  const cleaned = photos.map((u) => u.trim()).filter(Boolean).slice(0, MAX_PROFILE_PHOTOS);
  user.profilePhotos = cleaned;
  user.avatarUrl = cleaned[0] || user.avatarUrl;
}

export function applyProfileDefaults(user: User): User {
  if (!user.bio) {
    user.bio = 'Passionné·e de musique — je partage mes sessions et découvre des sons autour de moi.';
  }
  if (!user.interests?.length) user.interests = [...DEFAULT_INTERESTS];
  if (!user.favoriteGenres?.length) user.favoriteGenres = [...DEFAULT_GENRES];
  if (!user.favoriteArtists?.length) user.favoriteArtists = [];
  ensurePlatformAccountsFromLegacy(user);
  if (!user.city) user.city = '';
  if (!user.listeningRole) user.listeningRole = 'auditeur';
  if (!user.memberSince) user.memberSince = Date.now();
  const photos = normalizeProfilePhotos(user);
  if (photos.length) syncProfilePhotos(user, photos);
  return user;
}

export function getUserStats(userId: string) {
  const salonsHosted = [...db.salons.values()].filter((s) => s.hostId === userId).length;
  const livesHosted = [...db.lives.values()].filter((l) => l.hostId === userId && l.isActive).length;
  return { salonsHosted, livesHosted };
}

export function getActiveSalonForHost(hostId: string) {
  return [...db.salons.values()].find((s) => s.hostId === hostId);
}

export interface PublicCurrentListening {
  title: string;
  artist: string;
  albumArtUrl?: string;
  platform: MusicPlatform;
  isPlaying: boolean;
}

function listeningFromPlayback(ps: PlaybackState): PublicCurrentListening | undefined {
  const title = ps.title?.trim();
  if (!title) return undefined;
  return {
    title,
    artist: ps.artist?.trim() || 'Artiste inconnu',
    albumArtUrl: ps.albumArtUrl,
    platform: ps.platform,
    isPlaying: ps.isPlaying,
  };
}

/** Morceau diffusé en salon ou live actif animé par cet utilisateur. */
export function getCurrentListeningForUser(userId: string): PublicCurrentListening | undefined {
  let bestLive: PublicCurrentListening | undefined;
  let bestViewers = -1;
  for (const live of db.lives.values()) {
    if (!live.isActive || live.hostId !== userId) continue;
    const listening = listeningFromPlayback(live.playbackState);
    if (!listening) continue;
    if (live.viewersCount >= bestViewers) {
      bestViewers = live.viewersCount;
      bestLive = listening;
    }
  }
  if (bestLive) return bestLive;

  const salon = getActiveSalonForHost(userId);
  if (salon) return listeningFromPlayback(salon.playbackState);
  return undefined;
}

function cloneUserForPublic(u: User): User {
  return {
    ...u,
    profilePhotos: u.profilePhotos ? [...u.profilePhotos] : undefined,
    interests: u.interests ? [...u.interests] : undefined,
    favoriteGenres: u.favoriteGenres ? [...u.favoriteGenres] : undefined,
    favoriteArtists: u.favoriteArtists ? [...u.favoriteArtists] : undefined,
    connectedPlatforms: u.connectedPlatforms ? [...u.connectedPlatforms] : undefined,
  };
}

export function publicProfile(u: User, isOwner = false, viewerId?: string) {
  const snapshot = cloneUserForPublic(u);
  applyProfileDefaults(snapshot);
  const stats = getUserStats(snapshot.id);
  const role = snapshot.listeningRole;
  const isHostProfile = role === 'host' || role === 'les_deux' || stats.salonsHosted > 0;
  const hostRating = isHostProfile ? getHostRatingSummary(snapshot.id, viewerId) : undefined;
  const following =
    viewerId && viewerId !== snapshot.id && !isOwner ? isFollowing(viewerId, snapshot.id) : undefined;
  const activeSalon = getActiveSalonForHost(snapshot.id);
  const isLive = isUserHostingLive(snapshot.id);
  return {
    id: snapshot.id,
    username: snapshot.username,
    usernameColor: snapshot.usernameColor ?? null,
    usernameWaveFrom: snapshot.usernameWaveFrom ?? null,
    usernameWaveTo: snapshot.usernameWaveTo ?? null,
    avatarUrl: snapshot.avatarUrl,
    profilePhotos: normalizeProfilePhotos(snapshot),
    bio: snapshot.bio,
    interests: snapshot.interests,
    favoriteGenres: snapshot.favoriteGenres,
    favoriteArtists: snapshot.favoriteArtists,
    connectedPlatforms: snapshot.connectedPlatforms,
    platformLinks: isOwner ? publicPlatformLinks(snapshot) : undefined,
    city: snapshot.city,
    listeningRole: snapshot.listeningRole,
    profileType: snapshot.profileType,
    relationshipStatus: snapshot.relationshipStatus,
    age: publicAgeField(snapshot, isOwner),
    showAge: isOwner ? snapshot.showAge === true : undefined,
    memberSince: snapshot.memberSince,
    isGhostMode: isOwner ? snapshot.isGhostMode : undefined,
    shareDistance: isOwner ? snapshot.shareDistance !== false : undefined,
    locationPrecision: isOwner ? (snapshot.locationPrecision ?? 'precise') : undefined,
    email: isOwner ? snapshot.email : undefined,
    accountStatus: isOwner ? getAccountStatus(snapshot) : undefined,
    isAdmin: isOwner ? isAccessAdmin(snapshot) : undefined,
    stats,
    favoritesCount: snapshot.favoritesCountOverride ?? getFavoriteCount(snapshot.id),
    hostRating,
    isFollowing: following,
    isLive,
    liveId: isLive ? getActiveLiveIdForHost(snapshot.id) : undefined,
    liveViewersCount: isLive ? getLiveViewersCountForHost(snapshot.id) : undefined,
    salonId: activeSalon?.id,
    salonTitle: activeSalon?.title || activeSalon?.playbackState?.title || undefined,
    currentListening: getCurrentListeningForUser(snapshot.id),
  };
}
