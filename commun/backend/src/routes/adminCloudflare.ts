import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { getCloudflareUsageReport } from '../lib/cloudflareUsage';
import { getDonationsSummaryReport } from '../lib/donationsSummary';
import { getAdminDonationsHistory } from '../lib/donationsHistory';
import { getVpsMetricsReport } from '../lib/vpsMetrics';
import { getProdSaasStatusReport } from '../lib/prodSaasStatus';
import { getAdminDiagnosticsReport } from '../lib/adminDiagnostics';
import { getStripePlatformStatusReport } from '../lib/stripePlatformStatus';

export const adminCloudflareRouter = Router();

/**
 * GET /api/admin/cloudflare-usage
 * Usage Cloudflare Stream du mois en cours (admin uniquement).
 */
adminCloudflareRouter.get('/cloudflare-usage', authenticateJWT, async (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  try {
    const report = await getCloudflareUsageReport();
    res.json(report);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur Cloudflare Stream',
    });
  }
});

/**
 * GET /api/admin/stripe-platform
 * Statut du compte Stripe plateforme (commission pourboires), admin uniquement.
 */
adminCloudflareRouter.get('/stripe-platform', authenticateJWT, async (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  try {
    const report = await getStripePlatformStatusReport();
    res.json(report);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur Stripe plateforme',
    });
  }
});

/**
 * GET /api/admin/donations-summary
 * Totaux pourboires live (simulation msdev + Stripe confirmé), admin uniquement.
 */
adminCloudflareRouter.get('/donations-summary', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  res.json(getDonationsSummaryReport());
});

/**
 * GET /api/admin/donations-history?limit=100&offset=0
 * Historique des pourboires live (payeur → créateur), admin uniquement.
 */
adminCloudflareRouter.get('/donations-history', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
  res.json(getAdminDonationsHistory({ limit, offset }));
});

/**
 * GET /api/admin/vps-metrics
 * Métriques VPS / hôte (RAM, disque, CPU, latence) — admin uniquement.
 */
adminCloudflareRouter.get('/vps-metrics', authenticateJWT, async (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  try {
    const report = await getVpsMetricsReport();
    res.json(report);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur métriques VPS',
    });
  }
});

/**
 * GET /api/admin/prod-saas-status
 * Statut configuration SaaS prod + liens dashboards externes.
 */
adminCloudflareRouter.get('/prod-saas-status', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  res.json(getProdSaasStatusReport());
});

/**
 * GET /api/admin/diagnostics
 * Vue d'ensemble infra : Sentry, PostGIS, PostgreSQL, backups, stats logs app.
 */
adminCloudflareRouter.get('/diagnostics', authenticateJWT, async (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  try {
    const report = await getAdminDiagnosticsReport();
    res.json(report);
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur diagnostic admin',
    });
  }
});
