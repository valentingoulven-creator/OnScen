import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../models/schema';
import { canUserUseApp } from '../lib/accessControl';

const _envSecret = process.env.JWT_SECRET;
if (!_envSecret) {
  if (process.env.APP_ENV === 'production') {
    throw new Error('[auth] JWT_SECRET must be set in production — refusing to start with default key.');
  }
  console.warn('[auth] ⚠ JWT_SECRET not set — using insecure development default. Set JWT_SECRET in .env before deploying to production.');
}
const JWT_SECRET = _envSecret || 'melosong_secret_dev_fallback';

export interface AuthPayload {
  id: string;
  username: string;
}

/** Header JWT dédié — évite d'écraser Authorization: Basic (Caddy) côté navigateur. */
export const AUTH_TOKEN_HEADER = 'x-auth-token';

function extractBearerToken(req: Request): string | null {
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

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
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
          ? 'Compte suspendu. Contactez l’administrateur.'
          : 'Compte en attente de validation par un administrateur.';
      res.status(403).json({ error: message, code: status });
      return;
    }
    (req as Request & { user: AuthPayload }).user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Token invalide' });
  }
}

export const JWT_REMEMBER_EXPIRY = '30d';
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

export function extractSocketAuthToken(handshake: {
  auth?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const fromAuth = handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();
  const header = handshake.headers?.[AUTH_TOKEN_HEADER] ?? handshake.headers?.['x-auth-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return null;
}
