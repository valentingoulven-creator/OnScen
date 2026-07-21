import { getDistanceKm } from './geo';
import { getAccountStatus } from './accessControl';
import { getSponsorPlatformConfig } from './sponsorPlatformConfig';
import { db, type Sponsor, type SponsorMapVisibilityScope, type SponsorPlacement } from '../models/schema';

export type SponsorAudienceBasis =
  | 'active_30d_all'
  | 'active_30d_region'
  | 'active_30d_rotation';

export type SponsorAudienceEstimate = {
  /** Utilisateurs actifs (30 j) susceptibles de voir le sponsor. */
  estimatedUsers: number;
  /** Total utilisateurs actifs (30 j) sur la plateforme. */
  eligibleUsers: number;
  basis: SponsorAudienceBasis;
  regionRadiusKm?: number;
  rotationEveryN?: number;
};

const ACTIVE_WINDOW_MS = 30 * 86_400_000;
/** Rayon autour de la cible régionale (bandeau carte). */
export const SPONSOR_REGION_AUDIENCE_RADIUS_KM = 80;

function* iterEligibleUsers() {
  for (const user of db.users.values()) {
    if (user.email.endsWith('@bot.local')) continue;
    if (getAccountStatus(user) === 'blocked') continue;
    if (user.lastSeenAt <= Date.now() - ACTIVE_WINDOW_MS) continue;
    yield user;
  }
}

export function countEligibleActiveUsers(): number {
  let count = 0;
  for (const _ of iterEligibleUsers()) count += 1;
  return count;
}

export function countEligibleActiveUsersNear(lat: number, lng: number, radiusKm: number): number {
  let count = 0;
  for (const user of iterEligibleUsers()) {
    const userLat = user.latitude ?? user.blurredLatitude;
    const userLng = user.longitude ?? user.blurredLongitude;
    if (userLat == null || userLng == null || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      continue;
    }
    if (getDistanceKm(lat, lng, userLat, userLng) <= radiusKm) count += 1;
  }
  return count;
}

export function estimateSponsorAudience(input: {
  placement?: SponsorPlacement;
  mapVisibilityScope?: SponsorMapVisibilityScope;
  mapTargetLat?: number | null;
  mapTargetLng?: number | null;
}): SponsorAudienceEstimate {
  const eligibleUsers = countEligibleActiveUsers();
  const placement = input.placement ?? 'map_banner';

  if (placement === 'map_banner') {
    const scope = input.mapVisibilityScope ?? 'france';
    if (scope === 'france') {
      return { estimatedUsers: eligibleUsers, eligibleUsers, basis: 'active_30d_all' };
    }
    const lat = input.mapTargetLat;
    const lng = input.mapTargetLng;
    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return {
        estimatedUsers: 0,
        eligibleUsers,
        basis: 'active_30d_region',
        regionRadiusKm: SPONSOR_REGION_AUDIENCE_RADIUS_KM,
      };
    }
    return {
      estimatedUsers: countEligibleActiveUsersNear(lat, lng, SPONSOR_REGION_AUDIENCE_RADIUS_KM),
      eligibleUsers,
      basis: 'active_30d_region',
      regionRadiusKm: SPONSOR_REGION_AUDIENCE_RADIUS_KM,
    };
  }

  if (placement === 'reels_sponsored') {
    const config = getSponsorPlatformConfig();
    if (!config.reelsSponsorEnabled) {
      return { estimatedUsers: 0, eligibleUsers, basis: 'active_30d_rotation', rotationEveryN: 0 };
    }
    const everyN = Math.max(1, config.reelsSponsorEveryN);
    return {
      estimatedUsers: Math.round(eligibleUsers / everyN),
      eligibleUsers,
      basis: 'active_30d_rotation',
      rotationEveryN: everyN,
    };
  }

  if (placement === 'stories_sponsored') {
    const config = getSponsorPlatformConfig();
    if (!config.storiesSponsorEnabled) {
      return { estimatedUsers: 0, eligibleUsers, basis: 'active_30d_rotation', rotationEveryN: 0 };
    }
    const everyN = Math.max(1, config.storiesSponsorEveryN);
    return {
      estimatedUsers: Math.round(eligibleUsers / everyN),
      eligibleUsers,
      basis: 'active_30d_rotation',
      rotationEveryN: everyN,
    };
  }

  return { estimatedUsers: eligibleUsers, eligibleUsers, basis: 'active_30d_all' };
}

export function estimateSponsorAudienceFromRecord(sponsor: Sponsor): SponsorAudienceEstimate {
  return estimateSponsorAudience({
    placement: sponsor.placement,
    mapVisibilityScope: sponsor.mapVisibilityScope,
    mapTargetLat: sponsor.mapTargetLat,
    mapTargetLng: sponsor.mapTargetLng,
  });
}
