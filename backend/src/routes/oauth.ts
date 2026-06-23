import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { db, type User } from '../models/schema';
import { signTokenForUser, setAuthCookie } from '../middleware/auth';
import { applyProfileDefaults, publicProfile } from '../lib/profile';
import { schedulePersist } from '../lib/persist';
import { trackEvent, trackUserActive } from '../lib/analytics';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import {
  assertRegistrationAllowed,
  loginAccessDeniedReason,
  resolveInitialAccountStatus,
} from '../lib/accessControl';
import { createOAuthExchangeCode, consumeOAuthExchangeCode, peekOAuthExchangeCode } from '../lib/oauthExchange';
import {
  applyYoutubeOAuthToUser,
  completeYoutubeOAuth,
  isYoutubeOAuthConfigured,
} from '../lib/youtubeOAuth';
import {
  applyInstagramOAuthToUser,
  completeInstagramOAuth,
  isInstagramOAuthConfigured,
} from '../lib/instagramOAuth';
import { isMsdevRuntime } from '../lib/msdevGuard';

export const oauthRouter = Router();

/** 20 tentatives / 15 min par IP sur les routes d'initiation et d'échange OAuth. */
const oauthInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives OAuth. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
});

// ─── CSRF state store (TTL 10 min) ──────────────────────────────────────────
const oauthStates = new Map<string, { provider: string; userId?: string; expiresAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [k, v] of oauthStates.entries()) {
    if (now > v.expiresAt) oauthStates.delete(k);
  }
}

function createState(provider: string): string {
  pruneStates();
  const s = crypto.randomBytes(32).toString('hex');
  oauthStates.set(s, { provider, expiresAt: Date.now() + STATE_TTL_MS });
  return s;
}

function validateAndConsumeState(state: string, provider: string): boolean {
  const entry = oauthStates.get(state);
  if (!entry || Date.now() > entry.expiresAt || entry.provider !== provider) return false;
  oauthStates.delete(state);
  return true;
}

function consumeStateForUser(state: string, provider: string): string | null {
  const entry = oauthStates.get(state);
  if (!entry || Date.now() > entry.expiresAt || entry.provider !== provider || !entry.userId) return null;
  oauthStates.delete(state);
  return entry.userId;
}

function redirectOAuthSuccess(res: Response, origin: string, userId: string, isNew: boolean): void {
  const user = db.users.get(userId);
  if (!user) {
    res.redirect(`${origin}/?oauth_error=server_error`);
    return;
  }
  if (isNew && user.accountStatus === 'pending') {
    res.redirect(`${origin}/?oauth_pending=1`);
    return;
  }
  const denied = loginAccessDeniedReason(user);
  if (denied) {
    const code = user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending';
    res.redirect(`${origin}/?oauth_error=${code}`);
    return;
  }
  if (isNew && !user.acceptedTermsAt) {
    const exchangeCode = createOAuthExchangeCode(userId, true);
    res.redirect(`${origin}/?oauth_code=${exchangeCode}&needs_terms=1`);
    return;
  }
  const exchangeCode = createOAuthExchangeCode(userId, isNew);
  const params = new URLSearchParams({ oauth_code: exchangeCode });
  if (isNew) params.set('new_user', '1');
  res.redirect(`${origin}/?${params}`);
}
// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolves the frontend origin (used for error/success redirects). */
function appOrigin(): string {
  const webApp = process.env.WEB_APP_URL?.trim();
  if (webApp) return webApp.replace(/\/$/, '');
  const cors = process.env.CORS_ORIGIN?.split(',')[0].trim();
  return cors || 'http://localhost:4080';
}

/**
 * Generate a username from OAuth display name or email.
 * Appends a random 4-digit suffix if the base name is already taken.
 */
function generateUsername(name: string, email: string): string {
  const raw = name
    ? name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_àâäéèêëîïôùûüç]/gi, '').slice(0, 20)
    : email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
  const base = raw || 'user';
  let username = base;
  let attempts = 0;
  while (
    [...db.users.values()].some((u) => u.username.toLowerCase() === username.toLowerCase()) &&
    attempts < 10
  ) {
    username = `${base}_${1000 + Math.floor(Math.random() * 8999)}`;
    attempts++;
  }
  return username;
}

interface OAuthProfile {
  provider: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Find an existing user by email or create a new one from the OAuth profile.
 * New users get accountStatus='active' and a non-functional passwordHash
 * (bcryptjs.compare will return false for any password, keeping the account
 * secure while allowing a password to be set later from settings).
 */
function findOrCreateOAuthUser(profile: OAuthProfile): { user: User; isNew: boolean } | { error: string } {
  const existing = [...db.users.values()].find((u) => u.email === profile.email);
  if (existing) {
    applyProfileDefaults(existing);
    db.users.set(existing.id, existing);
    return { user: existing, isNew: false };
  }

  const regCheck = assertRegistrationAllowed({});
  if (!regCheck.ok) {
    return { error: regCheck.error };
  }

  const username = generateUsername(profile.name, profile.email);
  const accountStatus = resolveInitialAccountStatus();
  let user: User = {
    id: `user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    username,
    email: profile.email,
    passwordHash: `oauth_${profile.provider}_${crypto.randomBytes(16).toString('hex')}`,
    avatarUrl:
      profile.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    memberSince: Date.now(),
    accountStatus,
    onboardingCompleted: false,
  };
  user = applyProfileDefaults(user);
  db.users.set(user.id, user);
  schedulePersist();
  return { user, isNew: true };
}
/** Typed fetch wrapper for JSON GET requests. */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Typed fetch wrapper for application/x-www-form-urlencoded POST requests. */
async function postForm(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${url} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ─── Provider status (no secrets exposed) ───────────────────────────────────

/**
 * GET /api/auth/providers
 * Returns which social providers are fully configured.
 * Used by the frontend to enable/disable OAuth buttons without a rebuild.
 */
oauthRouter.get('/providers', (_req: Request, res: Response) => {
  res.json({
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL,
    ),
    facebook: Boolean(
      process.env.FACEBOOK_APP_ID &&
        process.env.FACEBOOK_APP_SECRET &&
        process.env.FACEBOOK_CALLBACK_URL,
    ),
    youtube: isYoutubeOAuthConfigured(),
    instagram: isInstagramOAuthConfigured(),
  });
});

/**
 * POST /api/auth/oauth/exchange
 * Échange un code OAuth éphémère (redirection sans JWT dans l’URL) contre un jeton de session.
 */
oauthRouter.post('/oauth/exchange', oauthInitLimiter, (req: Request, res: Response) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const acceptTerms = req.body?.acceptTerms === true;
  const confirmAge = req.body?.confirmAge === true;
  const termsVersion = typeof req.body?.termsVersion === 'string' ? req.body.termsVersion : undefined;

  if (!code) {
    res.status(400).json({ error: 'Code OAuth manquant' });
    return;
  }

  const entry = peekOAuthExchangeCode(code);
  if (!entry) {
    res.status(400).json({ error: 'Code OAuth invalide ou expiré' });
    return;
  }

  const user = db.users.get(entry.userId);
  if (!user) {
    consumeOAuthExchangeCode(code);
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (entry.isNew && !user.acceptedTermsAt) {
    if (!acceptTerms) {
      res.status(400).json({
        needsTermsAcceptance: true,
        error: 'Vous devez accepter les CGU et la Politique de confidentialité',
      });
      return;
    }
    if (!confirmAge) {
      res.status(400).json({
        needsTermsAcceptance: true,
        error: 'Vous devez confirmer avoir au moins 13 ans pour créer un compte',
        code: 'age_not_confirmed',
      });
      return;
    }
    if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
      res.status(400).json({
        error: 'Les conditions ont été mises à jour. Rechargez la page et acceptez la nouvelle version.',
      });
      return;
    }
    user.acceptedTermsAt = Date.now();
    user.acceptedTermsVersion = CURRENT_TERMS_VERSION;
    user.ageConfirmedAt = Date.now();
    db.users.set(user.id, user);
    schedulePersist();
  }

  if (user.accountStatus === 'pending') {
    consumeOAuthExchangeCode(code);
    res.status(403).json({
      pending: true,
      message:
        'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.',
    });
    return;
  }

  const denied = loginAccessDeniedReason(user);
  if (denied) {
    consumeOAuthExchangeCode(code);
    res.status(403).json({
      error: denied,
      code: user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending',
    });
    return;
  }

  consumeOAuthExchangeCode(code);
  applyProfileDefaults(user);
  db.users.set(user.id, user);
  const token = signTokenForUser(user);
  setAuthCookie(res, token, true);
  trackEvent('user_login_oauth', user.id);
  trackUserActive(user.id);
  res.json({
    token,
    user: publicProfile(user, true, user.id),
    isNew: entry.isNew,
  });
});
// ─── Google OAuth 2.0 ────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USER_URL  = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** GET /api/auth/google — initiates the Google OAuth flow */
oauthRouter.get('/google', oauthInitLimiter, (_req: Request, res: Response) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    res.redirect(`${appOrigin()}/?oauth_error=not_configured&provider=google`);
    return;
  }
  const state = createState('google');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

/** GET /api/auth/google/callback — handles the redirect from Google */
oauthRouter.get('/google/callback', oauthInitLimiter, async (req: Request, res: Response) => {
  const origin = appOrigin();
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code) {
    res.redirect(`${origin}/?oauth_error=cancelled&provider=google`);
    return;
  }
  if (!validateAndConsumeState(state, 'google')) {
    res.redirect(`${origin}/?oauth_error=invalid_state&provider=google`);
    return;
  }

  try {
    const tok = (await postForm(GOOGLE_TOKEN_URL, {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
      grant_type: 'authorization_code',
    })) as { access_token?: string };

    if (!tok.access_token) throw new Error('Missing access_token in Google token response');

    const info = (await getJson(
      `${GOOGLE_USER_URL}?access_token=${tok.access_token}`,
    )) as { email?: string; name?: string; picture?: string };

    if (!info.email) throw new Error('Google profile has no email');

    const result = findOrCreateOAuthUser({
      provider: 'google',
      email: info.email,
      name: info.name ?? '',
      avatarUrl: info.picture,
    });
    if ('error' in result) {
      res.redirect(`${origin}/?oauth_error=registration_denied&provider=google`);
      return;
    }
    const { user, isNew } = result;

    redirectOAuthSuccess(res, origin, user.id, isNew);  } catch (err) {
    console.error('[oauth] Google callback error:', err);
    res.redirect(`${origin}/?oauth_error=server_error&provider=google`);
  }
});

// ─── Facebook OAuth 2.0 ──────────────────────────────────────────────────────

const FB_AUTH_URL  = 'https://www.facebook.com/v19.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const FB_USER_URL  = 'https://graph.facebook.com/me?fields=id,name,email,picture.width(200)';

/** GET /api/auth/facebook — initiates the Facebook OAuth flow */
oauthRouter.get('/facebook', oauthInitLimiter, (_req: Request, res: Response) => {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL } = process.env;
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_CALLBACK_URL) {
    res.redirect(`${appOrigin()}/?oauth_error=not_configured&provider=facebook`);
    return;
  }
  const state = createState('facebook');
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: FACEBOOK_CALLBACK_URL,
    state,
    scope: 'email,public_profile',
  });
  res.redirect(`${FB_AUTH_URL}?${params}`);
});

/** GET /api/auth/facebook/callback — handles the redirect from Facebook */
oauthRouter.get('/facebook/callback', oauthInitLimiter, async (req: Request, res: Response) => {
  const origin = appOrigin();
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code) {
    res.redirect(`${origin}/?oauth_error=cancelled&provider=facebook`);
    return;
  }
  if (!validateAndConsumeState(state, 'facebook')) {
    res.redirect(`${origin}/?oauth_error=invalid_state&provider=facebook`);
    return;
  }

  try {
    const tok = (await postForm(FB_TOKEN_URL, {
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: process.env.FACEBOOK_CALLBACK_URL!,
      code,
    })) as { access_token?: string };

    if (!tok.access_token) throw new Error('Missing access_token in Facebook token response');

    const info = (await getJson(
      `${FB_USER_URL}&access_token=${tok.access_token}`,
    )) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };

    if (!info.email) {
      throw new Error(
        'Facebook profile has no email — enable "email" permission in your Facebook app settings',
      );
    }

    const result = findOrCreateOAuthUser({
      provider: 'facebook',
      email: info.email,
      name: info.name ?? '',
      avatarUrl: info.picture?.data?.url,
    });
    if ('error' in result) {
      res.redirect(`${origin}/?oauth_error=registration_denied&provider=facebook`);
      return;
    }
    const { user, isNew } = result;

    redirectOAuthSuccess(res, origin, user.id, isNew);  } catch (err) {
    console.error('[oauth] Facebook callback error:', err);
    res.redirect(`${origin}/?oauth_error=server_error&provider=facebook`);
  }
});

// ─── YouTube OAuth (platform linking) ────────────────────────────────────────

/** GET /api/auth/youtube — déprécié : utiliser GET /api/platforms/youtube/oauth/url avec JWT en en-tête. */
oauthRouter.get('/youtube', oauthInitLimiter, (_req: Request, res: Response) => {
  const origin = appOrigin();
  res.redirect(`${origin}/?youtube_oauth=error&reason=use_platform_api`);
});

/** GET /api/auth/youtube/callback — handles the redirect from Google for YouTube linking */
oauthRouter.get('/youtube/callback', async (req: Request, res: Response) => {
  const origin = appOrigin();
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    res.redirect(`${origin}/?youtube_oauth=error`);
    return;
  }

  try {
    const result = await completeYoutubeOAuth(code, state);
    if (!result) {
      res.redirect(`${origin}/?youtube_oauth=error`);
      return;
    }
    const user = db.users.get(result.userId);
    if (user) {
      applyYoutubeOAuthToUser(user, result);
      db.users.set(user.id, user);
      schedulePersist();
    }
    res.redirect(`${origin}/?youtube_oauth=ok`);
  } catch (err) {
    console.error('[oauth] YouTube callback error:', err);
    res.redirect(`${origin}/?youtube_oauth=error`);
  }
});

// ─── Instagram OAuth (platform linking via Facebook Login) ─────────────────

/** GET /api/auth/instagram — déprécié : utiliser GET /api/platforms/instagram/oauth/url avec JWT en en-tête. */
oauthRouter.get('/instagram', oauthInitLimiter, (_req: Request, res: Response) => {
  const origin = appOrigin();
  res.redirect(`${origin}/?instagram_oauth=error&reason=use_platform_api`);
});

/** GET /api/auth/instagram/callback — handles redirect from Facebook for Instagram linking */oauthRouter.get('/instagram/callback', async (req: Request, res: Response) => {
  const origin = appOrigin();
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    res.redirect(`${origin}/?instagram_oauth=error`);
    return;
  }

  try {
    const result = await completeInstagramOAuth(code, state);
    if (!result) {
      res.redirect(`${origin}/?instagram_oauth=error&reason=no_instagram_account`);
      return;
    }
    const user = db.users.get(result.userId);
    if (user) {
      applyInstagramOAuthToUser(user, result);
      db.users.set(user.id, user);
      schedulePersist();
    }
    res.redirect(`${origin}/?instagram_oauth=ok`);
  } catch (err) {
    console.error('[oauth] Instagram callback error:', err);
    res.redirect(`${origin}/?instagram_oauth=error`);
  }
});

