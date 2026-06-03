import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { followUser, unfollowUser, getFollowingIds, isFollowing } from '../lib/follows';
import { publicProfile } from '../lib/profile';
import { applyPrivacySettings } from '../lib/locationPrivacy';
import { schedulePersist } from '../lib/persist';

export const usersRouter = Router();

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
