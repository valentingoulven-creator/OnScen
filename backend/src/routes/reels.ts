import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getIo } from '../lib/ioInstance';
import { notifyContentHeartReceived } from '../lib/notifications';
import {
  isValidReelId,
  toggleReelHeart,
  getReelComments,
  addReelComment,
  recordReelShare,
  recordReelView,
  publicReelComment,
  reelStats,
  listUserCreatedReels,
  listReelsByAuthor,
  listPrivateReelsByAuthor,
  listAccessiblePrivateReelsByAuthor,
  buildReelsFeed,
  createUserReel,
  deleteUserReel,
  publishUserReel,
  getAccessibleUserReel,
  publicUserReel,
  isUserOwnedReel,
} from '../lib/reels';
import { parseFeedAlgoQuery } from '../lib/reelFeedRanking';

export const reelsRouter = Router();

function requireReel(reelId: string, res: Response): boolean {
  if (!isValidReelId(reelId)) {
    res.status(404).json({ error: 'Reel introuvable' });
    return false;
  }
  return true;
}

reelsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const algoPrefs = parseFeedAlgoQuery(req.query as Record<string, unknown>);
  res.json({ reels: buildReelsFeed(me, algoPrefs ?? undefined) });
});

reelsRouter.get('/private/me', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ reels: listPrivateReelsByAuthor(me) });
});

reelsRouter.get('/user/:userId', authenticateJWT, (req: Request, res: Response) => {
  const userId = req.params.userId;
  const me = (req as Request & { user: { id: string } }).user.id;
  if (!db.users.has(userId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ reels: listReelsByAuthor(userId, me) });
});

reelsRouter.get('/user/:userId/private', authenticateJWT, (req: Request, res: Response) => {
  const userId = req.params.userId;
  const me = (req as Request & { user: { id: string } }).user.id;
  if (!db.users.has(userId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const result = listAccessiblePrivateReelsByAuthor(userId, me);
  if ('error' in result) {
    res.status(403).json({
      error: 'Vous devez vous suivre mutuellement pour voir les reels privés',
      code: 'reels_mutual_follow_required',
    });
    return;
  }
  res.json({ reels: result });
});

reelsRouter.get('/user-created', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ reels: listUserCreatedReels(me) });
});

reelsRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const mediaType = body.mediaType === 'image' ? 'image' : 'video';
  const rawDuration = body.durationSec;
  const durationSec =
    typeof rawDuration === 'number' && Number.isFinite(rawDuration) ? rawDuration : undefined;

  const rawVisibility = body.visibility ?? body.isPrivate;
  const visibility =
    rawVisibility === 'private' || rawVisibility === true
      ? 'private'
      : rawVisibility === 'public' || rawVisibility === false
        ? 'public'
        : undefined;

  const result = createUserReel(me, {
    title: String(body.title ?? ''),
    artist: String(body.artist ?? ''),
    genre: String(body.genre ?? ''),
    mediaType,
    mediaUrl: String(body.mediaUrl ?? ''),
    posterUrl: body.posterUrl != null ? String(body.posterUrl) : undefined,
    durationSec,
    visibility,
  });
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ reel: publicUserReel(result) });
});

reelsRouter.post('/:reelId/publish', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  const me = (req as Request & { user: { id: string } }).user.id;
  if (!isUserOwnedReel(reelId)) {
    res.status(404).json({ error: 'Reel introuvable' });
    return;
  }
  const result = publishUserReel(reelId, me);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ reel: publicUserReel(result) });
});

reelsRouter.get('/:reelId', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  const me = (req as Request & { user: { id: string } }).user.id;
  const reel = getAccessibleUserReel(reelId, me);
  if (!reel) {
    res.status(404).json({ error: 'Reel introuvable' });
    return;
  }
  res.json({ reel });
});

reelsRouter.delete('/:reelId', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  const me = (req as Request & { user: { id: string } }).user.id;
  if (!isUserOwnedReel(reelId)) {
    res.status(404).json({ error: 'Reel introuvable ou non supprimable' });
    return;
  }
  if (!deleteUserReel(reelId, me)) {
    res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres reels' });
    return;
  }
  res.json({ ok: true });
});

reelsRouter.get('/:reelId/stats', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ stats: reelStats(reelId, me) });
});

reelsRouter.post('/:reelId/heart', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleReelHeart(reelId, me);
  if (result.liked) {
    const reel = db.userReels.find((r) => r.id === reelId);
    const sender = db.users.get(me);
    if (reel && sender) {
      notifyContentHeartReceived({
        recipientId: reel.authorId,
        sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
        target: { kind: 'reel', id: reelId },
      });
    }
  }
  res.json(result);
});

reelsRouter.get('/:reelId/comments', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const comments = getReelComments(reelId)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(publicReelComment);
  res.json({ comments });
});

reelsRouter.post('/:reelId/comments', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const me = (req as Request & { user: { id: string } }).user;
  const user = db.users.get(me.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const content = String(req.body?.content ?? '').trim();
  if (!content) {
    res.status(400).json({ error: 'Commentaire vide' });
    return;
  }
  if (content.length > 500) {
    res.status(400).json({ error: 'Commentaire trop long' });
    return;
  }
  const comment = addReelComment(reelId, user.id, user.username, user.avatarUrl, content);
  const payload = publicReelComment(comment);
  getIo()?.to(`reel_${reelId}`).emit('reel_comment', payload);
  res.status(201).json({ comment: payload, commentCount: getReelComments(reelId).length });
});

reelsRouter.post('/:reelId/share', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = recordReelShare(reelId, me);
  res.json({ ok: true, shareCount: result.shareCount, alreadyShared: result.alreadyShared });
});

reelsRouter.post('/:reelId/view', authenticateJWT, (req: Request, res: Response) => {
  const reelId = req.params.reelId;
  if (!requireReel(reelId, res)) return;
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = recordReelView(reelId, me);
  res.json({ ok: true, viewCount: result.viewCount, alreadyViewed: result.alreadyViewed });
});
