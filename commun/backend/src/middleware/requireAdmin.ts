import { Request, Response } from 'express';
import { db } from '../models/schema';
import { isDevStaff, isOperationalAdmin } from '../lib/accessControl';

/** Returns staff user id or sends 401/403 and returns null (Admin + Dev). */
export function requireAdmin(req: Request, res: Response): string | null {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return null;
  }
  const user = db.users.get(userId);
  if (!user || !isOperationalAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return null;
  }
  return userId;
}

/** Returns Dev staff user id or sends 401/403 and returns null (Dev uniquement). */
export function requireDevStaff(req: Request, res: Response): string | null {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return null;
  }
  const user = db.users.get(userId);
  if (!user || !isDevStaff(user)) {
    res.status(403).json({ error: 'Accès réservé aux comptes Dev' });
    return null;
  }
  return userId;
}
