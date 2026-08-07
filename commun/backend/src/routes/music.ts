import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import {
  addTrackToFavorites,
  isTrackFavorited,
  listFavoriteSourceCompositionIds,
  removeTrackFromFavorites,
  saveTrackToAlbum,
} from '../lib/musicFavorites';
import { buildMusicHome, searchCommunityMusic } from '../lib/musicHome';
import { searchLimiter } from '../lib/abuseRateLimits';

export const musicRouter = Router();

musicRouter.get('/home', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  res.json(buildMusicHome(viewerId));
});

musicRouter.get('/favorites/ids', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  res.json({ compositionIds: listFavoriteSourceCompositionIds(viewerId) });
});

musicRouter.get('/favorites/check/:compositionId', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  const compositionId = req.params.compositionId;
  res.json({ favorited: isTrackFavorited(viewerId, compositionId) });
});

musicRouter.post(
  '/favorites',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const viewerId = (req as Request & { user: { id: string } }).user.id;
    const compositionId = String(req.body?.compositionId ?? '').trim();
    if (!compositionId) {
      res.status(400).json({ error: 'compositionId requis' });
      return;
    }
    const result = addTrackToFavorites(viewerId, compositionId);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(result.alreadySaved ? 200 : 201).json(result);
  })
);

musicRouter.delete('/favorites/:compositionId', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  const result = removeTrackFromFavorites(viewerId, req.params.compositionId);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

/** Ajoute un morceau (référence) dans une playlist/album possédé par l'utilisateur. */
musicRouter.post(
  '/playlists/:albumId/tracks',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const viewerId = (req as Request & { user: { id: string } }).user.id;
    const compositionId = String(req.body?.compositionId ?? '').trim();
    if (!compositionId) {
      res.status(400).json({ error: 'compositionId requis' });
      return;
    }
    const result = saveTrackToAlbum(viewerId, req.params.albumId, compositionId);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(result.alreadySaved ? 200 : 201).json(result);
  })
);

musicRouter.get('/search', authenticateJWT, searchLimiter, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 40) : 20;
  res.json(searchCommunityMusic(viewerId, q, limit));
});
