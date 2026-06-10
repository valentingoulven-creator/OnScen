import { db, User, type MusicPlatform, type PlaybackState } from '../models/schema';
import { ensurePlatformAccountsFromLegacy, publicPlatformLinks } from './platformConnect';
import { getHostRatingSummary } from './ratings';
import { migrateUserProfileType } from './profileTypes';
import { VALID_RELATIONSHIP_STATUSES } from './relationshipStatus';
import { isFollowing } from './follows';
import { getFavoriteCount } from './favorites';
import {
  getActiveLiveIdForHost,
  getLiveViewersCountForHost,
  isUserHostingLive,
} from './liveStatus';
import { getAccountStatus, isAccessAdmin } from './accessControl';
import { getCreatorSubscriberCount, getActiveSubscription } from './subscriptions';
import {
  creatorMeetsMonetizationAge,
  MAX_PROFILE_AGE,
  MIN_PROFILE_AGE,
} from './ageGates';
import { isAccountValidated, userMeetsHeartAge } from './canSendHeart';

export { MIN_PROFILE_AGE, MAX_PROFILE_AGE, MIN_LIVE_AGE, CREATOR_MONETIZATION_MIN_AGE } from './ageGates';
export { userMeetsLiveAge, creatorMeetsMonetizationAge } from './ageGates';

export const DEFAULT_INTERESTS = [
  'Découvertes live',
  'Écoute partagée',
  'Nouveaux morceaux',
];

export const DEFAULT_GENRES = ['Électro', 'Indie', 'Hip-hop'];

export const MAX_PROFILE_PHOTOS = 5;

export { applyRelationshipSettings } from './relationshipStatus';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function computeAgeFromBirthDate(birthDate: string, refDate = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
    throw new Error('invalid date');
  }
  let age = refDate.getFullYear() - birth.getFullYear();
  const monthDiff = refDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function parseBirthDateInput(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string' || !ISO_DATE_RE.test(raw)) {
    return { ok: false, error: 'Date de naissance invalide (format AAAA-MM-JJ attendu).' };
  }
  const [y, m, d] = raw.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
    return { ok: false, error: 'Date de naissance invalide.' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birth > today) {
    return { ok: false, error: 'La date de naissance ne peut pas être dans le futur.' };
  }
  let age: number;
  try {
    age = computeAgeFromBirthDate(raw);
  } catch {
    return { ok: false, error: 'Date de naissance invalide.' };
  }
  if (age < MIN_PROFILE_AGE || age > MAX_PROFILE_AGE) {
    return {
      ok: false,
      error: `L'âge doit être entre ${MIN_PROFILE_AGE} et ${MAX_PROFILE_AGE} ans.`,
    };
  }
  return { ok: true, value: raw };
}

export function parseAgeInput(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === '') {
    return { ok: true, value: null };
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: `L'âge doit être un nombre entier entre ${MIN_PROFILE_AGE} et 120.` };
  }
  if (n < MIN_PROFILE_AGE || n > MAX_PROFILE_AGE) {
    return {
      ok: false,
      error: `L'âge doit être entre ${MIN_PROFILE_AGE} et ${MAX_PROFILE_AGE} ans.`,
    };
  }
  return { ok: true, value: n };
}

/** Défaut : masquée. Rétrocompat showAge (true ⇒ visible). */
export function isBirthDateHiddenOnProfile(user: User): boolean {
  if (user.hideBirthDateOnProfile !== undefined) return user.hideBirthDateOnProfile;
  if (user.showAge === true) return false;
  return true;
}

export function applyAgeSettings(
  user: User,
  body: {
    age?: unknown;
    showAge?: unknown;
    birthDate?: unknown;
    hideBirthDateOnProfile?: unknown;
  }
): { ok: true } | { ok: false; error: string } {
  if (body.birthDate !== undefined) {
    const parsed = parseBirthDateInput(body.birthDate);
    if (!parsed.ok) return parsed;
    if (parsed.value === null) {
      delete user.birthDate;
      delete user.age;
    } else {
      user.birthDate = parsed.value;
      user.age = computeAgeFromBirthDate(parsed.value);
    }
  } else if (body.age !== undefined) {
    const parsed = parseAgeInput(body.age);
    if (!parsed.ok) return parsed;
    if (parsed.value === null) {
      delete user.age;
      delete user.birthDate;
    } else {
      user.age = parsed.value;
    }
  }
  if (body.hideBirthDateOnProfile !== undefined) {
    if (typeof body.hideBirthDateOnProfile !== 'boolean') {
      return { ok: false, error: 'hideBirthDateOnProfile doit être un booléen.' };
    }
    user.hideBirthDateOnProfile = body.hideBirthDateOnProfile;
    user.showAge = !body.hideBirthDateOnProfile;
  } else if (body.showAge !== undefined) {
    if (typeof body.showAge !== 'boolean') {
      return { ok: false, error: 'showAge doit être un booléen.' };
    }
    user.showAge = body.showAge;
    user.hideBirthDateOnProfile = !body.showAge;
  }
  return { ok: true };
}

function publicBirthDateField(u: User, isOwner: boolean): string | undefined {
  if (!u.birthDate || !isOwner) return undefined;
  return u.birthDate;
}

function publicAgeField(u: User, isOwner: boolean): number | undefined {
  const derivedAge = u.birthDate ? computeAgeFromBirthDate(u.birthDate) : u.age;
  if (derivedAge == null) return undefined;
  if (isOwner || !isBirthDateHiddenOnProfile(u)) return derivedAge;
  return undefined;
}

/** Rétrocompat : utilisateurs sans champ ou valeur invalide → non affiché (undefined). */
export function migrateUserRelationshipStatus(user: User): boolean {
  let changed = false;
  if (user.relationshipStatus === undefined) {
    if (user.relationshipStatusCustom) {
      delete user.relationshipStatusCustom;
      return true;
    }
    return false;
  }
  if (!VALID_RELATIONSHIP_STATUSES.includes(user.relationshipStatus)) {
    delete user.relationshipStatus;
    delete user.relationshipStatusCustom;
    return true;
  }
  if (user.relationshipStatusCustom) {
    delete user.relationshipStatusCustom;
    changed = true;
  }
  return changed;
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

function isDicebearAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).hostname.includes('api.dicebear.com');
  } catch {
    return trimmed.includes('api.dicebear.com');
  }
}

function isEphemeralProfilePhotoUrl(url: string): boolean {
  return url.trim().startsWith('blob:');
}

function isRealProfilePhoto(url: string): boolean {
  const trimmed = url.trim();
  return Boolean(trimmed) && !isDicebearAvatarUrl(trimmed) && !isEphemeralProfilePhotoUrl(trimmed);
}

/** Preserve [avatar, g1…g4] slots; index 0 may be '' when only gallery photos exist. */
export function normalizeProfilePhotoSlots(photos: string[]): string[] {
  const slots = photos.map((u) => u.trim()).slice(0, MAX_PROFILE_PHOTOS);
  let lastIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (isRealProfilePhoto(slots[i] ?? '')) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return [];

  const out: string[] = [];
  for (let i = 0; i <= lastIdx; i++) {
    const url = slots[i] ?? '';
    if (isRealProfilePhoto(url)) {
      out.push(url);
    } else if (i === 0 && slots.slice(1).some(isRealProfilePhoto)) {
      out.push('');
    }
  }
  return out;
}

export function normalizeProfilePhotos(user: User): string[] {
  const raw = user.profilePhotos ?? [];
  if (raw.length > 0) {
    const normalized = normalizeProfilePhotoSlots(raw.map(String));
    if (normalized.length > 0) return normalized;
  }
  const avatar = user.avatarUrl?.trim();
  if (avatar && !isDicebearAvatarUrl(avatar)) return [avatar];
  return [];
}

export function sanitizeIncomingProfilePhotos(photos: string[]): string[] {
  return photos.map((url) => {
    const trimmed = String(url).trim();
    if (!trimmed || isDicebearAvatarUrl(trimmed) || isEphemeralProfilePhotoUrl(trimmed)) {
      return '';
    }
    return trimmed;
  });
}

export function syncProfilePhotos(user: User, photos: string[]): void {
  const normalized = normalizeProfilePhotoSlots(sanitizeIncomingProfilePhotos(photos));
  user.profilePhotos = normalized.length ? normalized : undefined;
  user.avatarUrl = normalized[0] || user.avatarUrl;
}

export function countPersistableProfilePhotos(photos: string[]): number {
  return normalizeProfilePhotoSlots(sanitizeIncomingProfilePhotos(photos)).filter(isRealProfilePhoto)
    .length;
}

export function applyProfileDefaults(user: User): User {
  if (user.hideBirthDateOnProfile === undefined && user.showAge === undefined) {
    user.hideBirthDateOnProfile = true;
    user.showAge = false;
  } else if (user.hideBirthDateOnProfile === undefined) {
    user.hideBirthDateOnProfile = user.showAge !== true;
  } else if (user.showAge === undefined) {
    user.showAge = !user.hideBirthDateOnProfile;
  }
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
  const followingMe =
    viewerId && viewerId !== snapshot.id && !isOwner ? isFollowing(snapshot.id, viewerId) : undefined;
  const activeSalon = getActiveSalonForHost(snapshot.id);
  const isLive = isUserHostingLive(snapshot.id);
  const activeSub =
    viewerId && viewerId !== snapshot.id
      ? getActiveSubscription(viewerId, snapshot.id)
      : null;
  const subscriberCount =
    isHostProfile || stats.salonsHosted > 0 ? getCreatorSubscriberCount(snapshot.id) : undefined;
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
    relationshipStatusCustom: snapshot.relationshipStatusCustom,
    birthDate: publicBirthDateField(snapshot, isOwner),
    hideBirthDateOnProfile: isOwner ? isBirthDateHiddenOnProfile(snapshot) : undefined,
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
    isFollowingMe: followingMe,
    isSupporter: activeSub != null,
    supporterTier: activeSub?.tierLabel,
    monetizationEligible: creatorMeetsMonetizationAge(snapshot.age),
    accountValidated: isAccountValidated(snapshot),
    meetsHeartAge: userMeetsHeartAge(snapshot),
    subscriberCount,
    isLive,
    liveId: isLive ? getActiveLiveIdForHost(snapshot.id) : undefined,
    liveViewersCount: isLive ? getLiveViewersCountForHost(snapshot.id) : undefined,
    salonId: activeSalon?.id,
    salonTitle: activeSalon?.title || activeSalon?.playbackState?.title || undefined,
    currentListening: getCurrentListeningForUser(snapshot.id),
    instagramHandle: snapshot.instagramHandle,
    youtubeChannel: snapshot.youtubeChannel,
    spotifyUrl: snapshot.spotifyUrl,
  };
}
