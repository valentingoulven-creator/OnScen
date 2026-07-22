import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import { logAdminAction } from '../lib/adminAuditLog';
import { getProviderDef } from '../lib/externalSecretsRegistry';
import {
  applyProviderConfig,
  getExternalSecretsStatus,
  maskExternalSecretValue,
  validateProviderInput,
} from '../lib/externalSecretsAdmin';

export const adminExternalSecretsRouter = Router();

/** Endpoint sensible (écrit dans le .env de prod) — même limite que /admin/stripe-config. */
const externalSecretsUpdateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives — réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('admin-external-secrets'),
});

/**
 * GET /api/admin/external-secrets
 * Statut masqué de tous les providers d'API tierces (registre
 * `externalSecretsRegistry.ts`) — jamais une valeur secrète en clair.
 */
adminExternalSecretsRouter.get('/external-secrets', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  res.json(getExternalSecretsStatus());
});

/**
 * PUT /api/admin/external-secrets/:provider
 * Applique les variables d'un provider donné. Whitelist stricte (registre) :
 * toute clé absente de la définition du provider est refusée avant même
 * d'atteindre le fichier `.env`. Admin Dev staff uniquement.
 * Body: { values: Record<string, string> }
 */
adminExternalSecretsRouter.put(
  '/external-secrets/:provider',
  authenticateJWT,
  externalSecretsUpdateLimiter,
  (req: Request, res: Response) => {
    const adminId = requireDevStaff(req, res);
    if (adminId == null) return;

    const providerId = req.params.provider;
    const providerDef = getProviderDef(providerId);
    if (!providerDef) {
      res.status(404).json({ error: `Provider inconnu : ${providerId}` });
      return;
    }

    const body = (req.body ?? {}) as { values?: Record<string, string> };
    const values = body.values ?? {};
    if (typeof values !== 'object' || Array.isArray(values)) {
      res.status(400).json({ error: 'Corps de requête invalide — { values: Record<string,string> } attendu.' });
      return;
    }

    const fieldErrors = validateProviderInput(providerId, values);
    if (fieldErrors.length > 0) {
      res.status(400).json({
        error: 'Configuration invalide',
        fieldErrors,
      });
      return;
    }

    try {
      const status = applyProviderConfig(providerId, values);

      const maskedDetails: Record<string, string | null> = {};
      for (const field of providerDef.fields) {
        const raw = values[field.key];
        if (raw == null || raw.trim() === '') continue;
        maskedDetails[field.key] = field.kind === 'secret' ? maskExternalSecretValue(raw) : raw.trim();
      }

      logAdminAction({
        adminId,
        action: 'external_secrets_update',
        targetType: 'external_secrets',
        targetId: providerId,
        details: { provider: providerId, fields: maskedDetails },
        ip: req.ip,
      });
      console.log(`[admin][external_secrets_update] par ${adminId} — provider=${providerId}`);

      res.json(status);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Erreur lors de la mise à jour de la configuration',
      });
    }
  }
);
