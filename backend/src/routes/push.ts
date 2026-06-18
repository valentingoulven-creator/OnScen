import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getVapidPublicKey, isWebPushConfigured } from '../lib/webPush';
import {
  deletePushSubscriptionByEndpoint,
  upsertPushSubscription,
} from '../lib/pgPushSubscriptions';

export const pushRouter = Router();

pushRouter.get('/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: 'Web Push non configuré.', configured: false });
    return;
  }
  res.json({ publicKey, configured: isWebPushConfigured() });
});

pushRouter.post('/subscribe', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const { subscription } = req.body as {
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
  };

  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: 'Abonnement push invalide.' });
    return;
  }

  const id = `push_${Buffer.from(endpoint).toString('base64url').slice(0, 48)}`;
  await upsertPushSubscription({
    id,
    userId,
    endpoint,
    p256dh,
    auth,
    createdAt: Date.now(),
  });

  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', authenticateJWT, async (req: Request, res: Response) => {
  const endpoint = String(req.body?.endpoint ?? '').trim();
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint requis.' });
    return;
  }
  await deletePushSubscriptionByEndpoint(endpoint);
  res.json({ ok: true });
});
