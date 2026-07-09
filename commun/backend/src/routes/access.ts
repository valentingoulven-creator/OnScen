import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db, type User } from '../models/schema';
import { countPersistableProfilePhotos, normalizeProfilePhotos } from '../lib/profile';
import { getFavoriteCount, getFanIds, getFavoriteHostIds, getFollowingCount } from '../lib/favorites';
import { getUserStats } from '../lib/profile';
import { isPrivateReel } from '../lib/reels';
import { schedulePersist } from '../lib/persist';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import {
  blockUserAccount,
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
  setUserIsAdmin,
  type AccessRegistrationMode,
  type AccountStatus,
} from '../lib/accessControl';
import {
  getActiveSubscription,
  getTierById,
  PLATFORM_CREATOR_ID,
  recordCreatorSubscription,
} from '../lib/subscriptions';
import { getPlatformPlanStatus, getUserPlatformPlan } from '../lib/platformPlans';
import { logAdminAction } from '../lib/adminAuditLog';

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

accessRouter.get('/admin/overview', authenticateJWT, async (req: Request, res: Response) => {
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

type AdminUserSort = 'lastSeen' | 'memberSince' | 'username' | 'status';

const STATUS_SORT_ORDER: Record<AccountStatus, number> = {
  pending: 0,
  active: 1,
  blocked: 2,
};

/** Snapshot admin : contourne les masquages publicProfile (données privées incluses). */
function mapAdminManagedUser(u: User) {
  const photos = normalizeProfilePhotos(u);
  const reels = db.userReels.filter((r) => r.authorId === u.id);
  const platformPlan = getUserPlatformPlan(u.id);
  const stats = getUserStats(u.id);
  const totalLivesHosted = [...db.lives.values()].filter((l) => l.hostId === u.id).length;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    accountStatus: getAccountStatus(u),
    isAdmin: isAccessAdmin(u),
    adminFlag: u.isAdmin === true,
    memberSince: u.memberSince,
    lastSeenAt: u.lastSeenAt,
    profileType: u.profileType,
    city: u.city,
    meloCoins: u.meloCoins,
    listeningRole: u.listeningRole,
    bio: u.bio,
    bioPreview: u.bio?.trim().slice(0, 120),
    followersCount: u.favoritesCountOverride ?? getFavoriteCount(u.id),
    followingCount: getFollowingCount(u.id),
    photosCount: countPersistableProfilePhotos(photos),
    birthDate: u.birthDate,
    age: u.age,
    hideBirthDateOnProfile: u.hideBirthDateOnProfile,
    showAge: u.showAge,
    relationshipStatus: u.relationshipStatus,
    relationshipStatusCustom: u.relationshipStatusCustom,
    isGhostMode: u.isGhostMode,
    shareDistance: u.shareDistance,
    locationPrecision: u.locationPrecision,
    privateReelsCount: reels.filter((r) => isPrivateReel(r)).length,
    publicReelsCount: reels.filter((r) => !isPrivateReel(r)).length,
    instagramHandle: u.instagramHandle,
    platformPlanId: platformPlan.id,
    platformPlanLabel: platformPlan.label,
    salonsHosted: stats.salonsHosted,
    activeLivesHosted: stats.livesHosted,
    totalLivesHosted,
    blockedUntil: u.blockedUntil,
    blockedReason: u.blockedReason,
    blockedAt: u.blockedAt,
    emailVerified: u.emailVerified === true,
    stripeConnectReady: Boolean(u.stripeConnectAccountId?.trim()),
    connectedPlatformsCount: u.connectedPlatforms?.length ?? 0,
    onboardingCompleted: u.onboardingCompleted !== false,
  };
}

function sortAdminUsers<T extends { username: string; memberSince?: number; lastSeenAt: number; accountStatus: AccountStatus }>(
  users: T[],
  sort: AdminUserSort
): T[] {
  const list = [...users];
  switch (sort) {
    case 'username':
      return list.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
    case 'memberSince':
      return list.sort((a, b) => (b.memberSince ?? 0) - (a.memberSince ?? 0));
    case 'status':
      return list.sort(
        (a, b) =>
          STATUS_SORT_ORDER[a.accountStatus] - STATUS_SORT_ORDER[b.accountStatus] ||
          a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })
      );
    default:
      return list.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  }
}

accessRouter.get('/admin/users', authenticateJWT, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.query.status || 'all') as AccountStatus | 'all';
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const sort = String(req.query.sort || 'lastSeen') as AdminUserSort;
  const allowedSort: AdminUserSort[] = ['lastSeen', 'memberSince', 'username', 'status'];
  const sortKey = allowedSort.includes(sort) ? sort : 'lastSeen';
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  const realUsers = [...db.users.values()].filter((u) => !u.email.endsWith('@bot.local'));
  const counts = {
    total: realUsers.length,
    active: realUsers.filter((u) => getAccountStatus(u) === 'active').length,
    pending: realUsers.filter((u) => getAccountStatus(u) === 'pending').length,
    blocked: realUsers.filter((u) => getAccountStatus(u) === 'blocked').length,
  };

  const filtered = sortAdminUsers(
    realUsers
      .filter((u) => status === 'all' || getAccountStatus(u) === status)
      .filter(
        (u) =>
          !q ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.city?.toLowerCase().includes(q) ?? false)
      )
      .map(mapAdminManagedUser),
    sortKey
  );

  res.json({
    users: filtered.slice(offset, offset + limit),
    total: filtered.length,
    counts,
    limit,
    offset,
    hasMore: offset + limit < filtered.length,
  });
});

accessRouter.get('/admin/users/:userId', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const user = db.users.get(req.params.userId);
  if (!user || user.email.endsWith('@bot.local')) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ user: mapAdminManagedUser(user) });
});

accessRouter.get('/admin/users/:userId/social', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const userId = req.params.userId;
  const user = db.users.get(userId);
  if (!user || user.email.endsWith('@bot.local')) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '40'), 10) || 40, 1), 100);
  const mapBrief = (id: string) => {
    const u = db.users.get(id);
    if (!u || u.email.endsWith('@bot.local')) return null;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      accountStatus: getAccountStatus(u),
    };
  };
  const followerIds = getFanIds(userId);
  const followingIds = getFavoriteHostIds(userId);
  res.json({
    followers: followerIds.slice(0, limit).map(mapBrief).filter(Boolean),
    following: followingIds.slice(0, limit).map(mapBrief).filter(Boolean),
    followersTotal: followerIds.length,
    followingTotal: followingIds.length,
  });
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
  schedulePersistUserToPg(user);
  schedulePersist();
  logAdminAction({
    adminId: (req as Request & { user: { id: string } }).user.id,
    action: 'user_approve',
    targetType: 'user',
    targetId: user.id,
    ip: req.ip,
  });
  res.json({ user: mapAdminManagedUser(user) });
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
  const rawDays = req.body?.days;
  const days =
    rawDays === null || rawDays === undefined || rawDays === ''
      ? null
      : Math.min(Math.max(Number(rawDays) || 0, 0), 365);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  const user = blockUserAccount(req.params.userId, { days, reason });
  schedulePersistUserToPg(user!);
  schedulePersist();
  logAdminAction({
    adminId: (req as Request & { user: { id: string } }).user.id,
    action: 'user_block',
    targetType: 'user',
    targetId: user!.id,
    details: { days, reason },
    ip: req.ip,
  });
  res.json({ user: mapAdminManagedUser(user!) });
});

accessRouter.post('/admin/users/:userId/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const user = setUserAccountStatus(req.params.userId, 'active');
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  schedulePersistUserToPg(user);
  schedulePersist();
  logAdminAction({
    adminId: (req as Request & { user: { id: string } }).user.id,
    action: 'user_unblock',
    targetType: 'user',
    targetId: user.id,
    ip: req.ip,
  });
  res.json({ user: mapAdminManagedUser(user) });
});

accessRouter.post('/admin/users/:userId/promote', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const result = setUserIsAdmin(req.params.userId, true);
  if ('error' in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  schedulePersistUserToPg(result);
  schedulePersist();
  logAdminAction({
    adminId: (req as Request & { user: { id: string } }).user.id,
    action: 'user_promote_admin',
    targetType: 'user',
    targetId: result.id,
    ip: req.ip,
  });
  res.json({ user: mapAdminManagedUser(result) });
});

accessRouter.post('/admin/users/:userId/demote', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const result = setUserIsAdmin(req.params.userId, false);
  if ('error' in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  schedulePersistUserToPg(result);
  schedulePersist();
  logAdminAction({
    adminId: (req as Request & { user: { id: string } }).user.id,
    action: 'user_demote_admin',
    targetType: 'user',
    targetId: result.id,
    ip: req.ip,
  });
  res.json({ user: mapAdminManagedUser(result) });
});

/** Attribution manuelle du forfait plateforme (Gratuit / Soundy+ / SoundyUltra). */
accessRouter.post('/admin/users/:userId/platform-plan', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const userId = req.params.userId;
  const user = db.users.get(userId);
  if (!user || user.email.endsWith('@bot.local')) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const planId = String(req.body?.planId ?? req.body?.tierId ?? '').trim();
  if (!['free', 'soundy_plus', 'soundy_ultra'].includes(planId)) {
    res.status(400).json({ error: 'Forfait invalide (free, soundy_plus, soundy_ultra)' });
    return;
  }

  const active = getActiveSubscription(userId, PLATFORM_CREATOR_ID);
  if (active) {
    active.status = 'canceled';
    active.updatedAt = Date.now();
  }

  if (planId !== 'free') {
    const tier = getTierById(planId, 'platform');
    if (!tier) {
      res.status(400).json({ error: 'Palier plateforme inconnu' });
      return;
    }
    recordCreatorSubscription({
      subscriberId: userId,
      creatorId: PLATFORM_CREATOR_ID,
      tierId: tier.id,
      tierLabel: tier.label,
      amountCents: tier.amountCents,
      targetType: 'platform',
      paymentMode: 'simulation',
    });
  }

  schedulePersist();
  res.json({ ok: true, status: getPlatformPlanStatus(userId) });
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
