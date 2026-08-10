/** ~12 mois glissants — aligné politique de confidentialité (audit rétention connexion). */
const MAX_DAYS_PER_USER = 366;

/** userId → jours UTC YYYY-MM-DD où une connexion a été enregistrée. */
const loginDaysByUser = new Map<string, Set<string>>();

function dayKeyFromTs(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dayStartMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00.000Z`);
}

/** Enregistre un jour de connexion (idempotent par jour). */
export function recordUserLoginDay(userId: string, ts = Date.now()): void {
  if (!userId) return;
  const day = dayKeyFromTs(ts);
  let set = loginDaysByUser.get(userId);
  if (!set) {
    set = new Set();
    loginDaysByUser.set(userId, set);
  }
  if (set.has(day)) return;
  set.add(day);
  if (set.size > MAX_DAYS_PER_USER) {
    const sorted = [...set].sort();
    const drop = sorted.slice(0, set.size - MAX_DAYS_PER_USER);
    for (const d of drop) set.delete(d);
  }
}

/** Au moins une connexion enregistrée dans [startMs, endMs). */
export function userHasLoginInRange(userId: string, startMs: number, endMs: number): boolean {
  const set = loginDaysByUser.get(userId);
  if (!set || set.size === 0) return false;
  for (const day of set) {
    const t = dayStartMs(day);
    if (t >= startMs && t < endMs) return true;
  }
  return false;
}

export function snapshotUserLoginDays(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [userId, days] of loginDaysByUser.entries()) {
    if (days.size > 0) out[userId] = [...days].sort();
  }
  return out;
}

export function restoreUserLoginDays(data: Record<string, string[]> | undefined): void {
  loginDaysByUser.clear();
  if (!data) return;
  for (const [userId, days] of Object.entries(data)) {
    if (!Array.isArray(days) || days.length === 0) continue;
    loginDaysByUser.set(userId, new Set(days.filter((d) => typeof d === 'string' && d.length >= 10)));
  }
}
