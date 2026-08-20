import { db, type FeedPost, type User } from './models/schema';
import { schedulePersist } from './lib/persist';
import { refreshUserPublicCoords } from './lib/locationPrivacy';

/** Publications événement sponsorisées (carte + fil) — idempotent en production. */
export const PROD_SPONSOR_EVENT_ID_PREFIX = 'prod-sponso-evt-';

export const SOLAR_FESTIVAL_SPONSOR_EVENT_ID = `${PROD_SPONSOR_EVENT_ID_PREFIX}solar-festival-2026`;
export const SOLAR_FESTIVAL_ORGANIZER_USER_ID = 'user_solar_festival';
/** Photo profil Instagram officielle (copie locale + URL source solarfestival.fr). */
export const SOLAR_FESTIVAL_ORGANIZER_AVATAR = '/sponsors/solar-festival-avatar.jpg';
export const SOLAR_FESTIVAL_ORGANIZER_USERNAME = 'Solarfestival';
/** Affichage upvotes événement Solar (baseline + votes réels). */
export const SOLAR_FESTIVAL_SPONSOR_UPVOTE_SEED = 6300;
/** Date officielle affichée (non repoussée en msdev). */
export const SOLAR_FESTIVAL_SPONSOR_EVENT_DATE = '2027-07-04T14:00:00.000Z';
export const SOLAR_FESTIVAL_SPONSOR_EVENT_CONTENT =
  'Solar Festival — 6e édition au Crès, 4 juillet 2027. Petit Biscuit, KAS:ST, The Avener… Billetterie : https://solarfestival.fr/billetterie';

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
    content: SOLAR_FESTIVAL_SPONSOR_EVENT_CONTENT,
    eventDate: SOLAR_FESTIVAL_SPONSOR_EVENT_DATE,
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
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}primavera-2026`,
    content:
      'Primavera Sound 2026 — indie & électro à Barcelone, 4–6 juin. Billetterie : https://www.primaverasound.com',
    eventDate: '2026-06-04T16:00:00.000Z',
    eventLocation: 'Parc del Fòrum, Barcelona, Spain',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}awakenings-2026`,
    content:
      'Awakenings Festival 2026 — techno à Amsterdam, 11–13 juillet. Infos : https://www.awakenings.com',
    eventDate: '2026-07-11T12:00:00.000Z',
    eventLocation: 'Spaarnwoude, Amsterdam, Netherlands',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&fit=crop',
  },
  {
    id: `${PROD_SPONSOR_EVENT_ID_PREFIX}lollapalooza-berlin-2026`,
    content:
      'Lollapalooza Berlin 2026 — Olympiastadion, 5–6 septembre. Pass : https://www.lollapaloozade.com',
    eventDate: '2026-09-05T14:00:00.000Z',
    eventLocation: 'Olympiastadion, Berlin, Germany',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&fit=crop',
  },
];

function isSponsorEventSeedEnvironment(): boolean {
  const env = process.env.APP_ENV;
  return env === 'production' || env === 'preproduction' || env === 'msdev';
}

function resolveSponsorContentAuthor(): User | undefined {
  const admins = [...db.users.values()].filter((u) => u.isAdmin);
  if (admins.length > 0) return admins[0];
  return [...db.users.values()].find((u) => u.username.toLowerCase() === 'onscen');
}

function ensureSolarFestivalOrganizerUser(): User {
  const now = Date.now();
  const existing = db.users.get(SOLAR_FESTIVAL_ORGANIZER_USER_ID);
  const user: User = {
    id: SOLAR_FESTIVAL_ORGANIZER_USER_ID,
    username: SOLAR_FESTIVAL_ORGANIZER_USERNAME,
    email: 'solarfestival@organizer.onscen.local',
    passwordHash: existing?.passwordHash ?? 'bot',
    avatarUrl: SOLAR_FESTIVAL_ORGANIZER_AVATAR,
    meloCoins: existing?.meloCoins ?? 0,
    isGhostMode: false,
    bio: existing?.bio ?? 'Solar Festival — More Music, Más Amor · @thesolarfestival',
    city: 'Le Crès, France',
    latitude: 43.6489,
    longitude: 3.9394,
    listeningRole: 'host',
    connectedPlatforms: existing?.connectedPlatforms ?? [],
    lastSeenAt: now,
    memberSince: existing?.memberSince ?? now - 180 * 86_400_000,
    accountStatus: 'active',
    ...(existing?.usernameColor ? { usernameColor: existing.usernameColor } : {}),
  };
  refreshUserPublicCoords(user);
  db.users.set(user.id, user);
  return user;
}

function resolveAuthorForSponsorSeed(seed: ProductionSponsorEventSeed, fallback: User): User {
  if (seed.id === SOLAR_FESTIVAL_SPONSOR_EVENT_ID) {
    return ensureSolarFestivalOrganizerUser();
  }
  return fallback;
}

function syncSolarFestivalSponsorPostAuthor(): boolean {
  const post = db.feedPosts.find((p) => p.id === SOLAR_FESTIVAL_SPONSOR_EVENT_ID);
  if (!post) return false;
  ensureSolarFestivalOrganizerUser();
  let changed = false;
  if (post.userId !== SOLAR_FESTIVAL_ORGANIZER_USER_ID) {
    post.userId = SOLAR_FESTIVAL_ORGANIZER_USER_ID;
    changed = true;
  }
  if (post.eventUpvoteSeed !== SOLAR_FESTIVAL_SPONSOR_UPVOTE_SEED) {
    post.eventUpvoteSeed = SOLAR_FESTIVAL_SPONSOR_UPVOTE_SEED;
    changed = true;
  }
  if (post.eventDate !== SOLAR_FESTIVAL_SPONSOR_EVENT_DATE) {
    post.eventDate = SOLAR_FESTIVAL_SPONSOR_EVENT_DATE;
    delete post.eventDates;
    delete post.eventEndTimes;
    changed = true;
  }
  if (post.content !== SOLAR_FESTIVAL_SPONSOR_EVENT_CONTENT) {
    post.content = SOLAR_FESTIVAL_SPONSOR_EVENT_CONTENT;
    changed = true;
  }
  return changed;
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

/** Événements sponsorisés carte (prod / preprod / msdev, idempotent). */
export function seedProductionSponsorEvents(): SeedProductionSponsorEventsResult {
  if (!isSponsorEventSeedEnvironment()) {
    return { created: 0, total: countProductionSponsorEvents() };
  }

  const author = resolveSponsorContentAuthor();
  if (!author) {
    return { created: 0, total: countProductionSponsorEvents(), skippedNoAuthor: true };
  }

  ensureSolarFestivalOrganizerUser();
  const migrated = syncSolarFestivalSponsorPostAuthor();

  const now = Date.now();
  let created = 0;

  for (let i = 0; i < PRODUCTION_SPONSOR_EVENT_SEEDS.length; i++) {
    const seed = PRODUCTION_SPONSOR_EVENT_SEEDS[i]!;
    const postAuthor = resolveAuthorForSponsorSeed(seed, author);
    const post: FeedPost = {
      id: seed.id,
      userId: postAuthor.id,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      isEvent: true,
      eventDate: seed.eventDate,
      eventLocation: seed.eventLocation,
      eventType: seed.eventType,
      ...(seed.id === SOLAR_FESTIVAL_SPONSOR_EVENT_ID
        ? { eventUpvoteSeed: SOLAR_FESTIVAL_SPONSOR_UPVOTE_SEED }
        : {}),
      createdAt: now - i * 3_600_000,
    };
    if (upsertSponsorEvent(post)) created += 1;
  }

  if (created > 0 || migrated) schedulePersist();

  return { created, total: countProductionSponsorEvents() };
}

/** msdev : repousse les dates seed passées pour garder des Sponso visibles en local. */
export function refreshMsdevSponsorEventDatesIfStale(): number {
  if (process.env.APP_ENV !== 'msdev') return 0;
  const ts = Date.now();
  let updated = 0;
  if (syncSolarFestivalSponsorPostAuthor()) updated += 1;
  ensureSolarFestivalOrganizerUser();
  const posts = db.feedPosts.filter(
    (p) => p.id.startsWith(PROD_SPONSOR_EVENT_ID_PREFIX) && p.isEvent
  );
  let dayOffset = 0;
  for (const post of posts) {
    if (post.id === SOLAR_FESTIVAL_SPONSOR_EVENT_ID) continue;
    const iso = post.eventDate ?? post.eventDates?.[0];
    const eventTs = iso ? Date.parse(iso) : Number.NaN;
    if (Number.isFinite(eventTs) && eventTs > ts) continue;
    const next = new Date(ts);
    next.setDate(next.getDate() + dayOffset);
    next.setHours(18, 0, 0, 0);
    post.eventDate = next.toISOString();
    delete post.eventDates;
    delete post.eventEndTimes;
    dayOffset += 1;
    updated += 1;
  }
  if (updated > 0) schedulePersist();
  return updated;
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
      `[onscen] Événements sponsorisés carte : ${events.created} créé(s) (${events.total} au total)`
    );
  } else if (events.skippedNoAuthor) {
    console.warn('[onscen] Événements sponsorisés carte ignorés — aucun compte admin trouvé');
  }
  return { events };
}
