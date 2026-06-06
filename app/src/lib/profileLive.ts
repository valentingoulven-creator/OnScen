import type { NearbyPerson, User } from '../types';

/** Résout l'id de room live (join_live) pour un profil en direct. */
export function resolveProfileLiveId(
  profile: User | null | undefined,
  preview?: NearbyPerson
): string | undefined {
  if (profile?.liveId) return profile.liveId;
  if (preview?.liveId) return preview.liveId;
  const isLive = profile?.isLive || preview?.isLive;
  if (isLive && preview?.salonId) return preview.salonId;
  return undefined;
}
