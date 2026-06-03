import { db, MusicPlatform, User } from '../models/schema';
import { getDistanceKm } from './geo';
import { getPublicMapCoords, getUserPublicCoords, userSharesDistance } from './locationPrivacy';
import { applyProfileDefaults } from './profile';
import { getHostRatingSummary } from './ratings';
import { isBotHost } from '../seed-bots';
import { isSalonVisibleOnMap } from './salonAccess';

export interface NearbyPersonDto {
  id: string;
  username: string;
  avatarUrl?: string;
  listeningRole?: string;
  city?: string;
  distanceKm?: number;
  isBot?: boolean;
  salonId?: string;
  salonTitle?: string;
  isLive?: boolean;
  hostRatingAverage?: number;
  hostRatingCount?: number;
  /** Plateforme d’écoute actuelle (salon, live ou compte connecté). */
  listeningPlatform?: MusicPlatform;
  /** Position affichée sur la carte (respecte la confidentialité). */
  latitude?: number;
  longitude?: number;
}

function mapCoordsForUser(
  u: User,
  viewerId: string,
  extra?: { salonId?: string }
): { latitude: number; longitude: number } | null {
  if (extra?.salonId) {
    const s = db.salons.get(extra.salonId);
    if (s) {
      const c = getPublicMapCoords(
        u,
        s.latitude,
        s.longitude,
        s.blurredLatitude,
        s.blurredLongitude,
        viewerId
      );
      return { latitude: c.latitude, longitude: c.longitude };
    }
  }
  const pos = getUserPublicCoords(u, viewerId);
  if (!pos) return null;
  return { latitude: pos.lat, longitude: pos.lon };
}

function resolveListeningPlatform(
  u: User,
  extra?: { salonId?: string; platform?: MusicPlatform }
): MusicPlatform | undefined {
  if (extra?.platform) return extra.platform;
  if (extra?.salonId) {
    const salon = db.salons.get(extra.salonId);
    if (salon) return salon.platform;
  }
  const standaloneLive = [...db.lives.values()].find((l) => l.isActive && l.hostId === u.id && !l.salonId);
  if (standaloneLive) return standaloneLive.platform;
  const hostedSalon = [...db.salons.values()].find((s) => s.hostId === u.id);
  if (hostedSalon) return hostedSalon.platform;
  const connected = u.connectedPlatforms ?? [];
  if (connected.length === 1) return connected[0];
  if (connected.length > 0) return connected[0];
  return undefined;
}

export function getNearbyPeople(
  viewerId: string,
  lat: number,
  lon: number,
  radiusKm: number
): NearbyPersonDto[] {
  const byId = new Map<string, NearbyPersonDto>();

  const upsert = (
    u: User,
    distanceKm: number,
    extra?: { salonId?: string; salonTitle?: string; isLive?: boolean; platform?: MusicPlatform }
  ) => {
    if (u.id === viewerId || u.isGhostMode) return;

    const rounded = Math.round(distanceKm * 10) / 10;
    const prev = byId.get(u.id);
    if (prev && (prev.distanceKm ?? Infinity) <= rounded) return;

    applyProfileDefaults(u);
    const role = u.listeningRole;
    const isHost = role === 'host' || role === 'les_deux';
    const rating = isHost ? getHostRatingSummary(u.id) : undefined;

    const salonId = extra?.salonId ?? prev?.salonId;
    const coords = mapCoordsForUser(u, viewerId, salonId ? { salonId } : undefined);

    byId.set(u.id, {
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      listeningRole: u.listeningRole,
      city: u.city,
      distanceKm: userSharesDistance(u) ? rounded : undefined,
      isBot: isBotHost(u.id),
      salonId,
      salonTitle: extra?.salonTitle ?? prev?.salonTitle,
      isLive: extra?.isLive ?? prev?.isLive,
      hostRatingAverage: rating && rating.count > 0 ? rating.average : undefined,
      hostRatingCount: rating && rating.count > 0 ? rating.count : undefined,
      listeningPlatform: resolveListeningPlatform(u, {
        salonId,
        platform: extra?.platform ?? prev?.listeningPlatform,
      }),
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    });
  };

  for (const u of db.users.values()) {
    const pos = getUserPublicCoords(u, viewerId);
    if (!pos) continue;
    const d = getDistanceKm(lat, lon, pos.lat, pos.lon);
    if (d <= radiusKm) upsert(u, d);
  }

  for (const s of db.salons.values()) {
    if (!isSalonVisibleOnMap(s, viewerId)) continue;
    const host = db.users.get(s.hostId);
    if (!host) continue;
    const mapCoords = getPublicMapCoords(
      host,
      s.latitude,
      s.longitude,
      s.blurredLatitude,
      s.blurredLongitude,
      viewerId
    );
    const d = getDistanceKm(lat, lon, mapCoords.latitude, mapCoords.longitude);
    if (d > radiusKm) continue;
    const live = db.lives.get(s.id);
    upsert(host, d, {
      salonId: s.id,
      salonTitle: s.title,
      isLive: Boolean(live?.isActive),
      platform: s.platform,
    });
  }

  for (const l of db.lives.values()) {
    if (!l.isActive || l.salonId) continue;
    const host = db.users.get(l.hostId);
    if (!host) continue;
    const mapCoords = getPublicMapCoords(
      host,
      l.latitude,
      l.longitude,
      l.blurredLatitude,
      l.blurredLongitude,
      viewerId
    );
    const d = getDistanceKm(lat, lon, mapCoords.latitude, mapCoords.longitude);
    if (d > radiusKm) continue;
    upsert(host, d, { isLive: true, platform: l.platform });
  }

  return [...byId.values()].sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );
}
