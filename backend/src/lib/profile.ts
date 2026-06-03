import { db, User } from '../models/schema';
import { ensurePlatformAccountsFromLegacy, publicPlatformLinks } from './platformConnect';
import { getHostRatingSummary } from './ratings';
import { isFollowing } from './follows';

export const DEFAULT_INTERESTS = [
  'Découvertes live',
  'Écoute partagée',
  'Nouveaux morceaux',
];

export const DEFAULT_GENRES = ['Électro', 'Indie', 'Hip-hop'];

export const MAX_PROFILE_PHOTOS = 6;

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
  return {
    id: snapshot.id,
    username: snapshot.username,
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
    relationshipStatus: snapshot.relationshipStatus,
    memberSince: snapshot.memberSince,
    isGhostMode: isOwner ? snapshot.isGhostMode : undefined,
    shareDistance: isOwner ? snapshot.shareDistance !== false : undefined,
    locationPrecision: isOwner ? (snapshot.locationPrecision ?? 'precise') : undefined,
    email: isOwner ? snapshot.email : undefined,
    stats,
    hostRating,
    isFollowing: following,
  };
}
