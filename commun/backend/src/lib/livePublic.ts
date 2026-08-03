import type { Live } from '../models/schema';
import { db } from '../models/schema';
import { normalizeBrandText } from './brandName';
import { creatorMeetsMonetizationAgeFromProfile } from './ageGates';
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
  const donationOptions = l.donationOptions
    ?.filter((o) => o.label?.trim() && o.amount >= 1 && o.amount <= 100)
    .map(({ id, label, amount, rewardType }) => ({
      id,
      label: label.trim(),
      amount: Math.round(amount),
      ...(rewardType ? { rewardType } : {}),
    }));
  const donationGoals = l.donationGoals
    ?.filter((g) => g.label?.trim() && g.target > 0)
    .map(({ id, type, target, label, displayCurrent }) => ({
      id,
      type,
      target: Math.round(target),
      label: label.trim().slice(0, 120),
      ...(displayCurrent != null && Number.isFinite(displayCurrent)
        ? { displayCurrent: Math.round(displayCurrent) }
        : {}),
    }))
    .slice(0, 8);
  const donationGoalOverlay = l.donationGoalOverlay
    ? {
        visibleToViewers: l.donationGoalOverlay.visibleToViewers !== false,
        xPct: l.donationGoalOverlay.xPct,
        yPct: l.donationGoalOverlay.yPct,
      }
    : undefined;
  const base = {
    id: l.id,
    salonId: l.salonId,
    hostId: l.hostId,
    hostName: l.hostName,
    hostAvatarUrl: host?.avatarUrl,
    hostUsernameColor: host?.usernameColor,
    hostUsernameWaveFrom: host?.usernameWaveFrom,
    hostUsernameWaveTo: host?.usernameWaveTo,
    title: l.title,
    platform: l.platform,
    playbackState: {
      ...l.playbackState,
      title: normalizeBrandText(l.playbackState.title),
    },
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
    chatConfig: l.chatConfig ?? {},
    isDev: isDevModerator ? true : undefined,
    hostMonetizationEligible:
      l.presentationDemoStream === true
        ? true
        : creatorMeetsMonetizationAgeFromProfile(host),
    tipsEnabled: l.tipsEnabled !== false,
    contentCategory: l.contentCategory,
    videoDelaySeconds: l.videoDelaySeconds ?? 0,
    videoAspectRatio: l.videoAspectRatio ?? '16:9',
    presentationDemoStream: l.presentationDemoStream === true ? true : undefined,
    countryCode: country?.code,
    countryName: country?.name,
    ...(donationOptions?.length ? { donationOptions } : {}),
    ...(donationGoals?.length ? { donationGoals } : {}),
    ...(donationGoalOverlay ? { donationGoalOverlay } : {}),
  };
  if (distanceKm !== undefined) {
    return { ...base, distanceKm: Math.round(distanceKm * 10) / 10 };
  }
  return base;
}
