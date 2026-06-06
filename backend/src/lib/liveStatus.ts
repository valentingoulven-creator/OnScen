import { db } from '../models/schema';

/** Utilisateur qui anime un live actif (salon ou live autonome). */
export function isUserHostingLive(userId: string): boolean {
  for (const live of db.lives.values()) {
    if (live.isActive && live.hostId === userId) return true;
  }
  return false;
}

export function getActiveLiveHostIds(): string[] {
  return getActiveLiveHosts().map((h) => h.userId);
}

/** Spectateurs du live actif de cet hôte (0 si pas en live). */
export function getLiveViewersCountForHost(userId: string): number {
  let count = 0;
  for (const live of db.lives.values()) {
    if (live.isActive && live.hostId === userId) {
      count = Math.max(count, live.viewersCount);
    }
  }
  return count;
}

/** Id du live actif animé par cet hôte (salon → id salon, sinon id live autonome). */
export function getActiveLiveIdForHost(userId: string): string | undefined {
  let best: { id: string; viewers: number } | undefined;
  for (const live of db.lives.values()) {
    if (!live.isActive || live.hostId !== userId) continue;
    if (!best || live.viewersCount >= best.viewers) {
      best = { id: live.id, viewers: live.viewersCount };
    }
  }
  return best?.id;
}

export function getActiveLiveHosts(): { userId: string; viewersCount: number }[] {
  const byHost = new Map<string, number>();
  for (const live of db.lives.values()) {
    if (!live.isActive) continue;
    const prev = byHost.get(live.hostId) ?? 0;
    byHost.set(live.hostId, Math.max(prev, live.viewersCount));
  }
  return [...byHost.entries()].map(([userId, viewersCount]) => ({ userId, viewersCount }));
}
