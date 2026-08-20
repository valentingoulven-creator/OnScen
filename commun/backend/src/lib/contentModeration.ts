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
import { db } from '../models/schema';
import { appendContentReport } from './contentReports';
import { sendMonitoringAlert } from './alertNotifier';
import {
  checkCsamHash,
  rememberBlockedSource,
  type CsamHashSource,
} from './csamHashMatch';

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
  | 'live_chat'
  | 'sponsor_asset';

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
    { surface: 'Logos/bannières sponsors', images: true, videos: false, route: 'POST /api/admin/sponsors/upload-logo|upload-banner' },
  ];
}

export function moderationRejectionMessage(result: ModerationResult): string {
  if (result.error && !result.reason) return result.error;
  return userFacingModerationMessage(result.reason);
}

/**
 * Escalade CSAM (MOD-8) — deux voies :
 * - hash PhotoDNA / blocklist : métadonnées (time, user id, SHA-256), jamais le fichier ;
 * - Sightengine minor_risk : scores IA, contenu non publié.
 * PHAROS / NCMEC : humain (RUNBOOK-CSAM.md), pas d'API automatique.
 */
export function buildCsamHashMatchEscalation(input: {
  context: ModerationContext;
  uploaderId?: string;
  username?: string;
  sha256?: string;
  source?: CsamHashSource;
  at?: Date;
}): {
  reporterId: string;
  reporterUsername: string;
  details: string;
  alertMessage: string;
} {
  const at = (input.at ?? new Date()).toISOString();
  const sha = input.sha256 && /^[a-f0-9]{64}$/i.test(input.sha256) ? input.sha256.toLowerCase() : 'n/a';
  const src = input.source ?? 'photodna';
  const reporterId = src === 'local' ? 'system:csam-hash-local' : 'system:photodna';
  const reporterUsername =
    src === 'local' ? 'Blocklist CSAM locale' : 'PhotoDNA (hash-matching)';
  const userLine = `${input.username ?? 'inconnu'} (${input.uploaderId ?? 'n/a'})`;
  const details =
    `Match hash CSAM bloquant sur ${input.context}. Contenu non publié. ` +
    `Source=${src}. SHA-256=${sha}. Time=${at}. User=${userLine}. ` +
    `Pas de fichier dans cette trace. Signalement PHAROS manuel (RUNBOOK-CSAM.md). Pas d'API NCMEC.`;
  const alertMessage =
    `Upload BLOQUE (hash-match CSAM, jamais publie).\n` +
    `Time: ${at}\n` +
    `User: ${userLine}\n` +
    `Source: ${src}\n` +
    `SHA-256: ${sha}\n` +
    `Do not email or redistribute the file.\n` +
    `Action: RUNBOOK-CSAM.md then PHAROS (internet-signalement.gouv.fr). NCMEC API is not automated.`;
  return { reporterId, reporterUsername, details, alertMessage };
}

async function escalateHashMatchDetection(
  context: ModerationContext,
  uploaderId: string | undefined,
  sha256: string | undefined,
  source: CsamHashSource | undefined
): Promise<void> {
  const uploader = uploaderId ? db.users.get(uploaderId) : undefined;
  const payload = buildCsamHashMatchEscalation({
    context,
    uploaderId,
    username: uploader?.username,
    sha256,
    source,
  });
  try {
    appendContentReport({
      reporterId: payload.reporterId,
      reporterUsername: payload.reporterUsername,
      category: 'csam_risk',
      details: payload.details,
      targetUserId: uploaderId,
    });
  } catch (err) {
    console.error('[moderation] Echec journalisation signalement csam_risk (hash):', err);
  }
  try {
    await sendMonitoringAlert({
      type: 'csam_risk_detected',
      severity: 'critical',
      forceSend: true,
      message: payload.alertMessage,
    });
  } catch (err) {
    console.error('[moderation] Echec envoi alerte csam_risk_detected (hash):', err);
  }
}

async function escalateMinorRiskDetection(
  context: ModerationContext,
  uploaderId: string | undefined,
  scores: Record<string, number> | undefined
): Promise<void> {
  const uploader = uploaderId ? db.users.get(uploaderId) : undefined;
  try {
    appendContentReport({
      reporterId: 'system:sightengine',
      reporterUsername: 'Sightengine (détection automatique)',
      category: 'csam_risk',
      details: `Détection automatique bloquante sur ${context} : signal de mineur combiné à un contenu suggestif/nu. Scores Sightengine : ${JSON.stringify(scores ?? {})}. Contenu non publié.`,
      targetUserId: uploaderId,
    });
  } catch (err) {
    console.error('[moderation] Échec journalisation signalement csam_risk:', err);
  }
  try {
    await sendMonitoringAlert({
      type: 'csam_risk_detected',
      severity: 'critical',
      forceSend: true,
      message:
        `Upload BLOQUÉ automatiquement : signal de mineur + contenu suggestif/nu détecté (contexte : ${context}).\n` +
        `Utilisateur : ${uploader?.username ?? 'inconnu'} (${uploaderId ?? 'n/a'}).\n` +
        `Scores Sightengine : ${JSON.stringify(scores ?? {})}\n\n` +
        `Action requise : voir RUNBOOK-CSAM.md — préserver la preuve (déjà journalisée, contenu non publié), vérifier manuellement en urgence, signaler à PHAROS (https://www.internet-signalement.gouv.fr/) si confirmé.`,
    });
  } catch (err) {
    console.error('[moderation] Échec envoi alerte csam_risk_detected:', err);
  }
}

async function resolveApiResult(
  apiResult: {
    ok: boolean;
    error?: string;
    evaluation?: { allowed: boolean; reason?: SightengineRejectReason; scores?: Record<string, number> };
  },
  context: ModerationContext,
  uploaderId?: string
): Promise<ModerationResult> {
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
    if (apiResult.evaluation!.reason === 'minor_risk') {
      await escalateMinorRiskDetection(context, uploaderId, apiResult.evaluation!.scores);
    }
    return {
      allowed: false,
      reason: apiResult.evaluation!.reason,
    };
  }

  return { allowed: true };
}

export async function moderateImageSource(
  source: string | undefined | null,
  context: ModerationContext,
  uploaderId?: string,
): Promise<ModerationResult> {
  if (source == null) return { allowed: true };
  const trimmed = String(source).trim();
  if (!trimmed) return { allowed: true };

  if (!shouldScanImageSource(trimmed)) {
    return { allowed: true, skipped: true };
  }

  const hashCheck = await checkCsamHash(trimmed);
  if (hashCheck.unavailable) {
    return {
      allowed: false,
      error:
        'Vérification PhotoDNA indisponible. Réessayez plus tard ou contactez le support.',
    };
  }
  if (hashCheck.blocked) {
    await escalateHashMatchDetection(context, uploaderId, hashCheck.sha256, hashCheck.source);
    return { allowed: false, reason: 'minor_risk' };
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
  const result = await resolveApiResult(apiResult, context, uploaderId);
  if (!result.allowed && result.reason === 'minor_risk') {
    rememberBlockedSource(trimmed, 'sightengine_minor_risk');
  }
  return result;
}

export async function moderateVideoSource(
  source: string | undefined | null,
  durationSec?: number,
  context: ModerationContext = 'feed_video',
  uploaderId?: string,
): Promise<ModerationResult> {
  if (source == null) return { allowed: true };
  const trimmed = String(source).trim();
  if (!trimmed) return { allowed: true };

  if (!shouldScanVideoSource(trimmed, durationSec)) {
    return { allowed: true, skipped: true };
  }

  const hashCheck = await checkCsamHash(trimmed);
  if (hashCheck.unavailable) {
    return {
      allowed: false,
      error:
        'Vérification PhotoDNA indisponible. Réessayez plus tard ou contactez le support.',
    };
  }
  if (hashCheck.blocked) {
    await escalateHashMatchDetection(context, uploaderId, hashCheck.sha256, hashCheck.source);
    return { allowed: false, reason: 'minor_risk' };
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
  const result = await resolveApiResult(apiResult, context, uploaderId);
  if (!result.allowed && result.reason === 'minor_risk') {
    rememberBlockedSource(trimmed, 'sightengine_minor_risk');
  }
  return result;
}

export async function moderateImageSources(
  sources: Array<string | undefined | null>,
  context: ModerationContext,
  uploaderId?: string,
): Promise<ModerationResult> {
  for (const source of sources) {
    const result = await moderateImageSource(source, context, uploaderId);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

export async function moderateReelUpload(input: {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  durationSec?: number;
  uploaderId?: string;
}): Promise<ModerationResult> {
  if (input.mediaType === 'image') {
    return moderateImageSource(input.mediaUrl, 'reel', input.uploaderId);
  }

  const posterResult = input.posterUrl
    ? await moderateImageSource(input.posterUrl, 'reel_poster', input.uploaderId)
    : { allowed: true as const };
  if (!posterResult.allowed) return posterResult;

  return moderateVideoSource(input.mediaUrl, input.durationSec, 'reel', input.uploaderId);
}

export function isImageAttachmentMime(mimeType: unknown): boolean {
  if (typeof mimeType !== 'string') return false;
  return mimeType.trim().toLowerCase().startsWith('image/');
}

export async function moderateChatAttachment(
  attachmentUrl: string | undefined,
  attachmentMimeType?: unknown,
  context: 'salon_chat' | 'live_chat' | 'dm_attachment' = 'salon_chat',
  uploaderId?: string,
): Promise<ModerationResult> {
  if (!attachmentUrl?.trim()) return { allowed: true };
  if (!isImageAttachmentMime(attachmentMimeType)) {
    return { allowed: true, skipped: true };
  }
  return moderateImageSource(attachmentUrl, context, uploaderId);
}

export async function moderateDmAttachment(
  attachmentUrl: string | undefined,
  attachmentMimeType?: unknown,
  uploaderId?: string,
): Promise<ModerationResult> {
  return moderateChatAttachment(attachmentUrl, attachmentMimeType, 'dm_attachment', uploaderId);
}

export async function moderateFeedPostMedia(input: {
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  uploaderId?: string;
}): Promise<ModerationResult> {
  const urls =
    input.imageUrls?.length ? input.imageUrls : input.imageUrl ? [input.imageUrl] : [];
  for (const url of urls) {
    const imageResult = await moderateImageSource(url, 'feed_post', input.uploaderId);
    if (!imageResult.allowed) return imageResult;
  }
  if (input.videoUrl) {
    return moderateVideoSource(input.videoUrl, undefined, 'feed_video', input.uploaderId);
  }
  return { allowed: true };
}
