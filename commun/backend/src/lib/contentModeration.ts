import { isSightengineConfigured } from './sightengineConfig';
import { isDeployedEnv } from './jwtSecret';
import {
  checkImageWithSightengine,
  checkVideoWithSightengine,
  resolveSightengineApiFailure,
  shouldScanImageSource,
  shouldScanVideoSource,
  userFacingModerationMessage,
  type SightengineRejectReason,
} from './sightengineModeration';

export type ModerationContext =
  | 'story'
  | 'feed_post'
  | 'feed_video'
  | 'profile_photo'
  | 'avatar'
  | 'reel'
  | 'reel_poster'
  | 'dm_attachment'
  | 'salon_chat'
  | 'live_chat';

export interface ModerationResult {
  allowed: boolean;
  skipped?: boolean;
  error?: string;
  reason?: SightengineRejectReason;
}

export interface ModerationCoverageEntry {
  surface: string;
  images: boolean;
  videos: boolean;
  route: string;
}

/** Surfaces UGC et leur couverture Sightengine (pour diagnostic). */
export function getModerationCoverage(): ModerationCoverageEntry[] {
  return [
    { surface: 'Stories', images: true, videos: true, route: 'POST /api/stories' },
    { surface: 'Publications fil', images: true, videos: true, route: 'POST /api/feed' },
    { surface: 'Reels', images: true, videos: true, route: 'POST /api/reels' },
    { surface: 'Photos profil', images: true, videos: false, route: 'PATCH /api/auth/profile' },
    { surface: 'Messages privés (image)', images: true, videos: false, route: 'POST /api/dm/thread/:userId' },
    { surface: 'Chat salon / live (socket)', images: true, videos: false, route: 'socket salon_message / live_message' },
  ];
}

export function moderationRejectionMessage(result: ModerationResult): string {
  if (result.error && !result.reason) return result.error;
  return userFacingModerationMessage(result.reason);
}

async function resolveApiResult(apiResult: {
  ok: boolean;
  error?: string;
  evaluation?: { allowed: boolean; reason?: SightengineRejectReason };
}): Promise<ModerationResult> {
  if (!apiResult.ok) {
    const resolved = resolveSightengineApiFailure(apiResult.error ?? 'Erreur Sightengine');
    if (resolved.allowed) {
      return { allowed: true, skipped: true };
    }
    return {
      allowed: false,
      error:
        'Modération automatique indisponible. Réessayez plus tard ou contactez le support.',
    };
  }

  if (!apiResult.evaluation!.allowed) {
    return {
      allowed: false,
      reason: apiResult.evaluation!.reason,
    };
  }

  return { allowed: true };
}

export async function moderateImageSource(
  source: string | undefined | null,
  _context: ModerationContext,
): Promise<ModerationResult> {
  if (source == null) return { allowed: true };
  const trimmed = String(source).trim();
  if (!trimmed) return { allowed: true };

  if (!shouldScanImageSource(trimmed)) {
    return { allowed: true, skipped: true };
  }

  if (!isSightengineConfigured()) {
    if (isDeployedEnv()) {
      return {
        allowed: false,
        error:
          'Modération automatique indisponible. Réessayez plus tard ou contactez le support.',
      };
    }
    return { allowed: true, skipped: true };
  }

  const apiResult = await checkImageWithSightengine(trimmed);
  return resolveApiResult(apiResult);
}

export async function moderateVideoSource(
  source: string | undefined | null,
  durationSec?: number,
  _context: ModerationContext = 'feed_video',
): Promise<ModerationResult> {
  if (source == null) return { allowed: true };
  const trimmed = String(source).trim();
  if (!trimmed) return { allowed: true };

  if (!shouldScanVideoSource(trimmed, durationSec)) {
    return { allowed: true, skipped: true };
  }

  if (!isSightengineConfigured()) {
    if (isDeployedEnv()) {
      return {
        allowed: false,
        error:
          'Modération automatique indisponible. Réessayez plus tard ou contactez le support.',
      };
    }
    return { allowed: true, skipped: true };
  }

  const apiResult = await checkVideoWithSightengine(trimmed, durationSec);
  return resolveApiResult(apiResult);
}

export async function moderateImageSources(
  sources: Array<string | undefined | null>,
  context: ModerationContext,
): Promise<ModerationResult> {
  for (const source of sources) {
    const result = await moderateImageSource(source, context);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

export async function moderateReelUpload(input: {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  durationSec?: number;
}): Promise<ModerationResult> {
  if (input.mediaType === 'image') {
    return moderateImageSource(input.mediaUrl, 'reel');
  }

  const posterResult = input.posterUrl
    ? await moderateImageSource(input.posterUrl, 'reel_poster')
    : { allowed: true as const };
  if (!posterResult.allowed) return posterResult;

  return moderateVideoSource(input.mediaUrl, input.durationSec, 'reel');
}

export function isImageAttachmentMime(mimeType: unknown): boolean {
  if (typeof mimeType !== 'string') return false;
  return mimeType.trim().toLowerCase().startsWith('image/');
}

export async function moderateChatAttachment(
  attachmentUrl: string | undefined,
  attachmentMimeType?: unknown,
  context: 'salon_chat' | 'live_chat' | 'dm_attachment' = 'salon_chat',
): Promise<ModerationResult> {
  if (!attachmentUrl?.trim()) return { allowed: true };
  if (!isImageAttachmentMime(attachmentMimeType)) {
    return { allowed: true, skipped: true };
  }
  return moderateImageSource(attachmentUrl, context);
}

export async function moderateDmAttachment(
  attachmentUrl: string | undefined,
  attachmentMimeType?: unknown,
): Promise<ModerationResult> {
  return moderateChatAttachment(attachmentUrl, attachmentMimeType, 'dm_attachment');
}

export async function moderateFeedPostMedia(input: {
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
}): Promise<ModerationResult> {
  const urls =
    input.imageUrls?.length ? input.imageUrls : input.imageUrl ? [input.imageUrl] : [];
  for (const url of urls) {
    const imageResult = await moderateImageSource(url, 'feed_post');
    if (!imageResult.allowed) return imageResult;
  }
  if (input.videoUrl) {
    return moderateVideoSource(input.videoUrl, undefined, 'feed_video');
  }
  return { allowed: true };
}
