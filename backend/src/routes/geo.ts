import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { isMsdevRuntime } from '../lib/msdevGuard';
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
  resolveNearbyRadiusKm,
} from '../lib/geoLimits';
import { isValidLatLng } from '../lib/mapCoords';
import { geoError, parseRequestLocale } from '../lib/requestLocale';
import {
  buildNearbyCacheKey,
  getNearbyCached,
  MAX_NEARBY_LIVES,
  MAX_NEARBY_PEOPLE,
  MAX_NEARBY_SALONS,
  setNearbyCached,
} from '../lib/nearbyResponseCache';

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
  const locale = parseRequestLocale(req.headers['accept-language']);
  if (!isValidLatLng(lat, lon)) {
    res.status(400).json({ error: geoError('invalidCoords', locale) });
    return;
  }
  user.latitude = lat;
  user.longitude = lon;
  user.geoUpdatedAt = now;
  refreshUserPublicCoords(user);
  user.lastSeenAt = now;
  db.users.set(userId, user);
  res.json({
    blurredLatitude: user.blurredLatitude,
    blurredLongitude: user.blurredLongitude,
  });
});

/**
 * Rate limit IP-based avant auth: bloque les floods non authentifiés (10/min par IP).
 * Placé avant authenticateJWT pour couvrir les requêtes sans token.
 */
const nearbyAnonLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const locale = parseRequestLocale(req.headers['accept-language']);
    res.status(429).json({ error: geoError('nearbyRateLimit', locale) });
  },
  skip: () => isMsdevRuntime(),
});

/**
 * Rate limit par utilisateur authentifié: 20 req/min par user ID.
 * Placé après authenticateJWT pour avoir accès à req.user.
 */
const nearbyAuthLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? '127.0.0.1');
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const locale = parseRequestLocale(req.headers['accept-language']);
    res.status(429).json({ error: geoError('nearbyRateLimit', locale) });
  },
  skip: () => isMsdevRuntime(),
});

/** Parse an optional bounding-box from query params (swLat, swLng, neLat, neLng). */
function parseBoundsQuery(query: Record<string, unknown>): {
  swLat: number; swLng: number; neLat: number; neLng: number;
} | null {
  const swLat = parseFloat(query.swLat as string);
  const swLng = parseFloat(query.swLng as string);
  const neLat = parseFloat(query.neLat as string);
  const neLng = parseFloat(query.neLng as string);
  if (!isFinite(swLat) || !isFinite(swLng) || !isFinite(neLat) || !isFinite(neLng)) return null;
  if (swLat > neLat) return null;
  return { swLat, swLng, neLat, neLng };
}

/** Returns true when the point (lat, lng) is inside the bounding box. */
function isInBounds(
  lat: number,
  lng: number,
  bounds: { swLat: number; swLng: number; neLat: number; neLng: number }
): boolean {
  if (lat < bounds.swLat || lat > bounds.neLat) return false;
  // Handle antimeridian crossing (east < west).
  if (bounds.swLng <= bounds.neLng) {
    return lng >= bounds.swLng && lng <= bounds.neLng;
  }
  return lng >= bounds.swLng || lng <= bounds.neLng;
}

geoRouter.get('/nearby', nearbyAnonLimiter, authenticateJWT, nearbyAuthLimiter, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const lat = parseFloat(((req.query.latitude ?? req.query.lat) as string) ?? '');
  const lon = parseFloat(((req.query.longitude ?? req.query.lng) as string) ?? '');
  const radiusKm = parseFloat((req.query.radius as string) || String(DEFAULT_NEARBY_RADIUS_KM));
  const distanceFilter = parseDistanceFilterQuery(req.query.distanceFilter as string | undefined);
  const maxRadiusKm = resolveNearbyRadiusKm(radiusKm, distanceFilter);
  const withinRadius = (d: number) => maxRadiusKm == null || d <= maxRadiusKm;

  // Optional bounding-box filter (overrides radius for salons + lives when provided).
  const bounds = parseBoundsQuery(req.query as Record<string, unknown>);

  const locale = parseRequestLocale(req.headers['accept-language']);
  if (!isValidLatLng(lat, lon)) {
    res.status(400).json({ error: geoError('coordsRequired', locale) });
    return;
  }

  if (isLocalDevEnvironment()) {
    ensureMapBotsForNearby(lat, lon);
  }

  const cacheKey = buildNearbyCacheKey({
    userId: me,
    lat,
    lon,
    maxRadiusKm,
    distanceFilter,
    bounds,
  });
  const cached = getNearbyCached(cacheKey);
  if (cached) {
    res.setHeader('Cache-Control', 'private, max-age=15');
    res.setHeader('X-Nearby-Cache', 'HIT');
    res.json(cached);
    return;
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
        coords,
        distanceKm: getDistanceKm(lat, lon, coords.latitude, coords.longitude),
      };
    })
    .filter(({ coords }) => isValidLatLng(coords.latitude, coords.longitude))
    .filter(({ distanceKm, coords }) =>
      bounds
        ? isInBounds(coords.latitude, coords.longitude, bounds)
        : withinRadius(distanceKm)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_NEARBY_SALONS)
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
    .filter(({ coords }) => isValidLatLng(coords.latitude, coords.longitude))
    .filter(({ distanceKm, coords }) =>
      bounds
        ? isInBounds(coords.latitude, coords.longitude, bounds)
        : withinRadius(distanceKm)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_NEARBY_LIVES)
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

  const people = getNearbyPeople(me, lat, lon, radiusKm, distanceFilter).slice(
    0,
    MAX_NEARBY_PEOPLE
  );

  const body = { salons, lives, people };
  setNearbyCached(cacheKey, body);
  res.setHeader('Cache-Control', 'private, max-age=15');
  res.setHeader('X-Nearby-Cache', 'MISS');
  res.json(body);
});

interface GouvCommune {
  nom: string;
  codeDepartement: string;
  centre?: { type: string; coordinates: [number, number] };
}

interface GeocodeSuggestion {
  label: string;
  subtitle?: string;
  value: string;
  latitude?: number;
  longitude?: number;
}

const GOUV_COMMUNES_API = 'https://geo.api.gouv.fr/communes';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_UA = 'Soundy/1.0 (https://getsoundy.com; contact@getsoundy.com)';
const DEFAULT_GEOCODE_LIMIT = 5;
const MAX_GEOCODE_LIMIT = 10;

/** Nominatim policy: max 1 request per second. */
let lastNominatimAt = 0;

const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const locale = parseRequestLocale(req.headers['accept-language']);
    res.status(429).json({ error: geoError('geocodeRateLimit', locale) });
  },
  skip: () => isMsdevRuntime(),
});

function mapGouvResults(data: GouvCommune[]): GeocodeSuggestion[] {
  return data.map((c) => {
    const [lon, lat] = c.centre?.coordinates ?? [];
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    return {
      label: c.nom,
      subtitle: `Dép. ${c.codeDepartement}`,
      value: c.nom,
      ...(hasCoords ? { latitude: lat, longitude: lon } : {}),
    };
  });
}

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

async function searchNominatim(q: string, limit: number, acceptLanguage: string): Promise<GeocodeSuggestion[]> {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastNominatimAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimAt = Date.now();

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: String(limit),
    addressdetails: '1',
  });
  const res = await fetch(`${NOMINATIM_API}?${params}`, {
    headers: {
      'User-Agent': NOMINATIM_UA,
      'Accept-Language': acceptLanguage || 'fr,en',
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as NominatimResult[];
  return data.map((item) => {
    const lat = parseFloat(item.lat ?? '');
    const lon = parseFloat(item.lon ?? '');
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    const addr = item.address;
    const city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.municipality;
    const label = city ?? item.display_name?.split(',')[0]?.trim() ?? q;
    const subtitle = item.display_name?.split(',').slice(1, 3).join(',').trim() || addr?.country;
    return {
      label,
      subtitle,
      value: item.display_name ?? label,
      ...(hasCoords ? { latitude: lat, longitude: lon } : {}),
    };
  });
}

geoRouter.get('/geocode', geocodeLimiter, async (req: Request, res: Response) => {
  const locale = parseRequestLocale(req.headers['accept-language']);
  const acceptLanguage =
    typeof req.headers['accept-language'] === 'string'
      ? req.headers['accept-language']
      : locale === 'en'
        ? 'en'
        : 'fr';

  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: geoError('geocodeMin', locale) });
    return;
  }

  const limitRaw = parseInt(String(req.query.limit ?? DEFAULT_GEOCODE_LIMIT), 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_GEOCODE_LIMIT)
    : DEFAULT_GEOCODE_LIMIT;

  try {
    let results: GeocodeSuggestion[] = [];

    try {
      const params = new URLSearchParams({
        nom: q,
        boost: 'population',
        limit: String(limit),
        fields: 'nom,codeDepartement,centre',
      });
      const gouvRes = await fetch(`${GOUV_COMMUNES_API}?${params}`);
      if (gouvRes.ok) {
        const data = (await gouvRes.json()) as GouvCommune[];
        results = mapGouvResults(data);
      }
    } catch {
      /* fall through to Nominatim */
    }

    if (results.length < limit) {
      const nominatim = await searchNominatim(q, limit, acceptLanguage);
      const seen = new Set(results.map((r) => `${r.latitude ?? ''}:${r.longitude ?? ''}:${r.label}`));
      for (const item of nominatim) {
        const key = `${item.latitude ?? ''}:${item.longitude ?? ''}:${item.label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
        if (results.length >= limit) break;
      }
    }

    if (results.length === 0) {
      res.status(502).json({ error: geoError('geocodeUnavailable', locale) });
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ results: results.slice(0, limit) });
  } catch {
    res.status(502).json({ error: geoError('geocodeUnavailable', locale) });
  }
});
