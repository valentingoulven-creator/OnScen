import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { buildTrendingUsers, type TrendingUser } from '../lib/trendingUsers';

export type { TrendingUser };

interface CacheEntry {
  data: { users: TrendingUser[] };
  expiresAt: number;
}

const cacheByKey = new Map<string, CacheEntry>();

function cacheKey(country?: string): string {
  const code = country?.trim().toUpperCase();
  return code && code.length === 2 ? code : '__all__';
}

export const trendingRouter = Router();

trendingRouter.get('/users', authenticateJWT, (req: Request, res: Response) => {
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const key = cacheKey(country);
  const cached = cacheByKey.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(cached.data);
    return;
  }
  const data = { users: buildTrendingUsers(country) };
  cacheByKey.set(key, { data, expiresAt: Date.now() + 60_000 });
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(data);
});
