import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import { getStatsOverview } from '../lib/statsOverview';

export const adminStatsOverviewRouter = Router();

/** Lecture seule (agrégats en mémoire) — limite anti-spam polling UI. */
const statsOverviewLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes — réessayez dans une minute.' },
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('admin-stats-overview'),
});

/**
 * GET /api/admin/stats-overview
 * Statistiques complètes lecture seule : audience (inscrits, connectés
 * maintenant/jour/semaine/mois), volumes (reels/salons/lives/événements) et
 * classements (reels les plus vus, salons/lives les plus regardés).
 */
adminStatsOverviewRouter.get(
  '/stats-overview',
  authenticateJWT,
  statsOverviewLimiter,
  (req: Request, res: Response) => {
    const adminId = requireAdmin(req, res);
    if (adminId == null) return;
    res.json(getStatsOverview());
  }
);
