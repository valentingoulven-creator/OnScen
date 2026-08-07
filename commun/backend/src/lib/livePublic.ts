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
  const coHost = l.coHostId ? db.users.get(l.coHostId) : undefined;
  const isRequesterHost = viewerId != null && viewerId === l.hostId;
  const activePoll = l.activePoll
    ? (() => {
        const counts = new Map<string, number>();
        for (const optionId of Object.values(l.activePoll!.votes)) {
          counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        }
        const totalVotes = Object.keys(l.activePoll!.votes).length;
        return {
          id: l.activePoll!.id,
          question: l.activePoll!.question,
          options: l.activePoll!.options.map((o) => ({
            id: o.id,
            label: o.label,
            count: counts.get(o.id) ?? 0,
          })),
          totalVotes,
          closedAt: l.activePoll!.closedAt,
          myVote: viewerId ? l.activePoll!.votes[viewerId] : undefined,
        };
      })()
    : undefined;
  const hostDisplayName = (() => {
    const stored = l.hostName?.trim() ?? '';
    if (stored && !/^live$/i.test(stored)) return stored;
    const fromUser = host?.username?.trim();
    if (fromUser) return fromUser;
    return stored || 'Hôte';
  })();
  const base = {
    id: l.id,
    salonId: l.salonId,
    hostId: l.hostId,
    hostName: hostDisplayName,
    hostAvatarUrl: host?.avatarUrl,
    hostUsernameColor: host?.usernameColor,
    hostUsernameWaveFrom: host?.usernameWaveFrom,
    hostUsernameWaveTo: host?.usernameWaveTo,
    title: l.title,
    description: l.description,
    isSensitive: l.isSensitive === true,
    replayEnabled: l.replayEnabled !== false,
    pinnedAnnouncement: l.pinnedAnnouncement,
    coHostId: l.coHostId,
    coHostName: coHost?.username,
    coHostAvatarUrl: coHost?.avatarUrl,
    coHostInvitePending: !!l.coHostInvite,
    ...(isRequesterHost && l.coHostInvite ? { coHostInviteTargetId: l.coHostInvite.userId } : {}),
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
    ...(activePoll ? { activePoll } : {}),
  };
  if (distanceKm !== undefined) {
    return { ...base, distanceKm: Math.round(distanceKm * 10) / 10 };
  }
  return base;
}
