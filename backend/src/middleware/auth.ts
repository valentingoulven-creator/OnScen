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

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
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
