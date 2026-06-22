import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { buildMusicHome } from '../lib/musicHome';
import { DEFAULT_NEARBY_RADIUS_KM } from '../lib/geoLimits';

const DEFAULT_LAT = 48.8566;
const DEFAULT_LON = 2.3522;

export const musicRouter = Router();

function parseCoord(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

musicRouter.get('/home', authenticateJWT, (req: Request, res: Response) => {
  const viewerId = (req as Request & { user: { id: string } }).user.id;
  const lat = parseCoord(req.query.latitude ?? req.query.lat) ?? DEFAULT_LAT;
  const lon = parseCoord(req.query.longitude ?? req.query.lng) ?? DEFAULT_LON;
  const radius = parseCoord(req.query.radiusKm ?? req.query.radius) ?? DEFAULT_NEARBY_RADIUS_KM;
  const geoLabel =
    typeof req.query.label === 'string' && req.query.label.trim()
      ? req.query.label.trim()
      : 'Autour de toi';

  res.json(buildMusicHome(viewerId, lat, lon, radius, geoLabel));
});
