import { Router, Request, Response } from 'express';
import { db, MusicPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { publicProfile } from '../lib/profile';
import {
  connectPlatformAccount,
  disconnectPlatformAccount,
  ensurePlatformAccountsFromLegacy,
  isPlatformConnected,
  publicPlatformLinks,
} from '../lib/platformConnect';

export const platformsRouter = Router();

function parsePlatform(param: string): MusicPlatform | null {
  return param === 'spotify' || param === 'youtube' ? param : null;
}

platformsRouter.get('/status', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  db.users.set(userId, user);
  res.json({
    links: publicPlatformLinks(user),
    connectedPlatforms: user.connectedPlatforms ?? [],
  });
});

platformsRouter.post('/:platform/connect', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const platform = parsePlatform(req.params.platform);
  if (!platform) {
    res.status(400).json({ error: 'Plateforme invalide' });
    return;
  }
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const useRealOAuth =
    process.env.MSENV === 'msdev' ||
    process.env.APP_ENV === 'msdev'
      ? process.env[`${platform.toUpperCase()}_OAUTH_ENABLED`] === 'true'
      : process.env[`${platform.toUpperCase()}_OAUTH_ENABLED`] === 'true';

  if (useRealOAuth) {
    res.status(501).json({
      error: `OAuth ${platform} non configuré — définissez les clés API ou utilisez le mode msdev`,
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }

  const account = connectPlatformAccount(user, platform);
  db.users.set(userId, user);
  res.json({
    ok: true,
    link: { platform: account.platform, externalUserId: account.externalUserId, connectedAt: account.connectedAt },
    user: publicProfile(user, true, user.id),
  });
});

platformsRouter.delete('/:platform/disconnect', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const platform = parsePlatform(req.params.platform);
  if (!platform) {
    res.status(400).json({ error: 'Plateforme invalide' });
    return;
  }
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (!isPlatformConnected(user, platform)) {
    res.status(400).json({ error: 'Compte non connecté' });
    return;
  }
  disconnectPlatformAccount(user, platform);
  db.users.set(userId, user);
  res.json({ ok: true, user: publicProfile(user, true, user.id) });
});
