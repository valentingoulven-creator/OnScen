import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { globalSearch } from '../lib/globalSearch';

export const searchRouter = Router();

searchRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const q = String(req.query.q ?? '');
  res.json(globalSearch(me, q));
});
