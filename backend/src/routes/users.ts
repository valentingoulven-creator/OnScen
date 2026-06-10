import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { followUser, unfollowUser, getFollowingIds, isFollowing } from '../lib/follows';
import { notifyFollowReceived } from '../lib/notifications';
import {
  addFavorite,
  removeFavorite,
  isFavorite,
  getFavoriteHostIds,
  setFavoriteNotifications,
  getFavoriteEntry,
} from '../lib/favorites';
import { getActiveSalonForHost, publicProfile } from '../lib/profile';
import { invalidateProfileCache } from './auth';
import {
  getActiveLiveIdForHost,
  getLiveViewersCountForHost,
  isUserHostingLive,
} from '../lib/liveStatus';
import { applyPrivacySettings } from '../lib/locationPrivacy';
import { schedulePersist } from '../lib/persist';

export const usersRouter = Router();

function normalizeSearchQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function searchRank(username: string, q: string): number {
  const name = normalizeSearchQuery(username);
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  return 99;
}

usersRouter.get('/search', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const q = normalizeSearchQuery(String(req.query.q ?? ''));
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const hits = [...db.users.values()]
    .filter((u) => u.id !== me && !u.isGhostMode)
    .filter((u) => normalizeSearchQuery(u.username).includes(q))
    .sort((a, b) => {
      const ra = searchRank(a.username, q);
      const rb = searchRank(b.username, q);
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username, 'fr');
    })
    .slice(0, 20)
    .map((u) => {
      const salon = getActiveSalonForHost(u.id);
      const live = isUserHostingLive(u.id);
      return {
        id: u.id,
        username: u.username,
        usernameColor: u.usernameColor,
        usernameWaveFrom: u.usernameWaveFrom,
        usernameWaveTo: u.usernameWaveTo,
        avatarUrl: u.avatarUrl,
        city: u.city || undefined,
        listeningRole: u.listeningRole,
        isLive: live,
        liveId: live ? getActiveLiveIdForHost(u.id) : undefined,
        liveViewersCount: live ? getLiveViewersCountForHost(u.id) : undefined,
        salonId: salon?.id,
        salonTitle: salon?.title || salon?.playbackState?.title || undefined,
      };
    });

  res.json({ users: hits });
});

usersRouter.patch('/me/settings', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(me);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { shareDistance, locationPrecision } = req.body;
  applyPrivacySettings(user, { shareDistance, locationPrecision });
  db.users.set(me, user);
  schedulePersist();
  res.json({ user: publicProfile(user, true, me) });
});

usersRouter.post('/:id/follow', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const targetId = req.params.id;

  if (targetId === me) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous suivre vous-même' });
    return;
  }

  const target = db.users.get(targetId);
  if (!target) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (isFollowing(me, targetId)) {
    res.status(400).json({ error: 'Vous suivez déjà cet artiste' });
    return;
  }

  followUser(me, targetId);

  invalidateProfileCache(me);
  invalidateProfileCache(targetId);

  const sender = db.users.get(me);
  if (sender) {
    notifyFollowReceived({
      recipientId: targetId,
      sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
    });
  }

  res.status(201).json({ ok: true, followingId: targetId, isFollowing: true });
});

usersRouter.delete('/:id/follow', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const targetId = req.params.id;

  if (!isFollowing(me, targetId)) {
    res.status(400).json({ error: 'Vous ne suivez pas cet artiste' });
    return;
  }

  unfollowUser(me, targetId);
  invalidateProfileCache(me);
  invalidateProfileCache(targetId);
  res.json({ ok: true, followingId: targetId, isFollowing: false });
});

usersRouter.get('/me/following', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const ids = getFollowingIds(me);
  const users = ids
    .map((id) => db.users.get(id))
    .filter(Boolean)
    .map((u) => publicProfile(u!, false, me));
  res.json({ following: users, followingIds: ids });
});

usersRouter.get('/:id/following-status', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const targetId = req.params.id;
  res.json({ isFollowing: isFollowing(me, targetId) });
});

/* ── Favoris ───────────────────────────────────────────────────── */

usersRouter.post('/:id/favorite', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const hostId = req.params.id;

  if (hostId === me) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous mettre en favoris' });
    return;
  }
  if (!db.users.has(hostId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (isFavorite(me, hostId)) {
    res.status(400).json({ error: 'Déjà dans vos favoris' });
    return;
  }

  const entry = addFavorite(me, hostId);
  res.status(201).json({ ok: true, hostId, isFavorite: true, notificationsEnabled: entry.notificationsEnabled });
});

usersRouter.delete('/:id/favorite', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const hostId = req.params.id;

  if (!isFavorite(me, hostId)) {
    res.status(400).json({ error: 'Pas dans vos favoris' });
    return;
  }

  removeFavorite(me, hostId);
  res.json({ ok: true, hostId, isFavorite: false });
});

usersRouter.get('/me/favorites', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const hostIds = getFavoriteHostIds(me);
  const users = hostIds
    .map((id) => {
      const u = db.users.get(id);
      if (!u) return null;
      const entry = getFavoriteEntry(me, id);
      return {
        ...publicProfile(u, false, me),
        notificationsEnabled: entry?.notificationsEnabled ?? true,
      };
    })
    .filter(Boolean);
  res.json({ favorites: users });
});

usersRouter.get('/:id/favorite-status', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const hostId = req.params.id;
  const entry = getFavoriteEntry(me, hostId);
  res.json({
    isFavorite: !!entry,
    notificationsEnabled: entry?.notificationsEnabled ?? true,
  });
});

usersRouter.patch('/:id/favorite/notifications', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const hostId = req.params.id;

  if (!isFavorite(me, hostId)) {
    res.status(400).json({ error: 'Pas dans vos favoris' });
    return;
  }

  const { notificationsEnabled } = req.body;
  if (typeof notificationsEnabled !== 'boolean') {
    res.status(400).json({ error: 'notificationsEnabled (boolean) requis' });
    return;
  }

  setFavoriteNotifications(me, hostId, notificationsEnabled);
  res.json({ ok: true, hostId, notificationsEnabled });
});
