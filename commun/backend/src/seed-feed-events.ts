import { db, FeedPost } from './models/schema';
import { schedulePersist } from './lib/persist';

/** Publications événement — préfixe idempotent (msdev). */
export const EVENT_POST_ID_PREFIX = 'feed-event-';

export const EVENT_SEED_TARGET = 19;

export interface FeedEventSeed {
  id: string;
  userId: string;
  content: string;
  eventDate: string;
  eventLocation: string;
  eventType: 'dance' | 'chant' | 'autre';
  imageUrl?: string;
}

/** Concerts et festivals réels à Montpellier et Paris (juin–juillet 2026). */
export const FEED_EVENT_SEEDS: FeedEventSeed[] = [
  {
    id: `${EVENT_POST_ID_PREFIX}lorie-zenith-2026-06-07`,
    userId: 'user_dj',
    content:
      'Lorie en tournée Party 2026 — soirée festive avec tous ses tubes au Zénith Sud. Ambiance club et show garanti !',
    eventDate: '2026-06-07T16:00:00.000Z',
    eventLocation: 'Zénith Sud, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}we-love-green-2026-06-07`,
    userId: 'user_bass',
    content:
      'Dernier jour du festival We Love Green : Gorillaz, Marina, Charlotte Cardin, Mac DeMarco et bien d’autres au Bois de Vincennes.',
    eventDate: '2026-06-07T12:00:00.000Z',
    eventLocation: 'Bois de Vincennes, Paris, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}slimane-pleyel-2026-06-07`,
    userId: 'user_listener',
    content:
      'Slimane en concert à la Salle Pleyel — une soirée intimiste et émotionnelle au cœur de Paris.',
    eventDate: '2026-06-07T18:00:00.000Z',
    eventLocation: 'Salle Pleyel, Paris, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}doja-cat-2026-06-09`,
    userId: 'user_dj',
    content: 'Doja Cat investit l’Accor Arena pour un show grand format — pop, rap et énergie scénique.',
    eventDate: '2026-06-09T18:00:00.000Z',
    eventLocation: 'Accor Arena, Paris, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}david-mcfly-2026-06-12`,
    userId: 'user_bass',
    content:
      'David (McFly) en live au Rockstore — pop-rock britannique et énergie de club dans le centre de Montpellier.',
    eventDate: '2026-06-12T18:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}xzibit-2026-06-13`,
    userId: 'user_listener',
    content: 'Xzibit avec Furnace Band au Rockstore — hip-hop west coast et set DJ pour finir la nuit.',
    eventDate: '2026-06-13T17:30:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}kaytranada-2026-06-16`,
    userId: 'user_dj',
    content:
      'Kaytranada à l’Accor Arena — house, funk et grooves hypnotiques pour une soirée dansante à Paris.',
    eventDate: '2026-06-16T18:00:00.000Z',
    eventLocation: 'Accor Arena, Paris, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}florent-pagny-2026-06-20`,
    userId: 'user_bass',
    content:
      'Florent Pagny en résidence à l’Olympia — retrouvez ses plus grands tubes dans la salle mythique.',
    eventDate: '2026-06-20T18:30:00.000Z',
    eventLocation: "L'Olympia, Paris, France",
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}fatals-picards-2026-06-25`,
    userId: 'user_listener',
    content:
      'Les Fatals Picards au Rockstore — chanson française décalée et fête sur scène à Montpellier.',
    eventDate: '2026-06-25T17:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}guns-n-roses-2026-07-01`,
    userId: 'user_dj',
    content:
      'Guns N’ Roses World Tour 2026 — hard rock légendaire à l’Accor Arena, première de deux dates parisiennes.',
    eventDate: '2026-07-01T18:00:00.000Z',
    eventLocation: 'Accor Arena, Paris, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}club-peyrou-2026-07-03`,
    userId: 'user_bass',
    content:
      'Club Peyrou : The Blaze, Worakls et Kazy Lambist — électro cinématographique sur la place du Peyrou.',
    eventDate: '2026-07-03T19:00:00.000Z',
    eventLocation: 'Place du Peyrou, Montpellier, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}hilary-hahn-2026-07-17`,
    userId: 'user_listener',
    content:
      'Hilary Hahn interprète Mozart et Schumann — concert du Festival Radio France au Corum Opéra Berlioz.',
    eventDate: '2026-07-17T18:00:00.000Z',
    eventLocation: 'Le Corum Opéra Berlioz, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1460723237253-f7e14d6cc893?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}deferlantes-2026-07-20`,
    userId: 'user_dj',
    content:
      'Les Déferlantes — jour 2 : Damso, Vald et Lomepal sur la plage d’Argelès. Festival rock & hip-hop.',
    eventDate: '2026-07-20T16:00:00.000Z',
    eventLocation: 'Les Déferlantes, Argelès-sur-Mer, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}nuits-sonores-2026-07-21`,
    userId: 'user_bass',
    content:
      'Nuits Sonores — soirée électro au parc de la Tête d’Or : Amelie Lens, Four Tet et Bicep en live.',
    eventDate: '2026-07-21T18:00:00.000Z',
    eventLocation: 'Nuits Sonores, Lyon, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}jazz-juan-2026-07-22`,
    userId: 'user_listener',
    content:
      'Jazz à Juan — soirée au Pinède Gould : Gregory Porter et Ibrahim Maalouf face à la Méditerranée.',
    eventDate: '2026-07-22T19:30:00.000Z',
    eventLocation: 'Jazz à Juan, Antibes, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0ff35ac28?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}vieilles-charrues-2026-07-23`,
    userId: 'user_dj',
    content:
      'Les Vieilles Charrues — jour 1 à Carhaix : Stromae, Angèle et Måneskin sur la prairie bretonne.',
    eventDate: '2026-07-23T14:00:00.000Z',
    eventLocation: 'Les Vieilles Charrues, Carhaix, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}lollapalooza-paris-2026-07-24`,
    userId: 'user_bass',
    content:
      'Lollapalooza Paris — hip-hop day à Longchamp : Tyler, The Creator, A$AP Rocky et Central Cee.',
    eventDate: '2026-07-24T12:00:00.000Z',
    eventLocation: 'Hippodrome de Longchamp, Paris, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}francofolies-2026-07-25`,
    userId: 'user_listener',
    content:
      'Francofolies de La Rochelle — soirée chanson : -M-, Zazie et Grand Corps Malade sur le port.',
    eventDate: '2026-07-25T19:00:00.000Z',
    eventLocation: 'Francofolies, La Rochelle, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
  },
  {
    id: `${EVENT_POST_ID_PREFIX}calvi-rocks-2026-07-26`,
    userId: 'user_dj',
    content:
      'Calvi on the Rocks — closing party : Disclosure, Peggy Gou et DJ set sunset sur la citadelle.',
    eventDate: '2026-07-26T17:00:00.000Z',
    eventLocation: 'Calvi on the Rocks, Calvi, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
];

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function countFeedEventPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(EVENT_POST_ID_PREFIX)).length;
}

function existingEventIds(): Set<string> {
  return new Set(
    db.feedPosts.filter((p) => p.id.startsWith(EVENT_POST_ID_PREFIX)).map((p) => p.id)
  );
}

function removeFeedEventPosts(): number {
  const toRemove = new Set(
    db.feedPosts.filter((p) => p.id.startsWith(EVENT_POST_ID_PREFIX)).map((p) => p.id)
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

export function needsFeedEventsRepair(): boolean {
  if (!isMsdevEnvironment()) return false;
  const expected = new Set(FEED_EVENT_SEEDS.map((e) => e.id));
  const existing = existingEventIds();
  for (const id of expected) {
    if (!existing.has(id)) return true;
  }
  return false;
}

export interface SeedFeedEventsResult {
  created: number;
  total: number;
  removed?: number;
}

/**
 * Insère des publications événement (concerts réels Montpellier / Paris) pour msdev.
 * Idempotent : ne recrée pas les posts déjà présents (sauf force).
 */
export function seedFeedEvents(options?: { force?: boolean }): SeedFeedEventsResult {
  if (!isMsdevEnvironment()) {
    return { created: 0, total: countFeedEventPosts() };
  }

  let removed = 0;
  if (options?.force) {
    removed = removeFeedEventPosts();
  }

  const existing = existingEventIds();
  const missing = FEED_EVENT_SEEDS.filter((seed) => !existing.has(seed.id));
  if (missing.length === 0 && !options?.force) {
    return { created: 0, total: countFeedEventPosts(), removed: removed || undefined };
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

  if (created > 0 || removed > 0) {
    schedulePersist();
  }
  if (created > 0) {
    console.log(
      `[msdev] ${created} événement(s) feed créé(s) (${countFeedEventPosts()}/${FEED_EVENT_SEEDS.length}, Montpellier + Paris)`
    );
  }

  return { created, total: countFeedEventPosts(), removed: removed || undefined };
}
