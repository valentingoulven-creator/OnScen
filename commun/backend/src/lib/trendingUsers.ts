import { db } from '../models/schema';
import { resolveLiveCountry } from './liveCountry';

export interface TrendingUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalParticipants: number;
  rank: number;
  liveCount: number;
  salonCount: number;
}

const TOP = 6;

function normalizeCountryCode(country?: string): string | null {
  const code = country?.trim().toUpperCase();
  return code && code.length === 2 ? code : null;
}

function countryForHost(hostId: string, latitude: number, longitude: number): string | null {
  const host = db.users.get(hostId);
  return resolveLiveCountry(latitude, longitude, host?.city)?.code ?? null;
}

function userCountryCode(userId: string): string | null {
  const user = db.users.get(userId);
  if (!user) return null;
  return resolveLiveCountry(user.latitude ?? 0, user.longitude ?? 0, user.city)?.code ?? null;
}

function matchesCountry(countryCode: string | null, wanted: string | null): boolean {
  if (!wanted) return true;
  return countryCode === wanted;
}

export function buildTrendingUsers(country?: string): TrendingUser[] {
  const wanted = normalizeCountryCode(country);

  const scores = new Map<string, { live: number; salon: number; liveCount: number; salonCount: number }>();

  const ensureEntry = (hostId: string) => {
    if (!scores.has(hostId)) {
      scores.set(hostId, { live: 0, salon: 0, liveCount: 0, salonCount: 0 });
    }
    return scores.get(hostId)!;
  };

  for (const live of db.lives.values()) {
    if (!live.isActive) continue;
    if (!matchesCountry(countryForHost(live.hostId, live.latitude, live.longitude), wanted)) continue;
    const e = ensureEntry(live.hostId);
    e.live += live.viewersCount;
    e.liveCount += 1;
  }

  for (const salon of db.salons.values()) {
    if (!matchesCountry(countryForHost(salon.hostId, salon.latitude, salon.longitude), wanted)) continue;
    const e = ensureEntry(salon.hostId);
    e.salon += salon.listenersCount;
    e.salonCount += 1;
  }

  const sorted = [...scores.entries()]
    .map(([hostId, s]) => ({ hostId, total: s.live + s.salon, ...s }))
    .sort((a, b) => b.total - a.total);

  const resultIds = new Set(sorted.slice(0, TOP).map((e) => e.hostId));

  if (resultIds.size < TOP) {
    const fanCount = new Map<string, number>();
    for (const fanMap of db.userFavorites.values()) {
      for (const hostId of fanMap.keys()) {
        fanCount.set(hostId, (fanCount.get(hostId) ?? 0) + 1);
      }
    }

    const followCount = new Map<string, number>();
    for (const following of db.userFollows.values()) {
      for (const uid of following) {
        followCount.set(uid, (followCount.get(uid) ?? 0) + 1);
      }
    }

    const fallbackUsers = [...db.users.values()]
      .filter(
        (u) =>
          !resultIds.has(u.id) &&
          (u.accountStatus ?? 'active') === 'active' &&
          matchesCountry(userCountryCode(u.id), wanted)
      )
      .map((u) => ({
        id: u.id,
        score: (fanCount.get(u.id) ?? 0) + (followCount.get(u.id) ?? 0) + (u.favoritesCountOverride ?? 0),
      }))
      .sort((a, b) => b.score - a.score);

    for (const fb of fallbackUsers) {
      if (resultIds.size >= TOP) break;
      resultIds.add(fb.id);
      if (!scores.has(fb.id)) {
        scores.set(fb.id, { live: 0, salon: 0, liveCount: 0, salonCount: 0 });
        sorted.push({ hostId: fb.id, total: 0, live: 0, salon: 0, liveCount: 0, salonCount: 0 });
      }
    }
  }

  const finalList = sorted.filter((e) => resultIds.has(e.hostId)).slice(0, TOP);

  return finalList.map((entry, idx) => {
    const user = db.users.get(entry.hostId);
    return {
      userId: entry.hostId,
      username: user?.username ?? entry.hostId,
      avatarUrl: user?.avatarUrl,
      totalParticipants: entry.total,
      rank: idx + 1,
      liveCount: entry.liveCount,
      salonCount: entry.salonCount,
    };
  });
}
