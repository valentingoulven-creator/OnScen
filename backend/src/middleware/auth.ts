import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models/schema';
import { canUserUseApp } from '../lib/accessControl';
import { getJwtSecret, isProductionEnv } from '../lib/jwtSecret';

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  id: string;
  username: string;
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
  secure: isProductionEnv(),
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

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const user = db.users.get(decoded.id);
    if (user && !canUserUseApp(user)) {
      const status = user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending';
      const message =
        status === 'account_blocked'
          ? "Compte suspendu. Contactez l'administrateur."
          : 'Compte en attente de validation par un administrateur.';
      res.status(403).json({ error: message, code: status });
      return;
    }
    (req as Request & { user: AuthPayload }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export const JWT_REMEMBER_EXPIRY = '7d';
export const JWT_SESSION_EXPIRY = '24h';

export function signToken(payload: AuthPayload, rememberMe = true): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: rememberMe ? JWT_REMEMBER_EXPIRY : JWT_SESSION_EXPIRY,
  });
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
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
