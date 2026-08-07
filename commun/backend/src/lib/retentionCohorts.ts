import { db } from '../models/schema';
import { userHasLoginInRange } from './userLoginRetention';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionCohortRow {
  cohortWeek: string;
  registered: number;
  week1Retained: number;
  week4Retained: number;
  week1Rate: number;
  week4Rate: number;
  week1Mature: boolean;
  week4Mature: boolean;
  week1RetainedLogin: number;
  week4RetainedLogin: number;
  week1RateLogin: number;
  week4RateLogin: number;
}

function userRegisteredAtMs(user: {
  memberSince?: number;
  acceptedTermsAt?: number;
  ageConfirmedAt?: number;
}): number {
  return user.memberSince ?? user.acceptedTermsAt ?? user.ageConfirmedAt ?? 0;
}

function weekStartUtc(ts: number): number {
  const d = new Date(ts);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function isoWeekLabel(weekStartMs: number): string {
  const thursday = new Date(weekStartMs + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function rate(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

/**
 * Cohortes 12 semaines : proxy lastSeenAt (S1/S4) + rétention stricte sur jours
 * de connexion enregistrés (semaine calendaire J+7–14 et J+28–35).
 */
export function getRetentionCohortRows(weekCount = 12): RetentionCohortRow[] {
  const now = Date.now();
  const currentWeekStart = weekStartUtc(now);
  const rows: RetentionCohortRow[] = [];

  for (let w = 0; w < weekCount; w++) {
    const cohortStart = currentWeekStart - w * 7 * DAY_MS;
    const cohortEnd = cohortStart + 7 * DAY_MS;
    const cohortWeek = isoWeekLabel(cohortStart);

    let registered = 0;
    let week1Retained = 0;
    let week4Retained = 0;
    let week1RetainedLogin = 0;
    let week4RetainedLogin = 0;

    for (const user of db.users.values()) {
      const reg = userRegisteredAtMs(user);
      if (reg <= 0 || reg < cohortStart || reg >= cohortEnd) continue;
      registered += 1;
      if (user.lastSeenAt >= reg + 7 * DAY_MS) week1Retained += 1;
      if (user.lastSeenAt >= reg + 28 * DAY_MS) week4Retained += 1;
      if (userHasLoginInRange(user.id, reg + 7 * DAY_MS, reg + 14 * DAY_MS)) {
        week1RetainedLogin += 1;
      }
      if (userHasLoginInRange(user.id, reg + 28 * DAY_MS, reg + 35 * DAY_MS)) {
        week4RetainedLogin += 1;
      }
    }

    const week1Mature = now >= cohortEnd + 7 * DAY_MS;
    const week4Mature = now >= cohortEnd + 28 * DAY_MS;

    rows.push({
      cohortWeek,
      registered,
      week1Retained: week1Mature ? week1Retained : 0,
      week4Retained: week4Mature ? week4Retained : 0,
      week1Rate: week1Mature ? rate(week1Retained, registered) : 0,
      week4Rate: week4Mature ? rate(week4Retained, registered) : 0,
      week1Mature,
      week4Mature,
      week1RetainedLogin: week1Mature ? week1RetainedLogin : 0,
      week4RetainedLogin: week4Mature ? week4RetainedLogin : 0,
      week1RateLogin: week1Mature ? rate(week1RetainedLogin, registered) : 0,
      week4RateLogin: week4Mature ? rate(week4RetainedLogin, registered) : 0,
    });
  }

  return rows;
}
