import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { isAccessAdmin } from '../lib/accessControl';
import { db } from '../models/schema';
import { getAlertHistory } from '../lib/alertNotifier';
import { getYoutubeSearchQuotaStatus } from '../lib/youtubeQuotaBudget';
import { getApiQuotaStatsSnapshot } from '../lib/apiQuotaMonitor';

export const adminMonitorRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

/** GET /api/admin/monitor/alerts — historique des alertes (admin uniquement) */
adminMonitorRouter.get('/alerts', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const history = getAlertHistory();
  res.json({
    alerts: history,
    count: history.length,
    thresholds: {
      diskPercent: parseInt(process.env.ALERT_DISK_PERCENT ?? '80', 10),
      ramPercent: parseInt(process.env.ALERT_RAM_PERCENT ?? '80', 10),
      cpuPercent: parseInt(process.env.ALERT_CPU_PERCENT ?? '80', 10),
      latencyMs: parseInt(process.env.ALERT_LATENCY_MS ?? '100', 10),
      intervalMs: parseInt(process.env.MONITOR_INTERVAL_MS ?? '300000', 10),
    },
  });
});

/** GET /api/admin/monitor/youtube-quota — consommation du bucket dédié search.list (admin uniquement) */
adminMonitorRouter.get('/youtube-quota', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json({ searchList: getYoutubeSearchQuotaStatus() });
});

/** GET /api/admin/monitor/api-quota — taux d'erreur ACRCloud/Sightengine sur fenêtre glissante (admin uniquement) */
adminMonitorRouter.get('/api-quota', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    services: getApiQuotaStatsSnapshot(),
    errorRateThreshold: parseFloat(process.env.API_QUOTA_ERROR_RATE_THRESHOLD ?? '0.2'),
    windowSize: parseInt(process.env.API_QUOTA_WINDOW_SIZE ?? '50', 10),
  });
});
