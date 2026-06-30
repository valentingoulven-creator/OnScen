import { db, FeedPost } from './models/schema';
import { schedulePersist } from './lib/persist';

/** Publications événement créées par des utilisateurs (hors seed feed-event-*). */
export const USER_EVENT_POST_ID_PREFIX = 'user-event-';

export const USER_EVENT_SEED_TARGET = 2;

export interface UserEventSeed {
  id: string;
  userId: string;
  content: string;
  eventDate: string;
  eventLocation: string;
  eventType: 'dance' | 'chant' | 'autre';
  imageUrl?: string;
}

/** Événements communauté msdev — ids distincts de feed-event-* (section « Événements autour »). */
export const USER_EVENT_SEEDS: UserEventSeed[] = [
  {
    id: `${USER_EVENT_POST_ID_PREFIX}dj-open-mic-2026-06-10`,
    userId: 'user_dj',
    content:
      'Open mic ce jeudi au Bar Musical — sets de 15 min, inscription sur place. Ambiance chill et découvertes locales 🎤',
    eventDate: '2026-06-10T19:00:00.000Z',
    eventLocation: 'Bar Musical, Lyon, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}bass-jam-2026-06-08`,
    userId: 'user_bass',
    content:
      'Jam session acoustique en terrasse — guitare, voix et bonne humeur. Venez avec votre instrument ou juste vos oreilles 🎸',
    eventDate: '2026-06-08T17:30:00.000Z',
    eventLocation: 'Café des Arts, Bordeaux, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c7b84f6b?w=600&q=80',
  },
];

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function countUserEventPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(USER_EVENT_POST_ID_PREFIX)).length;
}

function existingUserEventIds(): Set<string> {
  return new Set(
    db.feedPosts.filter((p) => p.id.startsWith(USER_EVENT_POST_ID_PREFIX)).map((p) => p.id)
  );
}

function authorExists(userId: string): boolean {
  return db.users.has(userId);
}

export function needsUserEventsRepair(): boolean {
  if (!isMsdevEnvironment()) return false;
  const expected = new Set(USER_EVENT_SEEDS.map((e) => e.id));
  const existing = existingUserEventIds();
  for (const id of expected) {
    if (!existing.has(id)) return true;
  }
  return false;
}

export interface SeedUserEventsResult {
  created: number;
  total: number;
}

/**
 * Insère des événements publiés par des utilisateurs (section « Événements autour »).
 * Idempotent : ne recrée pas les posts déjà présents.
 */
export function seedUserEvents(): SeedUserEventsResult {
  if (!isMsdevEnvironment()) {
    return { created: 0, total: countUserEventPosts() };
  }

  const existing = existingUserEventIds();
  const missing = USER_EVENT_SEEDS.filter((seed) => !existing.has(seed.id));
  if (missing.length === 0) {
    return { created: 0, total: countUserEventPosts() };
  }

  const now = Date.now();
  let created = 0;

  for (let i = 0; i < missing.length; i++) {
    const seed = missing[i];
    if (!authorExists(seed.userId)) continue;

    const post: FeedPost = {
      id: seed.id,
      userId: seed.userId,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      isEvent: true,
      eventDate: seed.eventDate,
      eventLocation: seed.eventLocation,
      eventType: seed.eventType,
      createdAt: now - i * 3_600_000,
    };
    db.feedPosts.push(post);
    created++;
  }

  if (created > 0) {
    schedulePersist();
    console.log(
      `[msdev] ${created} événement(s) utilisateur créé(s) (${countUserEventPosts()}/${USER_EVENT_SEEDS.length})`
    );
  }

  return { created, total: countUserEventPosts() };
}
