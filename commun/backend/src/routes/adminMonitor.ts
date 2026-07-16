import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { getAlertHistory } from '../lib/alertNotifier';
import { getYoutubeSearchQuotaStatus } from '../lib/youtubeQuotaBudget';
import { getApiQuotaStatsSnapshot } from '../lib/apiQuotaMonitor';
import { getBackupsStatusReport } from '../lib/backupsStatus';

export const adminMonitorRouter = Router();

/** GET /api/admin/monitor/alerts — historique des alertes (admin uniquement) */
adminMonitorRouter.get('/alerts', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
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
  if (requireDevStaff(req, res) == null) return;
  res.json({ searchList: getYoutubeSearchQuotaStatus() });
});

/** GET /api/admin/monitor/api-quota — taux d'erreur ACRCloud/Sightengine sur fenêtre glissante (admin uniquement) */
adminMonitorRouter.get('/api-quota', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  res.json({
    services: getApiQuotaStatsSnapshot(),
    errorRateThreshold: parseFloat(process.env.API_QUOTA_ERROR_RATE_THRESHOLD ?? '0.2'),
    windowSize: parseInt(process.env.API_QUOTA_WINDOW_SIZE ?? '50', 10),
  });
});

/** GET /api/admin/monitor/backups — statut sauvegardes DB/uploads/off-site (admin uniquement) */
adminMonitorRouter.get('/backups', authenticateJWT, async (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  try {
    const report = await getBackupsStatusReport();
    res.json(report);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur statut backups',
    });
  }
});
