import { db } from '../models/schema';

import { recordUserLoginDay } from './userLoginRetention';

export type AnalyticsEventType =
  | 'user_login'
  | 'user_login_oauth'
  | 'user_login_biometric'
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

/** Compteurs d'événements : clé = `type:YYYY-MM-DD` (UTC). */
const eventBuckets = new Map<string, EventBucket>();

/** DAU tracking : userId → dernier timestamp d'activité (complète lastSeenAt). */
const dauMap = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyFromTimestamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
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
    if (
      type === 'user_login' ||
      type === 'user_login_oauth' ||
      type === 'user_login_biometric'
    ) {
      recordUserLoginDay(userId);
    }
  }
}

/** Marque un utilisateur comme actif (pour DAU). */
export function trackUserActive(userId: string): void {
  dauMap.set(userId, Date.now());
}

/** Utilisateurs distincts vus via trackEvent / trackUserActive depuis cutoff (carte analytics). */
export function countTrackedActiveUsersSince(cutoffMs: number): number {
  let count = 0;
  for (const ts of dauMap.values()) {
    if (ts > cutoffMs) count += 1;
  }
  return count;
}

export function snapshotAnalyticsBuckets(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, bucket] of eventBuckets.entries()) {
    if (bucket.count > 0) out[key] = bucket.count;
  }
  return out;
}

export function restoreAnalyticsBuckets(data: Record<string, number> | undefined): void {
  eventBuckets.clear();
  if (!data) return;
  for (const [key, count] of Object.entries(data)) {
    if (typeof count === 'number' && count > 0) {
      eventBuckets.set(key, { count });
    }
  }
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

/** Somme des compteurs journaliers sur les N derniers jours (inclus aujourd'hui). */
export function sumEventsLastNDays(type: AnalyticsEventType, days: number): number {
  if (days <= 0) return 0;
  return getEventCountLastNDays(type, days).reduce((a, b) => a + b, 0);
}

/**
 * Somme tous les buckets journaliers d'un type d'événement, depuis le début
 * du tracking analytics (pas de fenêtre temporelle). Utile pour des totaux
 * "all-time" (ex. nombre de salons/lives créés depuis toujours) — sous-estime
 * légèrement l'historique réel si le tracking a démarré après le lancement
 * de la fonctionnalité, mais reste la meilleure source disponible (pas de
 * table dédiée en base pour ce compteur).
 */
export function getEventTotalAllTime(type: AnalyticsEventType): number {
  let total = 0;
  const prefix = `${type}:`;
  for (const [key, bucket] of eventBuckets.entries()) {
    if (key.startsWith(prefix)) total += bucket.count;
  }
  return total;
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

function getDayBucketKeys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

interface MonthBucket {
  year: number;
  month: number;
}

function getMonthBucketKeys(n: number): MonthBucket[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (n - 1 - i));
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function countTimestampsByDayKeys(timestamps: number[], dayKeys: string[]): number[] {
  const indexByKey = new Map(dayKeys.map((key, index) => [key, index]));
  const counts = new Array(dayKeys.length).fill(0);
  for (const ts of timestamps) {
    const index = indexByKey.get(dateKeyFromTimestamp(ts));
    if (index !== undefined) counts[index] += 1;
  }
  return counts;
}

function countTimestampsByMonthKeys(timestamps: number[], monthKeys: MonthBucket[]): number[] {
  const counts = new Array(monthKeys.length).fill(0);
  for (const ts of timestamps) {
    const d = new Date(ts);
    const index = monthKeys.findIndex(
      (bucket) => bucket.year === d.getFullYear() && bucket.month === d.getMonth()
    );
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

function mergeSeries(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
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

function getDbSeriesForPeriod(timestamps: number[], period: AnalyticsPeriod): number[] {
  switch (period) {
    case 'day':
      return countTimestampsByDayKeys(timestamps, getDayBucketKeys(1));
    case 'week':
      return countTimestampsByDayKeys(timestamps, getDayBucketKeys(7));
    case 'month':
      return countTimestampsByDayKeys(timestamps, getDayBucketKeys(30));
    case 'year':
      return countTimestampsByMonthKeys(timestamps, getMonthBucketKeys(12));
  }
}

function collectMessageTimestamps(): number[] {
  const timestamps: number[] = [];
  for (const message of db.directMessages) timestamps.push(message.timestamp);
  for (const message of db.groupMessages) timestamps.push(message.timestamp);
  for (const messages of db.salonChats.values()) {
    for (const message of messages) timestamps.push(message.timestamp);
  }
  for (const messages of db.liveChats.values()) {
    for (const message of messages) timestamps.push(message.timestamp);
  }
  return timestamps;
}

function collectMatchTimestamps(): number[] {
  return db.matches.map((match) => match.createdAt);
}

function collectSalonTimestamps(): number[] {
  return [...db.salons.values()].map((salon) => salon.createdAt);
}

function collectLiveTimestamps(): number[] {
  return [...db.lives.values()].map((live) => live.startedAt);
}

function collectFavoriteTimestamps(): number[] {
  const timestamps: number[] = [];
  for (const hosts of db.userFavorites.values()) {
    for (const entry of hosts.values()) timestamps.push(entry.createdAt);
  }
  return timestamps;
}

function getLoginSeriesForPeriod(period: AnalyticsPeriod): number[] {
  const passwordLogins = getEventSeriesForPeriod('user_login', period);
  const oauthLogins = getEventSeriesForPeriod('user_login_oauth', period);
  return mergeSeries(passwordLogins, oauthLogins);
}

export function countActiveUsersSince(cutoffMs: number): number {
  let count = 0;
  for (const user of db.users.values()) {
    if (user.lastSeenAt > cutoffMs) count += 1;
  }
  return count;
}

/** Synthèse complète pour le tableau de bord analytics. */
export function getAnalyticsSummary(period: AnalyticsPeriod = 'week', locale = 'fr-FR') {
  const labels = getPeriodLabels(period, locale);

  const totalUsers = db.users.size;
  const activeSalons = db.salons.size;
  const activeLives = [...db.lives.values()].filter((live) => live.isActive).length;
  const totalMessages =
    db.directMessages.length +
    db.groupMessages.length +
    [...db.salonChats.values()].reduce((sum, messages) => sum + messages.length, 0) +
    [...db.liveChats.values()].reduce((sum, messages) => sum + messages.length, 0);
  const totalReels = db.userReels.length;
  const totalMatches = db.matches.length;
  const totalFeedPosts = db.feedPosts.length;

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newUsersToday = [...db.users.values()].filter(
    (user) => user.memberSince && user.memberSince > oneDayAgo
  ).length;

  const messageTimestamps = collectMessageTimestamps();
  const dbMessages = getDbSeriesForPeriod(messageTimestamps, period);
  const dbMatches = getDbSeriesForPeriod(collectMatchTimestamps(), period);
  const dbSalons = getDbSeriesForPeriod(collectSalonTimestamps(), period);
  const dbLives = getDbSeriesForPeriod(collectLiveTimestamps(), period);
  const dbFavorites = getDbSeriesForPeriod(collectFavoriteTimestamps(), period);

  return {
    snapshot: {
      totalUsers,
      dau24h: countActiveUsersSince(oneDayAgo),
      dau24hTracked: countTrackedActiveUsersSince(oneDayAgo),
      dau30d: countActiveUsersSince(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dau30dTracked: countTrackedActiveUsersSince(Date.now() - 30 * 24 * 60 * 60 * 1000),
      newUsersToday,
      activeSalons,
      activeLives,
      totalMessages,
      totalReels,
      totalMatches,
      totalFeedPosts,
    },
    period,
    series: {
      labels,
      logins: getLoginSeriesForPeriod(period),
      messagesSent: dbMessages,
      salonsCreated: dbSalons,
      livesStarted: dbLives,
      reelsViewed: getEventSeriesForPeriod('reel_viewed', period),
      matchesCreated: dbMatches,
      favoritesAdded: dbFavorites,
    },
  };
}
