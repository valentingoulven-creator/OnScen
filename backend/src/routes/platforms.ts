import { Router, Request, Response } from 'express';
import { db, MusicPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { publicProfile } from '../lib/profile';
import {
  connectPlatformAccount,
  disconnectPlatformAccount,
  ensurePlatformAccountsFromLegacy,
  isPlatformConnected,
  isRealYoutubeAccount,
  publicPlatformLinks,
} from '../lib/platformConnect';
import {
  applyYoutubeOAuthToUser,
  completeYoutubeOAuth,
  createYoutubeOAuthUrl,
  isYoutubeOAuthConfigured,
} from '../lib/youtubeOAuth';
import { listHostYoutubePlaylists } from '../lib/youtubePlaylists';

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
    youtubeOAuthAvailable: isYoutubeOAuthConfigured(),
  });
});

platformsRouter.get('/youtube/oauth/url', authenticateJWT, (req: Request, res: Response) => {
  if (!isYoutubeOAuthConfigured()) {
    res.status(404).json({
      error: 'OAuth Google/YouTube non configuré (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)',
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }
  const userId = (req as Request & { user: { id: string } }).user.id;
  res.json({ url: createYoutubeOAuthUrl(userId) });
});

platformsRouter.get('/youtube/oauth/callback', async (req: Request, res: Response) => {
  const appUrl = (process.env.WEB_APP_URL || 'http://localhost:4080').replace(/\/$/, '');
  const err = req.query.error;
  const code = req.query.code;
  const state = req.query.state;
  if (err || !code || !state) {
    res.redirect(`${appUrl}/?youtube_oauth=error`);
    return;
  }
  const result = await completeYoutubeOAuth(String(code), String(state));
  if (!result) {
    res.redirect(`${appUrl}/?youtube_oauth=error`);
    return;
  }
  const user = db.users.get(result.userId);
  if (user) {
    applyYoutubeOAuthToUser(user, result);
    db.users.set(user.id, user);
  }
  res.redirect(`${appUrl}/?youtube_oauth=ok`);
});

platformsRouter.get('/youtube/playlists', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  if (!isPlatformConnected(user, 'youtube')) {
    res.status(403).json({ error: 'Connectez votre compte YouTube pour voir vos playlists' });
    return;
  }
  const playlists = await listHostYoutubePlaylists(user);
  res.json({
    playlists,
    isRealAccount: isRealYoutubeAccount(user),
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

  if (platform === 'youtube' && isYoutubeOAuthConfigured() && req.body?.preferOAuth === true) {
    res.json({ ok: false, oauthUrl: createYoutubeOAuthUrl(userId), code: 'USE_OAUTH_URL' });
    return;
  }

  const account = connectPlatformAccount(user, platform);
  if (platform === 'youtube') {
    account.displayName = `YouTube · ${user.username}`;
  }
  db.users.set(userId, user);
  res.json({
    ok: true,
    link: {
      platform: account.platform,
      externalUserId: account.externalUserId,
      connectedAt: account.connectedAt,
      displayName: account.displayName,
    },
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
