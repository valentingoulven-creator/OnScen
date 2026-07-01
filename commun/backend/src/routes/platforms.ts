import { Router, Request, Response } from 'express';
import { db, ConnectPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { publicProfile } from '../lib/profile';
import {
  connectPlatformAccount,
  disconnectPlatformAccount,
  ensurePlatformAccountsFromLegacy,
  hasRealPlatformConnection,
  isPlatformConnected,
  isRealYoutubeAccount,
  publicPlatformLinks,
} from '../lib/platformConnect';
import {
  applyYoutubeOAuthToUser,
  completeYoutubeOAuth,
  createYoutubeOAuthUrl,
  isYoutubeOAuthConfigured,
  probeYoutubeHostSession,
  revokeAndDisconnectYoutube,
} from '../lib/youtubeOAuth';
import { schedulePersist } from '../lib/persist';
import {
  createInstagramOAuthUrl,
  isInstagramOAuthConfigured,
} from '../lib/instagramOAuth';
import { canUseMockPlatformConnect } from '../lib/platformMockConnect';
import { listHostYoutubePlaylists } from '../lib/youtubePlaylists';

export const platformsRouter = Router();

function parsePlatform(param: string): ConnectPlatform | null {
  return param === 'youtube' || param === 'instagram' ? param : null;
}

platformsRouter.get('/status', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  db.users.set(userId, user);
  const youtubeOAuthAvailable = isYoutubeOAuthConfigured();
  const instagramOAuthAvailable = isInstagramOAuthConfigured();
  const oauthConfigured = youtubeOAuthAvailable || instagramOAuthAvailable;

  const youtubeMockConnectAvailable = canUseMockPlatformConnect(user);

  let youtubeSessionValid: boolean | undefined;
  let youtubeSessionCode: string | undefined;
  if (isPlatformConnected(user, 'youtube')) {
    const session = await probeYoutubeHostSession(user);
    youtubeSessionValid = session.ok;
    if (!session.ok) youtubeSessionCode = session.code;
  }

  res.json({
    links: publicPlatformLinks(user),
    connectedPlatforms: user.connectedPlatforms ?? [],
    youtubeOAuthAvailable,
    youtubeMockConnectAvailable,
    instagramOAuthAvailable,
    oauthConfigured,
    platformConnectionRequired: oauthConfigured,
    hasRealPlatformConnection: hasRealPlatformConnection(user),
    youtubeSessionValid,
    youtubeSessionCode,
  });
}));

platformsRouter.get('/youtube/oauth/url', authenticateJWT, (req: Request, res: Response) => {
  if (!isYoutubeOAuthConfigured()) {
    res.status(404).json({
      error:
        'OAuth Google/YouTube non configuré (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_CALLBACK_URL)',
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }
  const userId = (req as Request & { user: { id: string } }).user.id;
  res.json({ url: createYoutubeOAuthUrl(userId) });
});

platformsRouter.get('/instagram/oauth/url', authenticateJWT, (req: Request, res: Response) => {
  if (!isInstagramOAuthConfigured()) {
    res.status(404).json({
      error:
        'OAuth Instagram non configuré (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, INSTAGRAM_CALLBACK_URL)',
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }
  const userId = (req as Request & { user: { id: string } }).user.id;
  res.json({ url: createInstagramOAuthUrl(userId) });
});

/**
 * GET /api/platforms/youtube/oauth/callback — route de callback alternative.
 *
 * @deprecated Route non documentée dans les fichiers d'exemple d'environnement actuels
 * (`YOUTUBE_CALLBACK_URL` y pointe systématiquement vers `GET /api/auth/youtube/callback`,
 * voir routes/oauth.ts). Cette route ne reste active que via l'ancien fallback
 * `GOOGLE_REDIRECT_URI` (voir commun/msdev/.env.example, commenté). Conservée pour compatibilité
 * avec d'éventuelles configurations existantes ; ne pas l'utiliser pour de nouvelles configs.
 */
platformsRouter.get('/youtube/oauth/callback', async (req: Request, res: Response) => {
  const appUrl = (process.env.WEB_APP_URL || 'http://localhost:4080').replace(/\/$/, '');
  const err = req.query.error;
  const code = req.query.code;
  const state = req.query.state;
  if (err || !code || !state) {
    res.redirect(`${appUrl}/?youtube_oauth=error`);
    return;
  }
  try {
    const result = await completeYoutubeOAuth(String(code), String(state));
    if (!result) {
      res.redirect(`${appUrl}/?youtube_oauth=error`);
      return;
    }
    const user = db.users.get(result.userId);
    if (user) {
      applyYoutubeOAuthToUser(user, result);
      db.users.set(user.id, user);
      schedulePersist();
    }
    res.redirect(`${appUrl}/?youtube_oauth=ok`);
  } catch {
    // Toujours rediriger l'utilisateur plutôt que de laisser un rejet non
    // catché bloquer la réponse HTTP (callback déclenché par Google, hors
    // contrôle de l'app).
    res.redirect(`${appUrl}/?youtube_oauth=error`);
  }
});

platformsRouter.get('/youtube/playlists', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
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
}));

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

  const isProduction = process.env.APP_ENV === 'production';
  const mockConnectAllowed = canUseMockPlatformConnect(user);

  if (platform === 'youtube' && isYoutubeOAuthConfigured() && !mockConnectAllowed) {
    res.status(403).json({
      ok: false,
      error: 'Connexion démo indisponible — utilisez Google OAuth ou contactez un administrateur.',
      code: 'USE_OAUTH_URL',
      oauthUrl: createYoutubeOAuthUrl(userId),
    });
    return;
  }

  if (platform === 'instagram') {
    if (isInstagramOAuthConfigured()) {
      res.json({ ok: false, oauthUrl: createInstagramOAuthUrl(userId), code: 'USE_OAUTH_URL' });
      return;
    }
    res.status(404).json({
      error:
        'OAuth Instagram non configuré (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, INSTAGRAM_CALLBACK_URL)',
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }

  if (isProduction && !mockConnectAllowed) {
    res.status(403).json({
      error: 'Connexion plateforme simulée désactivée en production. Configurez OAuth.',
      code: 'MOCK_CONNECT_DISABLED',
    });
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

platformsRouter.delete('/:platform/disconnect', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
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
  if (platform === 'youtube') {
    await revokeAndDisconnectYoutube(user);
  } else {
    disconnectPlatformAccount(user, platform);
  }
  db.users.set(userId, user);
  schedulePersist();
  res.json({ ok: true, user: publicProfile(user, true, user.id) });
}));
