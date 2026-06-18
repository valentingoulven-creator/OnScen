import type { Live } from '../models/schema';
import { db } from '../models/schema';
import { creatorMeetsMonetizationAge } from './ageGates';
import { isDevUser } from './accessControl';
import { getPublicMapCoords } from './locationPrivacy';
import { resolveLiveCountry } from './liveCountry';

/** Live exposé au client (API + socket) avec champs dérivés (coords publiques, monétisation). */
export function serializePublicLive(l: Live, distanceKm?: number, viewerId?: string) {
  const host = db.users.get(l.hostId);
  const coords =
    host != null
      ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, viewerId)
      : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
  const country = resolveLiveCountry(l.latitude, l.longitude, host?.city);
  const viewer = viewerId ? db.users.get(viewerId) : undefined;
  const isDevModerator =
    viewerId != null && viewerId !== l.hostId && isDevUser(viewer);
  const base = {
    id: l.id,
    salonId: l.salonId,
    hostId: l.hostId,
    hostName: l.hostName,
    hostUsernameColor: host?.usernameColor,
    hostUsernameWaveFrom: host?.usernameWaveFrom,
    hostUsernameWaveTo: host?.usernameWaveTo,
    title: l.title,
    platform: l.platform,
    playbackState: l.playbackState,
    latitude: coords.latitude,
    longitude: coords.longitude,
    viewersCount: l.viewersCount,
    isActive: l.isActive,
    startedAt: l.startedAt,
    cameraActive: !!l.cameraActive,
    cameraMode: l.cameraMode,
    streamMode: l.streamMode ?? 'webrtc',
    cloudflarePlaybackUrl: l.cloudflarePlaybackUrl ?? l.cloudflareVodPlaybackUrl,
    cloudflareVodPlaybackUrl: l.cloudflareVodPlaybackUrl,
    cloudflareLiveInputId: l.cloudflareLiveInputId,
    vipModeratorIds: l.vipModeratorIds ?? [],
    isDev: isDevModerator ? true : undefined,
    hostMonetizationEligible: creatorMeetsMonetizationAge(host?.age),
    countryCode: country?.code,
    countryName: country?.name,
  };
  if (distanceKm !== undefined) {
    return { ...base, distanceKm: Math.round(distanceKm * 10) / 10 };
  }
  return base;
}
