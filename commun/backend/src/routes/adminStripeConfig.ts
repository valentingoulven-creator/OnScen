import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import { logAdminAction } from '../lib/adminAuditLog';
import {
  applyStripeConfig,
  getStripeConfigStatus,
  maskStripeSecret,
  validateStripeConfigInput,
} from '../lib/stripeConfigAdmin';

export const adminStripeConfigRouter = Router();

/** Endpoint sensible (écrit dans le .env de prod) — limite stricte, cluster-safe via Redis. */
const stripeConfigUpdateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives — réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('admin-stripe-config'),
});

/**
 * GET /api/admin/stripe-config
 * Statut masqué de la config Stripe active (jamais la clé secrète en clair).
 */
adminStripeConfigRouter.get('/stripe-config', authenticateJWT, (req: Request, res: Response) => {
  if (requireDevStaff(req, res) == null) return;
  res.json(getStripeConfigStatus());
});

/**
 * PUT /api/admin/stripe-config
 * Applique une nouvelle clé secrète / clé publique / secret webhook Stripe.
 * Persiste dans le .env actif + met à jour process.env (effet immédiat, sans
 * redémarrage — voir stripeConfigAdmin.ts). Admin Dev staff uniquement.
 * Body: { secretKey, publishableKey, webhookSecret? }
 */
adminStripeConfigRouter.put(
  '/stripe-config',
  authenticateJWT,
  stripeConfigUpdateLimiter,
  (req: Request, res: Response) => {
    const adminId = requireDevStaff(req, res);
    if (adminId == null) return;

    const body = (req.body ?? {}) as Partial<{
      secretKey: string;
      publishableKey: string;
      webhookSecret: string;
    }>;

    const fieldErrors = validateStripeConfigInput(body);
    if (fieldErrors.length > 0) {
      res.status(400).json({
        error: 'Configuration Stripe invalide',
        fieldErrors,
      });
      return;
    }

    try {
      const status = applyStripeConfig({
        secretKey: body.secretKey!.trim(),
        publishableKey: body.publishableKey!.trim(),
        webhookSecret: body.webhookSecret?.trim() || undefined,
      });

      logAdminAction({
        adminId,
        action: 'stripe_config_update',
        targetType: 'stripe_config',
        details: {
          mode: status.mode,
          secretKeyMasked: maskStripeSecret(body.secretKey),
          publishableKeyMasked: maskStripeSecret(body.publishableKey),
          webhookSecretUpdated: Boolean(body.webhookSecret?.trim()),
        },
        ip: req.ip,
      });
      console.log(`[admin][stripe_config_update] par ${adminId} — mode=${status.mode}`);

      res.json(status);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Erreur lors de la mise à jour de la config Stripe',
      });
    }
  }
);
