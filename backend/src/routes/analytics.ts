import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { getAnalyticsSummary } from '../lib/analytics';
import { isAccessAdmin } from '../lib/accessControl';

export const analyticsRouter = Router();

function isMsdevOrAdmin(req: Request): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) return false;
  const user = db.users.get(userId);
  return Boolean(user && isAccessAdmin(user));
}

/**
 * GET /api/analytics/summary
 * Tableau de bord analytique (msdev/admin uniquement).
 */
analyticsRouter.get('/summary', authenticateJWT, (req: Request, res: Response) => {
  if (!isMsdevOrAdmin(req)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  res.json(getAnalyticsSummary());
});

/**
 * POST /api/analytics/event
 * Enregistrement manuel d'un événement (msdev uniquement).
 */
analyticsRouter.post('/event', authenticateJWT, (req: Request, res: Response) => {
  if (!isMsdevOrAdmin(req)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  res.json({ ok: true });
});
