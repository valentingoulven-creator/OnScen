import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getDistanceKm } from '../lib/geo';
import { refreshUserPublicCoords } from '../lib/locationPrivacy';
import { publicSalon } from './salons';
import { isSalonVisibleOnMap } from '../lib/salonAccess';
import { ensureMapBotsForNearby, isLocalDevEnvironment } from '../seed-bots';
import { getNearbyPeople } from '../lib/nearbyPeople';
import { getPublicMapCoords } from '../lib/locationPrivacy';
import {
  DEFAULT_NEARBY_RADIUS_KM,
  parseDistanceFilterQuery,
  resolveGeoNearbyLimits,
  resolveNearbyRadiusKm,
} from '../lib/geoLimits';
import { isValidLatLng } from '../lib/mapCoords';

export const geoRouter = Router();

/** Per-user debounce: ignore geo/update calls more frequent than 4 seconds. */
const geoDebounce = new Map<string, number>();
const GEO_DEBOUNCE_MS = 4_000;

/** Evict stale debounce entries to prevent the map growing without bound. */
let lastGeoCleanup = 0;
function maybeCleanGeoDebounce(now: number): void {
  if (now - lastGeoCleanup < 60_000) return;
  lastGeoCleanup = now;
  const staleThreshold = now - GEO_DEBOUNCE_MS * 30; // ~2 minutes
  for (const [id, ts] of geoDebounce.entries()) {
    if (ts < staleThreshold) geoDebounce.delete(id);
  }
}

geoRouter.post('/update', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;

  const now = Date.now();
  maybeCleanGeoDebounce(now);
  const lastUpdate = geoDebounce.get(userId) ?? 0;
  if (now - lastUpdate < GEO_DEBOUNCE_MS) {
    const user = db.users.get(userId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      blurredLatitude: user?.blurredLatitude,
      blurredLongitude: user?.blurredLongitude,
    });
    return;
  }
  geoDebounce.set(userId, now);

  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const lat = Number(req.body.latitude);
  const lon = Number(req.body.longitude);
  if (!isValidLatLng(lat, lon)) {
    res.status(400).json({ error: 'Coordonnées invalides' });
    return;
  }
  user.latitude = lat;
  user.longitude = lon;
  refreshUserPublicCoords(user);
  user.lastSeenAt = now;
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
  const radiusKm = parseFloat((req.query.radius as string) || String(DEFAULT_NEARBY_RADIUS_KM));
  const distanceFilter = parseDistanceFilterQuery(req.query.distanceFilter as string | undefined);
  const limits = resolveGeoNearbyLimits(distanceFilter);
  const maxRadiusKm = resolveNearbyRadiusKm(radiusKm, distanceFilter);
  const withinRadius = (d: number) => maxRadiusKm == null || d <= maxRadiusKm;

  if (!isValidLatLng(lat, lon)) {
    res.status(400).json({ error: 'latitude et longitude requis' });
    return;
  }

  if (isLocalDevEnvironment()) {
    ensureMapBotsForNearby(lat, lon);
  }

  const salons = [...db.salons.values()]
    .filter((s) => isSalonVisibleOnMap(s, me))
    .map((s) => {
      const host = db.users.get(s.hostId);
      const coords =
        host != null
          ? getPublicMapCoords(host, s.latitude, s.longitude, s.blurredLatitude, s.blurredLongitude, me)
          : { latitude: s.blurredLatitude, longitude: s.blurredLongitude };
      return {
        salon: s,
        distanceKm: getDistanceKm(lat, lon, coords.latitude, coords.longitude),
      };
    })
    .filter(
      ({ distanceKm, salon: s }) =>
        withinRadius(distanceKm) && isValidLatLng(s.latitude, s.longitude)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limits.maxSalons)
    .map(({ salon: s }) => publicSalon(s, me));

  const lives = [...db.lives.values()]
    .filter((l) => l.isActive)
    .map((l) => {
      const host = db.users.get(l.hostId);
      const coords =
        host != null
          ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, me)
          : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
      return {
        live: l,
        coords,
        distanceKm: getDistanceKm(lat, lon, coords.latitude, coords.longitude),
      };
    })
    .filter(
      ({ distanceKm, coords }) =>
        withinRadius(distanceKm) && isValidLatLng(coords.latitude, coords.longitude)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limits.maxLives)
    .map(({ live: l, coords }) => {
      const host = db.users.get(l.hostId);
      return {
        id: l.id,
        hostId: l.hostId,
        hostName: l.hostName,
        hostUsernameColor: host?.usernameColor,
        hostUsernameWaveFrom: host?.usernameWaveFrom,
        hostUsernameWaveTo: host?.usernameWaveTo,
        title: l.title,
        platform: l.platform,
        playbackState: l.playbackState,
        latitude: coords.latitude,
        longitude: coords.longitude,
        viewersCount: l.viewersCount,
        isActive: true,
      };
    });

  const people = getNearbyPeople(me, lat, lon, radiusKm, distanceFilter).slice(0, limits.maxPeople);

  res.json({ salons, lives, people });
});
