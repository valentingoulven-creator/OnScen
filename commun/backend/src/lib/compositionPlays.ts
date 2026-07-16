import { db, type CompositionPlay, type UserComposition } from '../models/schema';
import { getWeekStart } from './weeklyVotes';

/** Ignore duplicate play events from the same listener within this window. */
const PLAY_DEDUPE_MS = 60_000;

function purgeOldPlays(now = Date.now()): void {
  const weekStart = getWeekStart(now);
  const twoWeeksAgo = weekStart - 14 * 24 * 60 * 60 * 1000;
  const keep = db.compositionPlays.filter((p) => p.playedAt >= twoWeeksAgo);
  db.compositionPlays.length = 0;
  db.compositionPlays.push(...keep);
}

/**
 * Record a composition listen for weekly popularity charts.
 * Returns false when throttled or composition missing.
 */
export function recordCompositionPlay(
  compositionId: string,
  listenerId: string,
  now = Date.now()
): { ok: boolean; weeklyPlayCount: number } {
  const composition = db.compositions.find((c) => c.id === compositionId);
  if (!composition) {
    return { ok: false, weeklyPlayCount: 0 };
  }

  purgeOldPlays(now);
  const weekStart = getWeekStart(now);

  const recentDuplicate = db.compositionPlays.find(
    (p) =>
      p.compositionId === compositionId &&
      p.listenerId === listenerId &&
      now - p.playedAt < PLAY_DEDUPE_MS
  );
  if (recentDuplicate) {
    return { ok: true, weeklyPlayCount: getCompositionWeeklyPlayCount(compositionId, now) };
  }

  const entry: CompositionPlay = {
    id: `${compositionId}__${listenerId}__${now}`,
    compositionId,
    listenerId,
    playedAt: now,
    weekStart,
  };
  db.compositionPlays.push(entry);

  return { ok: true, weeklyPlayCount: getCompositionWeeklyPlayCount(compositionId, now) };
}

export function getCompositionWeeklyPlayCount(compositionId: string, now = Date.now()): number {
  const weekStart = getWeekStart(now);
  return db.compositionPlays.filter(
    (p) => p.compositionId === compositionId && p.playedAt >= weekStart
  ).length;
}

/** compositionId → play count for the current week (Monday 00:00 local). */
export function getWeeklyCompositionPlayCounts(now = Date.now()): Map<string, number> {
  const weekStart = getWeekStart(now);
  const counts = new Map<string, number>();
  for (const play of db.compositionPlays) {
    if (play.playedAt < weekStart) continue;
    counts.set(play.compositionId, (counts.get(play.compositionId) ?? 0) + 1);
  }
  return counts;
}

export function removeCompositionPlays(compositionId: string): void {
  const keep = db.compositionPlays.filter((p) => p.compositionId !== compositionId);
  db.compositionPlays.length = 0;
  db.compositionPlays.push(...keep);
}

export function removeListenerCompositionPlays(listenerId: string): void {
  const keep = db.compositionPlays.filter((p) => p.listenerId !== listenerId);
  db.compositionPlays.length = 0;
  db.compositionPlays.push(...keep);
}

export function compositionExists(compositionId: string): UserComposition | undefined {
  return db.compositions.find((c) => c.id === compositionId);
}
