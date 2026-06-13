import { Router, Request, Response } from 'express';
import { db, ConnectPlatform, MusicPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
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
} from '../lib/youtubeOAuth';
import {
  isSpotifyOAuthConfigured,
  createSpotifyOAuthUrl,
  userNeedsSpotifyScopeReconnect,
  getStoredSpotifyProduct,
  persistSpotifyProduct,
} from '../lib/spotifyOAuth';
import { respondSpotifySessionAuthFailure } from '../lib/spotifySession';
import {
  applyInstagramOAuthToUser,
  completeInstagramOAuth,
  createInstagramOAuthUrl,
  isInstagramOAuthConfigured,
} from '../lib/instagramOAuth';
import { listHostYoutubePlaylists } from '../lib/youtubePlaylists';
import {
  isRealSpotifyAccount,
  listHostSpotifyPlaylists,
  probeSpotifyHostSession,
  SpotifyPlaylistError,
  verifySpotifyPlaylistTrackAccess,
} from '../lib/spotifyPlaylists';

export const platformsRouter = Router();

function parsePlatform(param: string): ConnectPlatform | null {
  return param === 'spotify' || param === 'youtube' || param === 'instagram' ? param : null;
}

platformsRouter.get('/status', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  db.users.set(userId, user);
  const spotifyOAuthAvailable = isSpotifyOAuthConfigured();
  const youtubeOAuthAvailable = isYoutubeOAuthConfigured();
  const instagramOAuthAvailable = isInstagramOAuthConfigured();
  const oauthConfigured = spotifyOAuthAvailable || youtubeOAuthAvailable || instagramOAuthAvailable;

  let spotifySessionValid: boolean | undefined;
  let spotifySessionCode: string | undefined;
  let spotifyProduct: string | undefined;
  let spotifyPremium: boolean | undefined;
  if (isPlatformConnected(user, 'spotify')) {
    const storedProduct = getStoredSpotifyProduct(user);
    if (storedProduct && storedProduct !== 'unknown') {
      spotifyProduct = storedProduct;
      spotifyPremium = storedProduct === 'premium';
    }
    const session = await probeSpotifyHostSession(user);
    spotifySessionValid = session.ok;
    if (!session.ok) spotifySessionCode = session.code;
    if ('product' in session && session.product && session.product !== 'unknown') {
      spotifyProduct = session.product;
      spotifyPremium = session.product === 'premium';
      persistSpotifyProduct(user, session.product);
      db.users.set(userId, user);
    }
  }

  res.json({
    links: publicPlatformLinks(user),
    connectedPlatforms: user.connectedPlatforms ?? [],
    youtubeOAuthAvailable,
    spotifyOAuthAvailable,
    instagramOAuthAvailable,
    oauthConfigured,
    platformConnectionRequired: oauthConfigured,
    hasRealPlatformConnection: hasRealPlatformConnection(user),
    spotifySessionValid,
    spotifySessionCode,
    spotifyProduct,
    spotifyPremium,
    spotifyNeedsScopeReconnect: userNeedsSpotifyScopeReconnect(user),
  });
});

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

platformsRouter.get('/spotify/oauth/url', authenticateJWT, (req: Request, res: Response) => {
  if (!isSpotifyOAuthConfigured()) {
    res.status(404).json({
      error: 'OAuth Spotify non configuré (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_CALLBACK_URL)',
      code: 'OAUTH_NOT_CONFIGURED',
    });
    return;
  }
  const userId = (req as Request & { user: { id: string } }).user.id;
  const forceConsent =
    req.query.reconnect === '1' ||
    req.query.reconnect === 'true' ||
    req.query.force_consent === '1' ||
    req.query.force_consent === 'true';
  res.json({ url: createSpotifyOAuthUrl(userId, { forceConsent }) });
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

platformsRouter.get('/spotify/playlists', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  if (!isPlatformConnected(user, 'spotify')) {
    res.status(403).json({ error: 'Connectez votre compte Spotify pour voir vos playlists' });
    return;
  }
  const session = await probeSpotifyHostSession(user);
  if (!session.ok) {
    res.json({
      playlists: [],
      isRealAccount: false,
      spotifySessionValid: false,
      spotifySessionCode: session.code,
      spotifyProduct: 'product' in session ? session.product : undefined,
    });
    return;
  }
  const playlists = await listHostSpotifyPlaylists(user);
  res.json({
    playlists,
    isRealAccount: isRealSpotifyAccount(user),
    spotifySessionValid: true,
    spotifyProduct: session.product,
  });
});

platformsRouter.post('/spotify/playlists/verify-access', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  ensurePlatformAccountsFromLegacy(user);
  if (!isPlatformConnected(user, 'spotify')) {
    res.status(403).json({ error: 'Connectez votre compte Spotify', code: 'spotify_not_connected' });
    return;
  }

  const { playlistId, playlistUrl } = req.body ?? {};
  const rawRef =
    (typeof playlistId === 'string' ? playlistId.trim() : '') ||
    (typeof playlistUrl === 'string' ? playlistUrl.trim() : '') ||
    '';
  if (!rawRef) {
    res.status(400).json({ error: 'playlistId ou lien playlist requis' });
    return;
  }

  const session = await probeSpotifyHostSession(user);
  if (!session.ok && respondSpotifySessionAuthFailure(res, session.code)) {
    db.users.set(userId, user);
    return;
  }

  try {
    await verifySpotifyPlaylistTrackAccess(user, rawRef);
    db.users.set(userId, user);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof SpotifyPlaylistError) {
      db.users.set(userId, user);
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'Vérification playlist Spotify indisponible' });
  }
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

  const isProduction = process.env.APP_ENV === 'production';

  if (platform === 'youtube' && isYoutubeOAuthConfigured()) {
    res.json({ ok: false, oauthUrl: createYoutubeOAuthUrl(userId), code: 'USE_OAUTH_URL' });
    return;
  }

  if (platform === 'spotify' && isSpotifyOAuthConfigured()) {
    res.json({ ok: false, oauthUrl: createSpotifyOAuthUrl(userId), code: 'USE_OAUTH_URL' });
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

  if (isProduction) {
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
