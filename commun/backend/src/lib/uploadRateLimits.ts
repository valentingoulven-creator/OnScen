import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { isMsdevRuntime } from './msdevGuard';
import { createRateLimitStore } from './rateLimitStore';

function uploadKey(req: Request): string {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? '127.0.0.1');
}

function skipNonMutatingUpload(req: Request): boolean {
  if (isMsdevRuntime()) return true;
  const method = req.method?.toUpperCase() ?? 'GET';
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

/** Reels, compositions, stories — création / upload JSON lourd. */
export const mediaUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d\'uploads. Réessayez dans quelques minutes.' },
  keyGenerator: uploadKey,
  skip: skipNonMutatingUpload,
  store: createRateLimitStore('upload-media'),
});

/** Photos de profil (PATCH /auth/profile avec data URLs). */
export const profilePhotoUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de mises à jour de photos. Réessayez plus tard.' },
  keyGenerator: uploadKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('upload-profile-photo'),
});

/** Pièces jointes chat (data URL → fichier local). */
export const chatAttachmentUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de fichiers envoyés. Réessayez dans quelques secondes.' },
  keyGenerator: uploadKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('upload-chat-attachment'),
});
