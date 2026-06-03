import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getDistanceKm } from '../lib/geo';
import { refreshUserPublicCoords } from '../lib/locationPrivacy';
import { publicSalon } from './salons';
import { isSalonVisibleOnMap } from '../lib/salonAccess';
import { ensureMapBots, isLocalDevEnvironment } from '../seed-bots';
import { getNearbyPeople } from '../lib/nearbyPeople';
import { getPublicMapCoords } from '../lib/locationPrivacy';

export const geoRouter = Router();

geoRouter.post('/update', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { latitude, longitude } = req.body;
  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Coordonnées requises' });
    return;
  }
  user.latitude = latitude;
  user.longitude = longitude;
  refreshUserPublicCoords(user);
  user.lastSeenAt = Date.now();
  db.users.set(userId, user);
  res.json({
    blurredLatitude: user.blurredLatitude,
    blurredLongitude: user.blurredLongitude,
  });
});

geoRouter.get('/nearby', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const lat = parseFloat(req.query.latitude as string);
  const lon = parseFloat(req.query.longitude as string);
  const radiusKm = parseFloat((req.query.radius as string) || '10');
  const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 10;

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: 'latitude et longitude requis' });
    return;
  }

  if (isLocalDevEnvironment()) {
    ensureMapBots(lat, lon);
  }

  const salons = [...db.salons.values()]
    .filter((s) => isSalonVisibleOnMap(s, me))
    .filter((s) => {
      const host = db.users.get(s.hostId);
      const coords =
        host != null
          ? getPublicMapCoords(host, s.latitude, s.longitude, s.blurredLatitude, s.blurredLongitude, me)
          : { latitude: s.blurredLatitude, longitude: s.blurredLongitude };
      return getDistanceKm(lat, lon, coords.latitude, coords.longitude) <= safeRadiusKm;
    })
    .map((s) => publicSalon(s, me));

  const lives = [...db.lives.values()]
    .filter((l) => l.isActive)
    .flatMap((l) => {
      const host = db.users.get(l.hostId);
      const coords =
        host != null
          ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, me)
          : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
      if (getDistanceKm(lat, lon, coords.latitude, coords.longitude) > safeRadiusKm) return [];
      return [{
        id: l.id,
        hostName: l.hostName,
        title: l.title,
        platform: l.platform,
        playbackState: l.playbackState,
        latitude: coords.latitude,
        longitude: coords.longitude,
        viewersCount: l.viewersCount,
        isActive: true,
      }];
    });

  const people = getNearbyPeople(me, lat, lon, radiusKm);

  res.json({ salons, lives, people });
});
