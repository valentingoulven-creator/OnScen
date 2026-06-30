import type { Request, Response, NextFunction } from 'express';
import { isDeployedEnv } from '../lib/jwtSecret';
import { isMsdevRuntime } from '../lib/msdevGuard';

function extractOpsToken(req: Request): string | null {
  const header = req.headers['x-ops-health-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

/** Protects /health/db — requires OPS_HEALTH_TOKEN on deployed environments. */
export function requireOpsHealthToken(req: Request, res: Response, next: NextFunction): void {
  if (isMsdevRuntime()) {
    next();
    return;
  }

  const expected = process.env.OPS_HEALTH_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({ error: 'Diagnostics DB désactivés (OPS_HEALTH_TOKEN absent).' });
    return;
  }

  const provided = extractOpsToken(req);
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  next();
}

/** Fail fast when ops token is missing on deployed stacks. */
export function assertOpsHealthTokenConfigured(): void {
  if (!isDeployedEnv()) return;
  const token = process.env.OPS_HEALTH_TOKEN?.trim();
  if (!token || token.length < 32) {
    throw new Error(
      '[startup] OPS_HEALTH_TOKEN must be set (≥32 chars) in production — required for /health/db.'
    );
  }
}
