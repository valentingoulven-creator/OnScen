import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { isNativePushConfigured } from '../lib/nativePush';
import {
  deleteNativePushTokenByTokenForUser,
  upsertNativePushToken,
  type NativePushPlatform,
} from '../lib/pgNativePushTokens';

export const nativePushRouter = Router();

nativePushRouter.get('/native/status', (_req: Request, res: Response) => {
  res.json({ configured: isNativePushConfigured() });
});

nativePushRouter.post(
  '/native/register',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const { token, platform } = req.body as { token?: string; platform?: string };

    const deviceToken = token?.trim();
    if (!deviceToken || (platform !== 'ios' && platform !== 'android')) {
      res.status(400).json({ error: 'Token ou plateforme invalide.' });
      return;
    }

    const id = `npt_${Buffer.from(deviceToken).toString('base64url').slice(0, 48)}`;
    await upsertNativePushToken({
      id,
      userId,
      token: deviceToken,
      platform: platform as NativePushPlatform,
      createdAt: Date.now(),
    });

    res.json({ ok: true });
  })
);

nativePushRouter.post(
  '/native/unregister',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const token = String(req.body?.token ?? '').trim();
    if (!token) {
      res.status(400).json({ error: 'Token requis.' });
      return;
    }
    const deleted = await deleteNativePushTokenByTokenForUser(token, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Token introuvable pour ce compte.' });
      return;
    }
    res.json({ ok: true });
  })
);
