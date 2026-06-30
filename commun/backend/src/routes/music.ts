import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { buildMusicHome, searchCommunityMusic } from '../lib/musicHome';

export const musicRouter = Router();

musicRouter.get('/home', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  res.json(buildMusicHome(viewerId));
});

musicRouter.get('/search', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 40) : 20;
  res.json(searchCommunityMusic(viewerId, q, limit));
});
