import { db } from '../models/schema';

export type AnalyticsEventType =
  | 'user_login'
  | 'user_login_oauth'
  | 'message_sent'
  | 'salon_created'
  | 'live_started'
  | 'reel_viewed'
  | 'match_created'
  | 'favorite_added'
  | 'reel_created';

interface EventBucket {
  count: number;
}

/** Compteurs d'événements : clé = `type:YYYY-MM-DD` */
const eventBuckets = new Map<string, EventBucket>();

/** DAU tracking : userId → dernier timestamp d'activité */
const dauMap = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function bucketKey(type: AnalyticsEventType, date = todayKey()): string {
  return `${type}:${date}`;
}

/** Enregistre un événement analytique. */
export function trackEvent(type: AnalyticsEventType, userId?: string): void {
  const key = bucketKey(type);
  const bucket = eventBuckets.get(key) ?? { count: 0 };
  bucket.count += 1;
  eventBuckets.set(key, bucket);

  if (userId) {
    dauMap.set(userId, Date.now());
  }
}

/** Marque un utilisateur comme actif (pour DAU). */
export function trackUserActive(userId: string): void {
  dauMap.set(userId, Date.now());
}

// ── Requêtes summary ───────────────────────────────────────────────────────

function getEventCount(type: AnalyticsEventType, daysBack = 0): number {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const key = bucketKey(type, date.toISOString().slice(0, 10));
  return eventBuckets.get(key)?.count ?? 0;
}

function getEventCountLastNDays(type: AnalyticsEventType, n: number): number[] {
  return Array.from({ length: n }, (_, i) => getEventCount(type, n - 1 - i));
}

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

const VALID_PERIODS: AnalyticsPeriod[] = ['day', 'week', 'month', 'year'];

export function parseAnalyticsPeriod(value: unknown): AnalyticsPeriod {
  if (typeof value === 'string' && VALID_PERIODS.includes(value as AnalyticsPeriod)) {
    return value as AnalyticsPeriod;
  }
  return 'week';
}

function getLastNDaysLabels(n: number, locale = 'fr-FR'): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1) + i);
    if (n === 1) {
      return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  });
}

function getLastNMonthsLabels(n: number, locale = 'fr-FR'): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (n - 1) + i);
    return d.toLocaleDateString(locale, { month: 'short' });
  });
}

function getEventCountForMonth(type: AnalyticsEventType, year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    total += eventBuckets.get(bucketKey(type, dateStr))?.count ?? 0;
  }
  return total;
}

function getEventCountLastNMonths(type: AnalyticsEventType, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (n - 1 - i));
    return getEventCountForMonth(type, d.getFullYear(), d.getMonth());
  });
}

function getPeriodLabels(period: AnalyticsPeriod, locale = 'fr-FR'): string[] {
  switch (period) {
    case 'day':
      return getLastNDaysLabels(1, locale);
    case 'week':
      return getLastNDaysLabels(7, locale);
    case 'month':
      return getLastNDaysLabels(30, locale);
    case 'year':
      return getLastNMonthsLabels(12, locale);
  }
}

function getEventSeriesForPeriod(type: AnalyticsEventType, period: AnalyticsPeriod): number[] {
  switch (period) {
    case 'day':
      return getEventCountLastNDays(type, 1);
    case 'week':
      return getEventCountLastNDays(type, 7);
    case 'month':
      return getEventCountLastNDays(type, 30);
    case 'year':
      return getEventCountLastNMonths(type, 12);
  }
}

function countDauLast24h(): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const ts of dauMap.values()) {
    if (ts > cutoff) count++;
  }
  return count;
}

function countDauLast30Days(): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const ts of dauMap.values()) {
    if (ts > cutoff) count++;
  }
  return count;
}

/** Synthèse complète pour le tableau de bord analytics. */
export function getAnalyticsSummary(period: AnalyticsPeriod = 'week', locale = 'fr-FR') {
  const labels = getPeriodLabels(period, locale);

  // Données dérivées du db en temps réel
  const totalUsers = db.users.size;
  const activeSalons = db.salons.size;
  const activeLives = [...db.lives.values()].filter((l) => l.isActive).length;
  const totalMessages =
    db.directMessages.length + db.groupMessages.length;
  const totalReels = db.userReels.length;
  const totalMatches = db.matches.length;
  const totalFeedPosts = db.feedPosts.length;

  // Utilisateurs créés dans les dernières 24h (approx. par lastSeenAt comme proxy)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newUsersToday = [...db.users.values()].filter(
    (u) => u.memberSince && u.memberSince > oneDayAgo
  ).length;

  return {
    // Snapshot temps réel
    snapshot: {
      totalUsers,
      dau24h: countDauLast24h(),
      dau30d: countDauLast30Days(),
      newUsersToday,
      activeSalons,
      activeLives,
      totalMessages,
      totalReels,
      totalMatches,
      totalFeedPosts,
    },
    period,
    // Séries temporelles selon la période sélectionnée
    series: {
      labels,
      logins: getEventSeriesForPeriod('user_login', period),
      messagesSent: getEventSeriesForPeriod('message_sent', period),
      salonsCreated: getEventSeriesForPeriod('salon_created', period),
      livesStarted: getEventSeriesForPeriod('live_started', period),
      reelsViewed: getEventSeriesForPeriod('reel_viewed', period),
      matchesCreated: getEventSeriesForPeriod('match_created', period),
      favoritesAdded: getEventSeriesForPeriod('favorite_added', period),
    },
  };
}
