import { db, FeedPost } from './models/schema';
import { schedulePersist } from './lib/persist';

/** Publications événement créées par des utilisateurs (hors seed feed-event-*). */
export const USER_EVENT_POST_ID_PREFIX = 'user-event-';

export const USER_EVENT_SEED_TARGET = 10;

export interface UserEventSeed {
  id: string;
  userId: string;
  content: string;
  eventDate: string;
  eventLocation: string;
  eventType: 'dance' | 'chant' | 'autre';
  imageUrl?: string;
}

/** Événements communauté msdev — Montpellier / agglo (section « Autour », ~30 km). */
export const USER_EVENT_SEEDS: UserEventSeed[] = [
  {
    id: `${USER_EVENT_POST_ID_PREFIX}open-mic-rockstore-2026-07-20`,
    userId: 'user_dj',
    content:
      'Open mic au Rockstore — 15 min par artiste, inscription sur place. Ambiance chill et découvertes locales 🎤',
    eventDate: '2026-07-20T17:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}jam-peyrou-2026-07-21`,
    userId: 'user_bass',
    content:
      'Jam session sur la Place du Peyrou — guitare, voix et bonne humeur au coucher du soleil 🎸',
    eventDate: '2026-07-21T18:30:00.000Z',
    eventLocation: 'Place du Peyrou, Montpellier, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c7b84f6b?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}electro-antigone-2026-07-21`,
    userId: 'user_dj',
    content: [
      'Soirée électro en terrasse à Antigone 🪩',
      '',
      'Terrasse du Millénaire — house, disco et sets invités jusqu’à minuit.',
      '',
      '• 22h : DJ Melody (opening)',
      '• 23h30 : guests TBA',
      '• Entrée libre avant 23h',
      '• Dress code : summer chic',
      '',
      'Bar et snacks sur place. Places limitées en terrasse — arrivez tôt !',
    ].join('\n'),
    eventDate: '2026-07-21T20:00:00.000Z',
    eventLocation: 'Place du Millénaire, Montpellier, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}acoustic-comedie-2026-07-22`,
    userId: 'user_listener',
    content:
      'Concert acoustique place de la Comédie — chanson française et reprises pop en plein air ☀️',
    eventDate: '2026-07-22T17:30:00.000Z',
    eventLocation: 'Place de la Comédie, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}dj-set-cres-2026-07-23`,
    userId: 'user_dj',
    content: 'DJ set open air au Crès — deep house et sunset vibes, entrée libre avant 21h 🌅',
    eventDate: '2026-07-23T18:00:00.000Z',
    eventLocation: 'Le Crès, Montpellier, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}choir-corum-2026-07-23`,
    userId: 'user_bass',
    content:
      'Répétition publique du chœur du Corum — gospel et soul, venez chanter avec nous 🎶',
    eventDate: '2026-07-23T16:00:00.000Z',
    eventLocation: 'Le Corum Opéra Berlioz, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1460723237253-f7e14d6cc893?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}hiphop-polygone-2026-07-24`,
    userId: 'user_listener',
    content:
      'Battle rap & freestyle au Polygone — MCs locaux, jury public et after au bar du centre 🎤',
    eventDate: '2026-07-24T19:00:00.000Z',
    eventLocation: 'Le Polygone, Montpellier, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}latin-zenith-2026-07-25`,
    userId: 'user_dj',
    content:
      'Nuit latino au Zénith Sud — salsa, reggaeton et DJ set jusqu’au bout de la nuit 💃',
    eventDate: '2026-07-25T20:00:00.000Z',
    eventLocation: 'Zénith Sud, Montpellier, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}vinyl-market-2026-07-25`,
    userId: 'user_bass',
    content:
      'Marché vinyles & listening session — diggers, échanges et sets live dans les allées 🎧',
    eventDate: '2026-07-25T14:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80',
  },
  {
    id: `${USER_EVENT_POST_ID_PREFIX}sunset-peyrou-2026-07-26`,
    userId: 'user_listener',
    content:
      'Sunset live au Peyrou — duo acoustique, food trucks et vue sur les Cévennes 🌄',
    eventDate: '2026-07-26T18:00:00.000Z',
    eventLocation: 'Place du Peyrou, Montpellier, France',
    eventType: 'chant',
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

function removeUserEventPosts(): number {
  const toRemove = new Set(
    db.feedPosts.filter((p) => p.id.startsWith(USER_EVENT_POST_ID_PREFIX)).map((p) => p.id)
  );
  if (toRemove.size === 0) return 0;

  db.feedPosts = db.feedPosts.filter((p) => !toRemove.has(p.id));
  for (const postId of toRemove) {
    db.feedPostLikes.delete(postId);
    db.feedPostComments.delete(postId);
    db.feedPostFavorites.delete(postId);
  }
  return toRemove.size;
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
  removed?: number;
}

/**
 * Insère des événements publiés par des utilisateurs (section « Événements autour »).
 * Idempotent : ne recrée pas les posts déjà présents (sauf force).
 */
export function seedUserEvents(options?: { force?: boolean }): SeedUserEventsResult {
  if (!isMsdevEnvironment()) {
    return { created: 0, total: countUserEventPosts() };
  }

  let removed = 0;
  if (options?.force) {
    removed = removeUserEventPosts();
  }

  let contentSynced = 0;
  for (const seed of USER_EVENT_SEEDS) {
    const post = db.feedPosts.find((p) => p.id === seed.id);
    if (!post || post.content === seed.content) continue;
    post.content = seed.content;
    contentSynced++;
  }

  const existing = existingUserEventIds();
  const missing = USER_EVENT_SEEDS.filter((seed) => !existing.has(seed.id));
  if (missing.length === 0 && !options?.force) {
    return { created: 0, total: countUserEventPosts(), removed: removed || undefined };
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

  if (created > 0 || removed > 0 || contentSynced > 0) {
    schedulePersist();
  }
  if (created > 0) {
    console.log(
      `[msdev] ${created} événement(s) utilisateur créé(s) (${countUserEventPosts()}/${USER_EVENT_SEEDS.length}, Montpellier agglo)`
    );
  }

  return { created, total: countUserEventPosts(), removed: removed || undefined };
}
