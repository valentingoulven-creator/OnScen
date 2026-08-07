/**
 * Limiteurs dédiés sur les endpoints coûteux identifiés par l'audit (DDOS-2 / MOD-6) comme
 * couverts uniquement par le plafond global 300 req/60s/IP : démarrage de live (création
 * de room LiveKit/Cloudflare), recherche (full-text), et actions à fort volume potentiel
 * (follow, like/heart) pouvant servir à des campagnes d'abus automatisées.
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { isMsdevRuntime } from './msdevGuard';
import { createRateLimitStore } from './rateLimitStore';

function userKey(req: Request): string {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? '127.0.0.1');
}

/** Démarrage de live — coûteux (provisioning LiveKit/Cloudflare) ; la garde anti-doublon
 * existante empêche déjà les doublons mais pas les tentatives répétées après erreur/stop. */
export const liveStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de démarrage de live. Réessayez dans quelques minutes.' },
  keyGenerator: userKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('lives-start'),
});

/** Recherche (users/music/globale) — requêtes full-text potentiellement coûteuses en DB. */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de recherches. Réessayez dans un instant.' },
  keyGenerator: userKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('search'),
});

/** Follow/unfollow — limite les campagnes de follow en masse (DDOS-4). */
export const followLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d’actions de suivi. Réessayez dans un instant.' },
  keyGenerator: userKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('follow'),
});

/** Like/heart (feed, reels) — limite les campagnes de like en masse (DDOS-4). */
export const likeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d’actions. Réessayez dans un instant.' },
  keyGenerator: userKey,
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('like'),
});
