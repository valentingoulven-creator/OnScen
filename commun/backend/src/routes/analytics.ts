import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { getAnalyticsSummary, parseAnalyticsPeriod } from '../lib/analytics';
import { isDevStaff } from '../lib/accessControl';

export const analyticsRouter = Router();

function isAnalyticsAllowed(req: Request): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) return false;
  const user = db.users.get(userId);
  return Boolean(user && isDevStaff(user));
}

/**
 * GET /api/analytics/summary
 * Tableau de bord analytique (msdev/admin uniquement).
 */
analyticsRouter.get('/summary', authenticateJWT, (req: Request, res: Response) => {
  if (!isAnalyticsAllowed(req)) {
    res.status(403).json({ error: 'Accès réservé aux comptes Dev' });
    return;
  }
  const period = parseAnalyticsPeriod(req.query.period);
  const locale =
    typeof req.query.locale === 'string' && req.query.locale.startsWith('en') ? 'en-GB' : 'fr-FR';
  res.json(getAnalyticsSummary(period, locale));
});

/**
 * POST /api/analytics/event
 * Enregistrement manuel d'un événement (msdev uniquement).
 */
analyticsRouter.post('/event', authenticateJWT, (req: Request, res: Response) => {
  if (!isAnalyticsAllowed(req)) {
    res.status(403).json({ error: 'Accès réservé aux comptes Dev' });
    return;
  }
  res.json({ ok: true });
});
