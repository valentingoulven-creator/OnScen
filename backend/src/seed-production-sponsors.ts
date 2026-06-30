import { db, type FeedPost, type User } from './models/schema';
import { schedulePersist } from './lib/persist';

/** Publications événement sponsorisées (carte + fil) — idempotent en production. */
export const PROD_SPONSOR_EVENT_ID_PREFIX = 'prod-sponso-evt-';

export interface ProductionSponsorEventSeed {
  id: string;
  content: string;
  eventDate: string;
  eventLocation: string;
  eventType: 'dance' | 'chant' | 'autre';
  imageUrl?: string;
}

/** Festivals et billetterie réels — URLs cliquables dans le texte. */
export const PRODUCTION_SPONSOR_EVENT_SEEDS: ProductionSponsorEventSeed[] = [
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}solar-festival-2026`,
    content:
      'Solar Festival — 5e édition au Crès, 4 juillet 2026. Petit Biscuit, KAS:ST, The Avener… Billetterie : https://solarfestival.fr/billetterie',
    eventDate: '2026-07-04T14:00:00.000Z',
    eventLocation: 'Solar Festival, Le Crès, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}deferlantes-2026`,
    content:
      'Les Déferlantes 2026 — rock & chanson à Argelès-sur-Mer, 3 au 7 juillet. Billetterie : https://www.lesdeferlantes.com/billetterie',
    eventDate: '2026-07-03T15:00:00.000Z',
    eventLocation: 'Les Déferlantes, Argelès-sur-Mer, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1459749411176-827ae46c79ea?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}we-love-green-2026`,
    content:
      'We Love Green 2026 — Gorillaz, Charlotte Cardin, Mac DeMarco au Bois de Vincennes. Infos : https://www.welovegreen.fr',
    eventDate: '2026-06-05T11:00:00.000Z',
    eventLocation: 'Bois de Vincennes, Paris, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}rock-en-seine-2026`,
    content:
      'Rock en Seine 2026 — 3 jours au parc de Saint-Cloud. Line-up et pass : https://www.rockenseine.com/fr/pass',
    eventDate: '2026-08-21T12:00:00.000Z',
    eventLocation: 'Rock en Seine, Parc de Saint-Cloud, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}nuits-sonores-2026`,
    content:
      'Nuits Sonores 2026 — techno & house à Lyon, 21–24 mai. Programme : https://www.nuitssonores.com',
    eventDate: '2026-05-21T18:00:00.000Z',
    eventLocation: 'Nuits Sonores, Lyon, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&fit=crop',
  },
];

function isProductionEnvironment(): boolean {
  return process.env.APP_ENV === 'production';
}

function resolveSponsorContentAuthor(): User | undefined {
  const admins = [...db.users.values()].filter((u) => u.isAdmin);
  if (admins.length > 0) return admins[0];
  return [...db.users.values()].find((u) => u.username.toLowerCase() === 'soundy');
}

function upsertSponsorEvent(post: FeedPost): boolean {
  if (db.feedPosts.some((p) => p.id === post.id)) return false;
  db.feedPosts.push(post);
  return true;
}

export interface SeedProductionSponsorEventsResult {
  created: number;
  total: number;
  skippedNoAuthor?: boolean;
}

/** Événements sponsorisés sur la carte (production uniquement, idempotent). */
export function seedProductionSponsorEvents(): SeedProductionSponsorEventsResult {
  if (!isProductionEnvironment()) {
    return { created: 0, total: countProductionSponsorEvents() };
  }

  const author = resolveSponsorContentAuthor();
  if (!author) {
    return { created: 0, total: countProductionSponsorEvents(), skippedNoAuthor: true };
  }

  const now = Date.now();
  let created = 0;

  for (let i = 0; i < PRODUCTION_SPONSOR_EVENT_SEEDS.length; i++) {
    const seed = PRODUCTION_SPONSOR_EVENT_SEEDS[i]!;
    const post: FeedPost = {
      id: seed.id,
      userId: author.id,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      isEvent: true,
      eventDate: seed.eventDate,
      eventLocation: seed.eventLocation,
      eventType: seed.eventType,
      createdAt: now - i * 3_600_000,
    };
    if (upsertSponsorEvent(post)) created += 1;
  }

  if (created > 0) schedulePersist();

  return { created, total: countProductionSponsorEvents() };
}

export function countProductionSponsorEvents(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(PROD_SPONSOR_EVENT_ID_PREFIX)).length;
}

/** Sponsors + événements carte pour la prod (appel au démarrage). */
export function ensureProductionSponsorContent(): {
  events: SeedProductionSponsorEventsResult;
} {
  const events = seedProductionSponsorEvents();
  if (events.created > 0) {
    console.log(
      `[soundy] Événements sponsorisés carte : ${events.created} créé(s) (${events.total} au total)`
    );
  } else if (events.skippedNoAuthor) {
    console.warn('[soundy] Événements sponsorisés carte ignorés — aucun compte admin trouvé');
  }
  return { events };
}
