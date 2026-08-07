import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { globalSearch } from '../lib/globalSearch';
import { searchLimiter } from '../lib/abuseRateLimits';

export const searchRouter = Router();

/** Longueur max de la requête de recherche — évite les payloads abusifs (DoS léger). */
const SEARCH_QUERY_MAX_LENGTH = 100;

searchRouter.get('/', authenticateJWT, searchLimiter, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const q = String(req.query.q ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH);
  res.json(globalSearch(me, q));
});
