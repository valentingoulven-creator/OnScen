import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import { logAdminAction } from '../lib/adminAuditLog';
import { checkPoolHealth, isPostgresEnabled } from '../db/pool';
import { checkExternalServicesHealth } from '../lib/healthChecks';
import { DEPLOY_ENVIRONMENTS, getDeployEnvironment } from '../lib/deployEnvironments';

export const adminEnvironmentsRouter = Router();

/** Lecture seule (statut) — limite large, surtout anti-spam accidentel (polling UI). */
const environmentsStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes — réessayez dans une minute.' },
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('admin-environments-status'),
});

export type EnvironmentHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface EnvironmentStatusResponse {
  id: string;
  label: string;
  siteUrl: string;
  status: EnvironmentHealthStatus;
  db?: 'ok' | 'error' | 'disabled';
  services?: Record<string, string> | null;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
}

/** Environnement courant (ce process backend) — vérifié en-process, sans round-trip HTTP. */
async function getCurrentProcessHealth(): Promise<EnvironmentStatusResponse> {
  const started = Date.now();
  const pgEnabled = isPostgresEnabled();
  const dbStatus = pgEnabled ? (await checkPoolHealth().catch(() => false)) ? 'ok' : 'error' : 'disabled';
  const services = await checkExternalServicesHealth().catch(() => null);
  return {
    id: 'dev',
    label: DEPLOY_ENVIRONMENTS.dev.label,
    siteUrl: DEPLOY_ENVIRONMENTS.dev.siteUrl,
    status: dbStatus === 'error' ? 'degraded' : 'ok',
    db: dbStatus,
    services: services as unknown as Record<string, string> | null,
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  };
}

/** Environnement distant (preprod/prod) — ping du endpoint /health public, sans SSH ni secret. */
async function getRemoteHealth(healthUrl: string, id: string, label: string, siteUrl: string): Promise<EnvironmentStatusResponse> {
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { id, label, siteUrl, status: 'degraded', latencyMs, checkedAt: new Date().toISOString() };
    }
    const body = (await res.json().catch(() => null)) as { db?: string; services?: Record<string, string> } | null;
    return {
      id,
      label,
      siteUrl,
      status: 'ok',
      db: (body?.db as EnvironmentStatusResponse['db']) ?? undefined,
      services: body?.services ?? null,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      id,
      label,
      siteUrl,
      status: 'down',
      checkedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'Injoignable',
    };
  }
}

/**
 * GET /api/admin/environments/:env/status
 * Statut lecture seule d'un environnement (dev/preprod/prod) — jamais d'action
 * d'écriture ici. Dev = vérifié en-process ; preprod/prod = ping /health public
 * (aucune clé SSH ni secret déplacé côté backend web).
 */
adminEnvironmentsRouter.get(
  '/environments/:env/status',
  authenticateJWT,
  environmentsStatusLimiter,
  async (req: Request, res: Response) => {
    const adminId = requireDevStaff(req, res);
    if (adminId == null) return;

    const envId = req.params.env;
    const cfg = getDeployEnvironment(envId);
    if (!cfg) {
      res.status(404).json({ error: `Environnement inconnu : ${envId}` });
      return;
    }

    const result =
      cfg.id === 'dev' || !cfg.healthUrl
        ? await getCurrentProcessHealth()
        : await getRemoteHealth(cfg.healthUrl, cfg.id, cfg.label, cfg.siteUrl);

    logAdminAction({
      adminId,
      action: 'environments.status_view',
      targetType: 'environment',
      targetId: cfg.id,
      details: { status: result.status },
      ip: req.ip,
    });

    res.json(result);
  }
);
