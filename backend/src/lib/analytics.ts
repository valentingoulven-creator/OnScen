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

function getLast7DaysLabels(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  });
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
export function getAnalyticsSummary() {
  const labels7d = getLast7DaysLabels();

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
    // Séries temporelles 7 jours
    series: {
      labels: labels7d,
      logins: getEventCountLastNDays('user_login', 7),
      messagesSent: getEventCountLastNDays('message_sent', 7),
      salonsCreated: getEventCountLastNDays('salon_created', 7),
      livesStarted: getEventCountLastNDays('live_started', 7),
      reelsViewed: getEventCountLastNDays('reel_viewed', 7),
      matchesCreated: getEventCountLastNDays('match_created', 7),
      favoritesAdded: getEventCountLastNDays('favorite_added', 7),
    },
  };
}
