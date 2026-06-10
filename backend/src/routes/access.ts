import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { publicProfile } from '../lib/profile';
import { schedulePersist } from '../lib/persist';
import {
  createInviteCode,
  deleteInviteCode,
  getAccessPolicy,
  getAccountStatus,
  getPublicAccessConfig,
  isAccessAdmin,
  isAccessControlEnabled,
  listInviteCodes,
  setAccessPolicy,
  setInviteCodeDisabled,
  setUserAccountStatus,
  type AccessRegistrationMode,
  type AccountStatus,
} from '../lib/accessControl';

export const accessRouter = Router();

/** Config publique (écran inscription / connexion). */
accessRouter.get('/config', (_req: Request, res: Response) => {
  res.json(getPublicAccessConfig());
});

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

accessRouter.get('/admin/overview', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const users = [...db.users.values()].filter((u) => !u.email.endsWith('@bot.local'));
  const pending = users.filter((u) => getAccountStatus(u) === 'pending');
  const blocked = users.filter((u) => getAccountStatus(u) === 'blocked');
  res.json({
    policy: getAccessPolicy(),
    config: getPublicAccessConfig(),
    counts: {
      total: users.length,
      active: users.filter((u) => getAccountStatus(u) === 'active').length,
      pending: pending.length,
      blocked: blocked.length,
    },
    inviteCodes: listInviteCodes(),
  });
});

accessRouter.get('/admin/users', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.query.status || 'all') as AccountStatus | 'all';
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const users = [...db.users.values()]
    .filter((u) => !u.email.endsWith('@bot.local'))
    .filter((u) => status === 'all' || getAccountStatus(u) === status)
    .filter(
      (u) =>
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.city?.toLowerCase().includes(q) ?? false)
    )
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      accountStatus: getAccountStatus(u),
      isAdmin: isAccessAdmin(u),
      memberSince: u.memberSince,
      lastSeenAt: u.lastSeenAt,
      profileType: u.profileType,
      city: u.city,
      meloCoins: u.meloCoins,
      listeningRole: u.listeningRole,
      bioPreview: u.bio?.trim().slice(0, 120),
    }))
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  res.json({ users, total: users.length });
});

accessRouter.patch('/admin/policy', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const mode = req.body?.registrationMode as AccessRegistrationMode | undefined;
  const allowed: AccessRegistrationMode[] = ['open', 'invite_only', 'admin_approval', 'closed'];
  if (!mode || !allowed.includes(mode)) {
    res.status(400).json({ error: 'Mode d’inscription invalide' });
    return;
  }
  const policy = setAccessPolicy({ registrationMode: mode });
  schedulePersist();
  res.json({ policy, config: getPublicAccessConfig() });
});

accessRouter.post('/admin/users/:userId/approve', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const user = setUserAccountStatus(req.params.userId, 'active');
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  schedulePersist();
  res.json({ user: publicProfile(user, true, user.id) });
});

accessRouter.post('/admin/users/:userId/block', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const target = db.users.get(req.params.userId);
  if (!target) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (isAccessAdmin(target)) {
    res.status(400).json({ error: 'Impossible de suspendre un administrateur' });
    return;
  }
  const user = setUserAccountStatus(req.params.userId, 'blocked');
  schedulePersist();
  res.json({ user: publicProfile(user!, true, user!.id) });
});

accessRouter.post('/admin/users/:userId/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const user = setUserAccountStatus(req.params.userId, 'active');
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  schedulePersist();
  res.json({ user: publicProfile(user, true, user.id) });
});

accessRouter.post('/admin/invites', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const adminId = (req as Request & { user: { id: string } }).user.id;
  const invite = createInviteCode({
    code: req.body?.code,
    label: req.body?.label,
    maxUses: req.body?.maxUses,
    expiresAt: req.body?.expiresAt,
    createdById: adminId,
  });
  schedulePersist();
  res.status(201).json({ invite });
});

accessRouter.patch('/admin/invites/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const invite = setInviteCodeDisabled(req.params.id, Boolean(req.body?.disabled));
  if (!invite) {
    res.status(404).json({ error: 'Code introuvable' });
    return;
  }
  schedulePersist();
  res.json({ invite });
});

accessRouter.delete('/admin/invites/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!deleteInviteCode(req.params.id)) {
    res.status(404).json({ error: 'Code introuvable' });
    return;
  }
  schedulePersist();
  res.json({ ok: true });
});

/** Vérifie si le contrôle d'accès est actif (admin). */
accessRouter.get('/admin/status', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  res.json({
    accessControlEnabled: isAccessControlEnabled(),
    isAdmin: Boolean(user && isAccessAdmin(user)),
    accountStatus: user ? getAccountStatus(user) : null,
  });
});
