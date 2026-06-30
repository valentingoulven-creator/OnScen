import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models/schema';
import { canUserUseApp } from '../lib/accessControl';
import { getJwtSecret, isDeployedEnv, JWT_VERIFY_OPTIONS, JWT_SIGN_OPTIONS } from '../lib/jwtSecret';
import { getUserTokenVersion, bumpUserTokenVersion } from '../lib/tokenVersion';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import type { User } from '../models/schema';

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  id: string;
  username: string;
  /** JWT session version — must match user.tokenVersion in DB. */
  tv?: number;
  /** Restricted scopes (e.g. 2fa_pending) must not access protected routes. */
  scope?: string;
}

/** Full session tokens omit scope or use `full`. Any other scope is restricted. */
export function isRestrictedJwtScope(scope: string | undefined): boolean {
  return scope !== undefined && scope !== 'full';
}

/** Password registration requires verified email; OAuth may leave field undefined. */
export function isEmailVerificationBlocking(user: User | undefined): boolean {
  return user?.emailVerified === false;
}

function assertFullSession(decoded: AuthPayload): boolean {
  return !isRestrictedJwtScope(decoded.scope);
}

/** Header JWT dédié — évite d'écraser Authorization: Basic (Caddy) côté navigateur. */
export const AUTH_TOKEN_HEADER = 'x-auth-token';

/**
 * Cookie name for httpOnly JWT.
 * Web browsers send this automatically; Capacitor native clients fall back to the header.
 *
 * CSRF protection: SameSite=Strict is sufficient — the cookie is never sent on cross-site
 * requests (forms, XHR, fetch from other origins), eliminating CSRF attacks without needing
 * a separate CSRF token. Reviewed 2026-06-21.
 */
export const AUTH_COOKIE_NAME = 'soundy_auth';

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: isDeployedEnv(),
  sameSite: 'strict' as const,
  path: '/',
};

/** Sets the JWT as an httpOnly Secure SameSite=Strict cookie. */
export function setAuthCookie(res: Response, token: string, rememberMe: boolean): void {
  const maxAge = rememberMe
    ? 7 * 24 * 60 * 60 * 1000   // 7 days in ms
    : undefined;                  // session cookie (no Max-Age)
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...COOKIE_BASE_OPTIONS,
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
}

/** Clears the JWT cookie (logout). */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, COOKIE_BASE_OPTIONS);
}

// ─── Token extraction ────────────────────────────────────────────────────────

function extractCookieToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

/**
 * Extracts a bearer token from request headers.
 * Checks X-Auth-Token first (avoids clobbering Caddy's Basic Auth), then Authorization: Bearer.
 */
function extractHeaderToken(req: Request): string | null {
  const fromHeader = req.headers[AUTH_TOKEN_HEADER];
  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return null;
}

/**
 * Extracts a JWT from the request: cookie first (web), then header (API clients / mobile).
 * This allows seamless support for both cookie-based web sessions and token-header mobile clients.
 */
function extractToken(req: Request): string | null {
  return extractCookieToken(req) ?? extractHeaderToken(req);
}

function tokenVersionMatches(user: User | undefined, decoded: AuthPayload): boolean {
  if (!user) return false;
  const expected = getUserTokenVersion(user);
  const tokenTv = decoded.tv ?? 0;
  return tokenTv === expected;
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as AuthPayload;
    if (!assertFullSession(decoded)) {
      res.status(401).json({ error: 'Authentification incomplète — reconnectez-vous' });
      return;
    }
    const user = db.users.get(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'Token invalide ou expiré' });
      return;
    }
    if (!tokenVersionMatches(user, decoded)) {
      res.status(401).json({ error: 'Session expirée — reconnectez-vous' });
      return;
    }
    if (!canUserUseApp(user)) {
      const status = user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending';
      const message =
        status === 'account_blocked'
          ? "Compte suspendu. Contactez l'administrateur."
          : 'Compte en attente de validation par un administrateur.';
      res.status(403).json({ error: message, code: status });
      return;
    }
    if (isEmailVerificationBlocking(user)) {
      res.status(403).json({
        error:
          "Votre adresse e-mail n'est pas encore vérifiée. Consultez vos e-mails ou demandez un nouveau lien.",
        code: 'email_not_verified',
        email: user.email,
      });
      return;
    }
    (req as Request & { user: AuthPayload; authToken?: string }).user = decoded;
    (req as Request & { authToken?: string }).authToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export const JWT_REMEMBER_EXPIRY = '7d';
export const JWT_SESSION_EXPIRY = '24h';

export function signToken(payload: AuthPayload, rememberMe = true): string {
  const tv = payload.tv ?? 0;
  return jwt.sign({ ...payload, tv }, JWT_SECRET, {
    ...JWT_SIGN_OPTIONS,
    expiresIn: rememberMe ? JWT_REMEMBER_EXPIRY : JWT_SESSION_EXPIRY,
  });
}

/** Signs a JWT including the user's current tokenVersion. */
export function signTokenForUser(user: User, rememberMe = true): string {
  return signToken(
    { id: user.id, username: user.username, tv: getUserTokenVersion(user) },
    rememberMe
  );
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as AuthPayload;
    if (!assertFullSession(decoded)) return null;
    const user = db.users.get(decoded.id);
    if (!user || !tokenVersionMatches(user, decoded)) return null;
    if (isEmailVerificationBlocking(user)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Invalide tous les JWT émis avant (logout, révocation session). */
export function revokeSessionForToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as AuthPayload;
    if (!assertFullSession(decoded)) return false;
    const user = db.users.get(decoded.id);
    if (!user) return false;
    bumpUserTokenVersion(user);
    db.users.set(user.id, user);
    schedulePersistUserToPg(user);
    return true;
  } catch {
    return false;
  }
}

function extractTokenFromRequest(req: Request): string | null {
  return extractToken(req);
}

/** Logout helper — extrait le token cookie ou header et révoque la session. */
export function revokeSessionFromRequest(req: Request): void {
  const token = extractTokenFromRequest(req);
  if (token) revokeSessionForToken(token);
}

/**
 * Extracts a JWT for socket.io handshake authentication.
 * Priority: auth.token → X-Auth-Token header → soundy_auth cookie.
 * Cookie parsing is manual because socket.io handshake has raw HTTP headers (no cookie-parser).
 */
export function extractSocketAuthToken(handshake: {
  auth?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  // 1. Explicit auth payload (mobile / API clients pass token here)
  const fromAuth = handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();

  // 2. X-Auth-Token header (mobile / API clients)
  const header = handshake.headers?.[AUTH_TOKEN_HEADER] ?? handshake.headers?.['x-auth-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  // 3. httpOnly cookie (web browsers — sent automatically on same-site requests)
  const cookieHeader = handshake.headers?.['cookie'];
  if (typeof cookieHeader === 'string') {
    const match = cookieHeader
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (match) {
      const value = match.slice(AUTH_COOKIE_NAME.length + 1).trim();
      if (value) return value;
    }
  }

  return null;
}
