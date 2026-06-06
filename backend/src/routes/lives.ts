import { Router, Request, Response } from 'express';
import { db, Live, MusicPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { blurCoordinate, getDistanceKm } from '../lib/geo';
import { getPublicMapCoords, userSharesDistance } from '../lib/locationPrivacy';
import { notifyFollowersLiveStarted } from '../lib/follows';
import { notifyFavoritesLiveStarted } from '../lib/favorites';
import { publicSalon } from './salons';
import { isLiveViewBanned, liveBanMessage, getLiveBan } from '../lib/liveBans';
import {
  LIVES_LIST_MAX,
  parseDistanceFilterQuery,
  resolveNearbyRadiusKm,
} from '../lib/geoLimits';
import { DEFAULT_MAP_LAT, DEFAULT_MAP_LON, isValidLatLng } from '../lib/mapCoords';

export const livesRouter = Router();

livesRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const latStr = req.query.latitude as string | undefined;
  const lonStr = req.query.longitude as string | undefined;
  const hasGeoFilter = latStr !== undefined && lonStr !== undefined;
  const lat = hasGeoFilter ? parseFloat(latStr!) : NaN;
  const lon = hasGeoFilter ? parseFloat(lonStr!) : NaN;
  const radiusKm = parseFloat((req.query.radiusKm as string) || '50');
  const distanceFilter = parseDistanceFilterQuery(req.query.distanceFilter as string | undefined);

  if (hasGeoFilter && !isValidLatLng(lat, lon)) {
    res.status(400).json({ error: 'latitude et longitude invalides' });
    return;
  }

  const active = [...db.lives.values()].filter((l) => l.isActive);

  if (hasGeoFilter) {
    const maxRadiusKm = resolveNearbyRadiusKm(radiusKm, distanceFilter);
    const withinRadius = (d: number) => maxRadiusKm == null || d <= maxRadiusKm;
    const me = (req as Request & { user: { id: string } }).user.id;
    const filtered = active
      .map((l) => {
        const host = db.users.get(l.hostId);
        const coords =
          host != null
            ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, me)
            : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
        return {
          live: l,
          host,
          distanceKm: getDistanceKm(lat, lon, coords.latitude, coords.longitude),
        };
      })
      .filter(
        ({ distanceKm, live: l }) =>
          withinRadius(distanceKm) && isValidLatLng(l.latitude, l.longitude)
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      lives: filtered
        .slice(0, LIVES_LIST_MAX)
        .map(({ live, host, distanceKm }) =>
          publicLive(live, host && userSharesDistance(host) ? distanceKm : undefined, me)
        ),
    });
    return;
  }

  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ lives: active.slice(0, LIVES_LIST_MAX).map((l) => publicLive(l, undefined, me)) });
});

function resolveStartCoordinates(
  user: { latitude?: number; longitude?: number },
  body: { latitude?: unknown; longitude?: unknown }
): { latitude: number; longitude: number } {
  const bodyLat = typeof body.latitude === 'number' ? body.latitude : parseFloat(String(body.latitude ?? ''));
  const bodyLon = typeof body.longitude === 'number' ? body.longitude : parseFloat(String(body.longitude ?? ''));
  if (Number.isFinite(bodyLat) && Number.isFinite(bodyLon)) {
    return { latitude: bodyLat, longitude: bodyLon };
  }
  if (isValidLatLng(user.latitude, user.longitude)) {
    return { latitude: user.latitude!, longitude: user.longitude! };
  }
  return { latitude: DEFAULT_MAP_LAT, longitude: DEFAULT_MAP_LON };
}

function defaultStandalonePlayback(hostName: string, platform: MusicPlatform) {
  return {
    platform,
    trackId: 'demo',
    title: 'Soundly Session',
    artist: hostName,
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    isPlaying: true,
    progressMs: 0,
    updatedAt: Date.now(),
  };
}

livesRouter.post('/start', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const existing = [...db.lives.values()].find((l) => l.hostId === userId && l.isActive);
  if (existing) {
    res.json({ live: publicLive(existing, undefined, userId) });
    return;
  }

  const salon = [...db.salons.values()].find((s) => s.hostId === userId);
  let live: Live;

  if (salon) {
    /** playbackState reprend le salon (métadonnées morceau) ; la vidéo YouTube reste côté SalonPage, pas LivePage. */
    live = {
      id: salon.id,
      salonId: salon.id,
      hostId: salon.hostId,
      hostName: salon.hostName,
      title: req.body.title || `Live — ${salon.title}`,
      platform: salon.platform,
      playbackState: salon.playbackState,
      latitude: salon.latitude,
      longitude: salon.longitude,
      blurredLatitude: blurCoordinate(salon.latitude),
      blurredLongitude: blurCoordinate(salon.longitude),
      viewersCount: 0,
      isActive: true,
      startedAt: Date.now(),
      vipModeratorIds: [],
    };
  } else {
    const { latitude, longitude } = resolveStartCoordinates(user, req.body);
    const platform: MusicPlatform = req.body.platform === 'youtube' ? 'youtube' : 'spotify';
    live = {
      id: `live_${Date.now()}`,
      hostId: userId,
      hostName: user.username,
      title: req.body.title || `Live — ${user.username}`,
      platform,
      playbackState: defaultStandalonePlayback(user.username, platform),
      latitude,
      longitude,
      blurredLatitude: blurCoordinate(latitude),
      blurredLongitude: blurCoordinate(longitude),
      viewersCount: 0,
      isActive: true,
      startedAt: Date.now(),
      vipModeratorIds: [],
    };
  }

  db.lives.set(live.id, live);
  db.liveChats.set(live.id, []);
  db.liveBans.set(live.id, new Map());
  const host = db.users.get(live.hostId);
  if (host) {
    notifyFollowersLiveStarted(live, host);
    notifyFavoritesLiveStarted(host, live);
  }
  res.status(201).json({ live: publicLive(live, undefined, userId) });
});

livesRouter.post('/stop', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = [...db.lives.values()].find((l) => l.hostId === userId && l.isActive);
  if (!live) {
    res.status(404).json({ error: 'Aucun live actif' });
    return;
  }
  live.isActive = false;
  db.lives.set(live.id, live);
  res.json({ ok: true });
});

livesRouter.get('/:id', authenticateJWT, (req: Request, res: Response) => {
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  const me = (req as Request & { user: { id: string } }).user.id;
  if (live.hostId !== me && isLiveViewBanned(live.id, me)) {
    const ban = getLiveBan(live.id, me);
    res.status(403).json({
      error: ban ? liveBanMessage(ban) : 'Vous êtes banni de ce live.',
      code: 'live_banned',
      permanent: ban?.permanent,
      until: ban?.until,
    });
    return;
  }
  res.json({
    live: publicLive(live, undefined, me),
    salon:
      live.salonId && db.salons.get(live.salonId)
        ? publicSalon(db.salons.get(live.salonId)!, me)
        : null,
  });
});

function publicLive(l: Live, distanceKm?: number, viewerId?: string) {
  const host = db.users.get(l.hostId);
  const coords =
    host != null
      ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, viewerId)
      : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
  const base = {
    id: l.id,
    salonId: l.salonId,
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
    isActive: l.isActive,
    startedAt: l.startedAt,
    cameraActive: !!l.cameraActive,
    vipModeratorIds: l.vipModeratorIds ?? [],
  };
  if (distanceKm !== undefined) {
    return { ...base, distanceKm: Math.round(distanceKm * 10) / 10 };
  }
  return base;
}
