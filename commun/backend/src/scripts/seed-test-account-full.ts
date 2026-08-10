/**
 * Seed d'un compte de test complet en production (PostgreSQL) — demande fondateur.
 *
 * Crée un compte de démonstration (`demo_test_founder`) avec un graphe social et un
 * volume de contenu réaliste (salons, lives, événements, albums/morceaux, reels,
 * stories, publications, follows, événements sponsorisés) pour valider l'app en
 * conditions proches du réel, sans jamais toucher aux comptes/utilisateurs existants.
 *
 * Idempotent : si le compte test existe déjà (id TEST_ACCOUNT_ID), le script s'arrête
 * sans rien recréer. Utiliser FORCE=1 pour forcer une re-vérification item par item
 * (chaque insertion individuelle est elle-même protégée par un test d'existence).
 *
 * Usage sur le VPS (voir rapport dev-agent pour le détail) :
 *   cd /opt/onscen && APP_ENV=production node dist/scripts/seed-test-account-full.js
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

import {
  db,
  type FeedPost,
  type Live,
  type Salon,
  type Sponsor,
  type Story,
  type User,
  type UserAlbum,
  type UserComposition,
  type UserReel,
} from '../models/schema';
import { loadPersistedStoreAsync, usesPostgresPersistence } from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { saveSalonsLivesToPostgres } from '../lib/pgSalonsLives';
import { persistAlbumToPg } from '../lib/pgAlbums';
import { persistCompositionToPg } from '../lib/pgCompositions';
import { persistReelToPg } from '../lib/pgReels';
import { followUser } from '../lib/follows';
import { blurCoordinate } from '../lib/geo';
import { refreshUserPublicCoords } from '../lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from '../lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from '../lib/musicLinks';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import { SALON_LIVE_ID_PREFIX } from '../seed-salons-lives';
import { POPULATED_CITIES, type PopulatedCity } from '../lib/botPopulatedCities';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Constantes / identifiants
// ─────────────────────────────────────────────────────────────────────────────

const TEST_ACCOUNT_ID = 'demo-test-founder';
const TEST_ACCOUNT_USERNAME = 'demo_test_founder';
const TEST_ACCOUNT_EMAIL = 'demo.test.founder@getonscen-demo.local';
const SPONSOR_AUTHOR_EMAIL = 'admin@getsoundy.com';

const NOW = Date.now();
const DAY_MS = 86_400_000;
const TWO_MONTHS_MS = 60 * DAY_MS;

function cityByName(name: string): PopulatedCity {
  const city = POPULATED_CITIES.find((c) => c.name === name);
  if (!city) throw new Error(`Ville inconnue dans POPULATED_CITIES: ${name}`);
  return city;
}

/** Léger jitter (~±5km) pour ne pas empiler plusieurs entités au même point exact. */
function jitter(coord: number): number {
  return coord + (Math.random() - 0.5) * 0.09;
}

/** Timestamp aléatoire réparti sur les 2 derniers mois (posts/stories/reels/events). */
function pastTimestampInWindow(): number {
  return NOW - Math.floor(Math.random() * TWO_MONTHS_MS);
}

/** Timestamp récent (< 20h) — nécessaire pour les stories (TTL 24h, doivent rester actives). */
function recentStoryTimestamp(): number {
  return NOW - Math.floor(Math.random() * 20 * 60 * 60 * 1000);
}

/** Date d'événement à venir (1 à N jours dans le futur) pour rester visible sur la carte. */
function futureEventDateIso(maxDays: number): string {
  const daysAhead = 1 + Math.floor(Math.random() * maxDays);
  const hour = 15 + Math.floor(Math.random() * 8);
  const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  const d = new Date(NOW + daysAhead * DAY_MS);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pools de contenu (réutilisés par index pour varier sans surcharger le script)
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Léa', 'Hugo', 'Chloé', 'Nathan', 'Manon', 'Lucas', 'Camille', 'Louis',
  'Zoé', 'Adam', 'Inès', 'Théo', 'Emma', 'Noah', 'Jade', 'Gabriel', 'Lina',
  'Raphaël', 'Anna', 'Maël', 'Sarah', 'Tom', 'Nina', 'Ethan', 'Louise',
  'Enzo', 'Léna', 'Arthur', 'Julia', 'Mattéo',
];

const GENRES_POOL = [
  ['Électro', 'House', 'Techno'],
  ['Pop', 'Indie', 'Rock'],
  ['Hip-Hop', 'Rap', 'R&B'],
  ['Jazz', 'Soul', 'Funk'],
  ['Deep House', 'French Touch', 'Disco'],
  ['Lo-Fi', 'Ambient', 'Chill'],
  ['Reggae', 'Latin', 'World'],
  ['Metal', 'Punk', 'Alternative'],
];

const YOUTUBE_TRACKS = [
  { title: 'Get Lucky', artist: 'Daft Punk', trackId: '5NV6RXX0i0I' },
  { title: 'Strobe', artist: 'deadmau5', trackId: 'jfaD3P3N0v4' },
  { title: 'Midnight City', artist: 'M83', trackId: 'dX3kQ8LZX0g' },
  { title: 'Uptown Funk', artist: 'Bruno Mars', trackId: 'OPf0YbXqDm0' },
  { title: 'Levitating', artist: 'Dua Lipa', trackId: 'TUVcZfQea-Y' },
  { title: 'One More Time', artist: 'Daft Punk', trackId: 'FGBhQbmrHQQ' },
];

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=700',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=700',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=700',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=700',
  'https://images.unsplash.com/photo-1506157786151-6c9def9644a5?w=700',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=700',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=700',
];

const POST_CONTENT_TEMPLATES = [
  (n: string) => `${n} vient de découvrir un son incroyable ce matin ☕🎧`,
  (n: string) => `${n} : soirée écoute partagée, qui se joint ? 🎶`,
  (n: string) => `${n} a mis à jour sa playlist du moment, dites-moi ce que vous en pensez !`,
  (n: string) => `${n} : premier son posté sur OnScen, hâte de vos retours 🔥`,
  (n: string) => `${n} cherche des recos d'artistes locaux, des idées ?`,
  (n: string) => `${n} : ambiance parfaite pour un dimanche pluvieux 🌧️🎵`,
  (n: string) => `${n} a repéré un super salon d'écoute hier soir, on remet ça bientôt`,
  (n: string) => `${n} : nouvelle découverte, ce morceau tourne en boucle depuis hier`,
];

const EVENT_VENUE_SUFFIXES_FR = [
  'Salle des Fêtes', 'Le Rockstore', "L'Olympia", 'Place de la Comédie',
  'Le Point Ephémère', 'La Bellevilloise', 'Le Bikini', 'Le Sucre',
];

const EVENT_VENUE_SUFFIXES_WORLD = [
  'Music Hall', 'Open Air Stage', 'Jazz Club', 'Arena', 'Rooftop Sessions',
  'Underground', 'Festival Grounds', 'Concert Hall', 'Warehouse Sessions',
];

const EVENT_CONTENT_TEMPLATES_FR = [
  (city: string, venue: string) => `Soirée live à ${venue} — découvertes locales et sets invités à ${city}.`,
  (city: string, venue: string) => `Session acoustique intimiste au ${venue} — chanson et reprises à ${city}.`,
  (city: string, venue: string) => `Nuit électro au ${venue} (${city}) : house, techno et visuels.`,
  (city: string, venue: string) => `Jam communautaire OnScen — ${venue}, ${city}. Venez avec votre instrument !`,
];

const EVENT_CONTENT_TEMPLATES_WORLD = [
  (city: string, venue: string) => `Live session at ${venue}, ${city} — local artists & special guests.`,
  (city: string, venue: string) => `Open air night at ${venue} (${city}): house, techno & visuals.`,
  (city: string, venue: string) => `Community jam — ${venue}, ${city}. Bring your instrument!`,
  (city: string, venue: string) => `Acoustic set at ${venue}, ${city} — intimate covers & originals.`,
];

const STORY_CONTENT_SAMPLES = [
  'En écoute là maintenant 🎵',
  'Petite découverte du jour ✨',
  'Ambiance parfaite pour la journée ☕',
  'Session chill en cours 🎧',
  'Qui écoute la même chose que moi ? 👂',
  'Bonne vibe ce soir 🎉',
];

const BIO_TEMPLATES = [
  (g: string) => `Passionné(e) de ${g}, toujours à la recherche de nouveaux sons.`,
  (g: string) => `${g} avant tout. Ouvert(e) aux découvertes et collabs.`,
  (g: string) => `Fan de ${g}, j'écoute de tout selon l'humeur du moment.`,
];

/** Villes monde (hors France) pour les 30 événements non suivis — répartition multi-continents. */
const WORLD_EVENT_CITY_NAMES = [
  'Tokyo', 'Seoul', 'Bangkok', 'Singapore', 'Mumbai', 'Jakarta', 'Manila', 'Dubai',
  'London', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Lisbon', 'Athens', 'Warsaw',
  'Stockholm', 'Zurich', 'New York', 'Los Angeles', 'Toronto', 'Mexico City',
  'São Paulo', 'Buenos Aires', 'Bogotá', 'Lagos', 'Cape Town', 'Casablanca',
  'Nairobi', 'Sydney',
];

/** Villes monde (hors France) pour les 17 événements sponsorisés internationaux. */
const SPONSOR_WORLD_CITY_NAMES = [
  'Osaka', 'Hong Kong', 'Kuala Lumpur', 'Istanbul', 'Barcelona', 'Munich', 'Vienna',
  'Dublin', 'Copenhagen', 'Chicago', 'Miami', 'Vancouver', 'Montreal',
  'Rio de Janeiro', 'Santiago', 'Johannesburg', 'Auckland',
];

const SPONSOR_FRANCE_CITY_NAMES = ['Paris', 'Lyon', 'Marseille'];

/** Pool audio réel (12 fichiers ~180s générés via ffmpeg, déployés sur le VPS avant exécution). */
const AUDIO_FILE_COUNT = 12;
function audioFileUrl(i: number): string {
  return `/uploads/compositions/demo-seed-track-${pad2((i % AUDIO_FILE_COUNT) + 1)}.mp3`;
}

const TRACK_TITLES = [
  'Horizon', 'Nuit Blanche', 'Vagues', 'Éclipse', 'Mirage', 'Écho', 'Reflets',
  'Latitude', 'Signal', 'Aurore', 'Dérive', 'Fragments', 'Constellation', 'Prisme',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de construction d'entités
// ─────────────────────────────────────────────────────────────────────────────

function findUserByEmail(email: string): User | undefined {
  return [...db.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function makeBotUser(opts: {
  id: string;
  username: string;
  city: string;
  lat: number;
  lng: number;
  genres: string[];
  bio?: string;
  createdAt?: number;
}): User {
  const memberSince = opts.createdAt ?? pastTimestampInWindow();
  const user: User = {
    id: opts.id,
    username: opts.username,
    email: `${opts.id}@demo.getonscen-seed.local`,
    passwordHash: 'demo-seed-account',
    avatarUrl: dicebearAdventurerAvatar(opts.id),
    meloCoins: 0,
    isGhostMode: false,
    bio: opts.bio,
    favoriteGenres: opts.genres,
    city: opts.city,
    listeningRole: 'les_deux',
    connectedPlatforms: ['youtube'],
    latitude: opts.lat,
    longitude: opts.lng,
    lastSeenAt: NOW - Math.floor(Math.random() * 3 * DAY_MS),
    memberSince,
    accountStatus: 'active',
    emailVerified: true,
    onboardingCompleted: true,
    acceptedTermsAt: memberSince,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
  };
  refreshUserPublicCoords(user);
  return user;
}

function ensureBotUser(opts: Parameters<typeof makeBotUser>[0]): { user: User; created: boolean } {
  const existing = db.users.get(opts.id);
  if (existing) return { user: existing, created: false };
  const user = makeBotUser(opts);
  db.users.set(user.id, user);
  return { user, created: true };
}

function stableProgressMs(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 20_000 + (Math.abs(h) % 160_000);
}

function ensureSalon(id: string, host: User, title: string, lat: number, lng: number): { salon: Salon; created: boolean } {
  const existing = db.salons.get(id);
  if (existing) return { salon: existing, created: false };
  const track = pick(YOUTUBE_TRACKS, stableProgressMs(id));
  const progressMs = stableProgressMs(id);
  const salon: Salon = {
    id,
    hostId: host.id,
    hostName: host.username,
    hostAvatarUrl: host.avatarUrl,
    title,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      albumArtUrl: `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs,
      updatedAt: NOW,
      startedAt: NOW - progressMs,
      externalUrl: buildPlatformTrackUrl('youtube', track.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    listenersCount: 4 + (stableProgressMs(id) % 24),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [host.id],
    allowQueue: true,
    createdAt: NOW - (stableProgressMs(id) % (6 * 3_600_000)),
  };
  db.salons.set(id, salon);
  ensureSalonQueue(id);
  ensureSalonProposals(id);
  if (!db.salonChats.has(id)) db.salonChats.set(id, []);
  return { salon, created: true };
}

function ensureLive(id: string, host: User, title: string, lat: number, lng: number, salonId?: string): { live: Live; created: boolean } {
  const existing = db.lives.get(id);
  if (existing) return { live: existing, created: false };
  const track = pick(YOUTUBE_TRACKS, stableProgressMs(id) + 1);
  const progressMs = stableProgressMs(id);
  const live: Live = {
    id,
    ...(salonId ? { salonId } : {}),
    hostId: host.id,
    hostName: host.username,
    title,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      albumArtUrl: `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs,
      updatedAt: NOW,
      startedAt: NOW - progressMs,
      externalUrl: buildPlatformTrackUrl('youtube', track.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    viewersCount: 6 + (stableProgressMs(id) % 40),
    isActive: true,
    startedAt: NOW - 600_000 - (stableProgressMs(id) % 1_800_000),
    cameraActive: true,
  };
  db.lives.set(id, live);
  if (!db.liveChats.has(id)) db.liveChats.set(id, []);
  return { live, created: true };
}

function ensureFeedPost(post: FeedPost): boolean {
  if (db.feedPosts.some((p) => p.id === post.id)) return false;
  db.feedPosts.push(post);
  return true;
}

function ensureStory(story: Story): boolean {
  if (db.stories.some((s) => s.id === story.id)) return false;
  db.stories.push(story);
  return true;
}

function ensureReel(reel: UserReel): boolean {
  if (db.userReels.some((r) => r.id === reel.id)) return false;
  db.userReels.push(reel);
  return true;
}

function ensureAlbum(album: UserAlbum): boolean {
  if (db.albums.some((a) => a.id === album.id)) return false;
  db.albums.push(album);
  return true;
}

function ensureComposition(comp: UserComposition): boolean {
  if (db.compositions.some((c) => c.id === comp.id)) return false;
  db.compositions.push(comp);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

interface Summary {
  testAccount: { id: string; username: string; email: string };
  generatedPassword: string;
  counts: Record<string, number>;
  followedUserIds: string[];
  reelMix: { testAccount: number; followedAuthors: number; notFollowedAuthors: number };
  notes: string[];
}

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed compte test production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const notes: string[] = [];

  if (db.users.has(TEST_ACCOUNT_ID)) {
    console.log(
      `[seed-test-account] Le compte test ${TEST_ACCOUNT_ID} existe déjà — script déjà exécuté, aucune action.`
    );
    console.log(
      '[seed-test-account] Pour re-générer un mot de passe ou ajouter du contenu, supprimer le compte ou adapter le script.'
    );
    return;
  }

  const sponsorAuthor = findUserByEmail(SPONSOR_AUTHOR_EMAIL);
  if (!sponsorAuthor) {
    throw new Error(`Auteur sponsor introuvable (${SPONSOR_AUTHOR_EMAIL}) — événements sponsorisés annulés`);
  }

  // ── Compte de test ──────────────────────────────────────────────────────
  const plainPassword = `OnScen-${crypto.randomBytes(9).toString('base64url')}!`;
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const parisCity = cityByName('Paris');
  const testAccount: User = {
    id: TEST_ACCOUNT_ID,
    username: TEST_ACCOUNT_USERNAME,
    email: TEST_ACCOUNT_EMAIL,
    passwordHash,
    avatarUrl: dicebearAdventurerAvatar(TEST_ACCOUNT_ID),
    meloCoins: 500,
    isGhostMode: false,
    bio: 'Compte de démonstration OnScen — contenu de test pour valider les parcours produit.',
    favoriteGenres: ['Électro', 'Pop', 'Hip-Hop'],
    city: 'Paris, France',
    listeningRole: 'les_deux',
    connectedPlatforms: ['youtube'],
    latitude: jitter(parisCity.lat),
    longitude: jitter(parisCity.lon),
    lastSeenAt: NOW,
    memberSince: NOW - TWO_MONTHS_MS,
    accountStatus: 'active',
    emailVerified: true,
    onboardingCompleted: true,
    acceptedTermsAt: NOW - TWO_MONTHS_MS,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    age: 29,
    relationshipStatus: 'celibataire',
  };
  refreshUserPublicCoords(testAccount);
  db.users.set(testAccount.id, testAccount);

  const followedIds = new Set<string>();
  const counts: Record<string, number> = {
    salonsCreated: 0,
    livesCreated: 0,
    followedEventsCreated: 0,
    testCreatedEventsCreated: 0,
    worldEventsNotFollowedCreated: 0,
    sponsoredEventsCreated: 0,
    sponsorsCreated: 0,
    postsFollowedAuthorsCreated: 0,
    postsNotFollowedAuthorsCreated: 0,
    postsTestAccountCreated: 0,
    storiesFollowedCreated: 0,
    storiesNotFollowedCreated: 0,
    reelsTestAccountCreated: 0,
    reelsFollowedAuthorsCreated: 0,
    reelsNotFollowedAuthorsCreated: 0,
    albumsTestAccountCreated: 0,
    tracksTestAccountCreated: 0,
    albumsOtherUsersCreated: 0,
    tracksOtherUsersCreated: 0,
    botUsersCreated: 0,
  };

  let botUsersCreated = 0;
  function trackedEnsureBotUser(opts: Parameters<typeof ensureBotUser>[0]): User {
    const { user, created } = ensureBotUser(opts);
    if (created) botUsersCreated++;
    return user;
  }

  // ── 1a. 5 salons suivis (hôtes dédiés) ──────────────────────────────────
  for (let i = 1; i <= 5; i++) {
    const city = pick(POPULATED_CITIES.filter((c) => c.name !== 'Paris'), i * 7);
    const id = `demo-fhost-salon-${pad2(i)}`;
    const host = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i)}_Salon${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i),
      bio: pick(BIO_TEMPLATES, i)(pick(GENRES_POOL, i)[0]!),
    });
    followedIds.add(host.id);
    const { created } = ensureSalon(
      `${SALON_LIVE_ID_PREFIX}demo-salon-${pad2(i)}`,
      host,
      `${pick(GENRES_POOL, i)[0]} Session — ${city.name}`,
      host.latitude!,
      host.longitude!
    );
    if (created) counts.salonsCreated++;
  }

  // ── 1b. 5 lives suivis (hôtes dédiés) ───────────────────────────────────
  for (let i = 1; i <= 5; i++) {
    const city = pick(POPULATED_CITIES.filter((c) => c.name !== 'Paris'), i * 11 + 3);
    const id = `demo-fhost-live-${pad2(i)}`;
    const host = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 5)}_Live${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 3),
      bio: pick(BIO_TEMPLATES, i + 1)(pick(GENRES_POOL, i + 3)[0]!),
    });
    followedIds.add(host.id);
    const { created } = ensureLive(
      `${SALON_LIVE_ID_PREFIX}demo-live-${pad2(i)}`,
      host,
      `Live Stream — ${city.name}`,
      host.latitude!,
      host.longitude!
    );
    if (created) counts.livesCreated++;
  }

  // ── 1c. 4 événements suivis (auteurs dédiés, en France) ─────────────────
  const followedEventCities = ['Paris', 'Lyon', 'Marseille', 'Bordeaux'];
  for (let i = 1; i <= 4; i++) {
    const cityName = followedEventCities[i - 1]!;
    const city = cityByName(cityName);
    const id = `demo-fhost-event-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 10)}_Events${pad2(i)}`,
      city: `${cityName}, France`,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 4),
    });
    followedIds.add(author.id);
    const venue = pick(EVENT_VENUE_SUFFIXES_FR, i);
    const postId = `demo-evt-followed-${pad2(i)}`;
    const created = ensureFeedPost({
      id: postId,
      userId: author.id,
      content: pick(EVENT_CONTENT_TEMPLATES_FR, i)(cityName, venue),
      imageUrl: pick(UNSPLASH_IMAGES, i),
      isEvent: true,
      eventDate: futureEventDateIso(60),
      eventLocation: `${venue}, ${cityName}`,
      eventType: pick(['dance', 'chant', 'autre'] as const, i),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.followedEventsCreated++;
  }

  // ── F: 5 auteurs de stories suivis (font partie des 30 stories, point 8) ─
  for (let i = 1; i <= 5; i++) {
    const city = pick(POPULATED_CITIES, i * 13 + 1);
    const id = `demo-fhost-story-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 14)}_Story${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 5),
    });
    followedIds.add(author.id);
    const createdAt = recentStoryTimestamp();
    const created = ensureStory({
      id: `demo-story-followed-${pad2(i)}`,
      userId: author.id,
      content: pick(STORY_CONTENT_SAMPLES, i),
      imageUrl: pick(UNSPLASH_IMAGES, i + 2),
      createdAt,
      expiresAt: createdAt + 24 * 3_600_000,
      visibility: 'followers',
    });
    if (created) counts.storiesFollowedCreated++;
  }

  // ── F: 20 auteurs suivis, 1 publication chacun (point 9 — 20 posts suivis) ─
  const followedPostAuthorIds: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const city = pick(POPULATED_CITIES, i * 5 + 2);
    const id = `demo-fhost-post-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 19)}${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 6),
    });
    followedIds.add(author.id);
    followedPostAuthorIds.push(author.id);
    const created = ensureFeedPost({
      id: `demo-post-followed-${pad2(i)}`,
      userId: author.id,
      content: pick(POST_CONTENT_TEMPLATES, i)(author.username),
      ...(i % 2 === 0 ? { imageUrl: pick(UNSPLASH_IMAGES, i) } : {}),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.postsFollowedAuthorsCreated++;
  }

  // ── 40 utilisateurs "albums" (point 4) — 15 premiers suivis, 25 non suivis ─
  const albumUserIds: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const city = pick(POPULATED_CITIES, i * 3 + 9);
    const id = `demo-albumuser-${pad2(i)}`;
    const followed = i <= 15;
    const user = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 29)}${pad2(i)}Music`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 7),
      bio: pick(BIO_TEMPLATES, i)(pick(GENRES_POOL, i + 7)[0]!),
    });
    albumUserIds.push(user.id);
    if (followed) followedIds.add(user.id);

    const albumId = `demo-album-${pad2(i)}`;
    const albumCreatedAt = pastTimestampInWindow();
    const albumCreated = ensureAlbum({
      id: albumId,
      userId: user.id,
      title: `${pick(GENRES_POOL, i + 7)[0]} Sessions`,
      description: `Sélection ${pick(GENRES_POOL, i + 7)[0]!.toLowerCase()} de ${user.username}.`,
      createdAt: albumCreatedAt,
      updatedAt: albumCreatedAt,
    });
    if (albumCreated) {
      counts.albumsOtherUsersCreated++;
    }

    for (let t = 1; t <= 2; t++) {
      const compId = `demo-track-${pad2(i)}-${t}`;
      const trackCreatedAt = albumCreatedAt + t * 60_000;
      const compCreated = ensureComposition({
        id: compId,
        userId: user.id,
        albumId,
        title: pick(TRACK_TITLES, i * 2 + t),
        artist: user.username,
        fileUrl: audioFileUrl(i * 2 + t),
        durationSec: 180,
        createdAt: trackCreatedAt,
      });
      if (compCreated) {
        counts.tracksOtherUsersCreated++;
      }
    }
  }

  // ── 40 auteurs NON suivis, 1 publication chacun (point 9 — 40 posts non suivis) ─
  const notFollowedPostAuthorIds: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const city = pick(POPULATED_CITIES, i * 4 + 17);
    const id = `demo-nfhost-post-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 2)}NF${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 1),
    });
    notFollowedPostAuthorIds.push(author.id);
    const created = ensureFeedPost({
      id: `demo-post-notfollowed-${pad2(i)}`,
      userId: author.id,
      content: pick(POST_CONTENT_TEMPLATES, i + 3)(author.username),
      ...(i % 3 === 0 ? { imageUrl: pick(UNSPLASH_IMAGES, i + 1) } : {}),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.postsNotFollowedAuthorsCreated++;
  }

  // ── 25 auteurs de stories NON suivis (point 8 — complète les 30 stories) ─
  for (let i = 1; i <= 25; i++) {
    const city = pick(POPULATED_CITIES, i * 6 + 21);
    const id = `demo-nfhost-story-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 8)}St${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 2),
    });
    const createdAt = recentStoryTimestamp();
    const created = ensureStory({
      id: `demo-story-notfollowed-${pad2(i)}`,
      userId: author.id,
      content: pick(STORY_CONTENT_SAMPLES, i + 1),
      imageUrl: pick(UNSPLASH_IMAGES, i + 3),
      createdAt,
      expiresAt: createdAt + 24 * 3_600_000,
      visibility: 'followers',
    });
    if (created) counts.storiesNotFollowedCreated++;
  }

  // ── 30 événements monde NON suivis (point 2) ────────────────────────────
  for (let i = 1; i <= 30; i++) {
    const cityName = WORLD_EVENT_CITY_NAMES[i - 1]!;
    const city = cityByName(cityName);
    const id = `demo-nfhost-worldevent-${pad2(i)}`;
    const author = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 12)}W${pad2(i)}`,
      city: cityName,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i),
    });
    const venue = pick(EVENT_VENUE_SUFFIXES_WORLD, i);
    const created = ensureFeedPost({
      id: `demo-evt-world-${pad2(i)}`,
      userId: author.id,
      content: pick(EVENT_CONTENT_TEMPLATES_WORLD, i)(cityName, venue),
      imageUrl: pick(UNSPLASH_IMAGES, i + 4),
      isEvent: true,
      eventDate: futureEventDateIso(90),
      eventLocation: `${venue}, ${cityName}`,
      eventType: pick(['dance', 'chant', 'autre'] as const, i + 1),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.worldEventsNotFollowedCreated++;
  }

  // ── 46 abonnements génériques restants (complète les 100 suivis) ───────
  const genericFollowedCount = 100 - followedIds.size;
  for (let i = 1; i <= genericFollowedCount; i++) {
    const city = pick(POPULATED_CITIES, i * 9 + 5);
    const id = `demo-fhost-generic-${pad2(i)}`;
    const user = trackedEnsureBotUser({
      id,
      username: `${pick(FIRST_NAMES, i + 17)}Fan${pad2(i)}`,
      city: city.name,
      lat: jitter(city.lat),
      lng: jitter(city.lon),
      genres: pick(GENRES_POOL, i + 3),
      bio: pick(BIO_TEMPLATES, i + 2)(pick(GENRES_POOL, i + 3)[0]!),
    });
    followedIds.add(user.id);
  }

  // ── Compte test : 10 événements créés (point 6) — mix France / monde ────
  const testEventCities = [
    { name: 'Paris', country: 'France' },
    { name: 'Lyon', country: 'France' },
    { name: 'Marseille', country: 'France' },
    { name: 'Bordeaux', country: 'France' },
    { name: 'London', country: null },
    { name: 'Berlin', country: null },
    { name: 'New York', country: null },
    { name: 'Tokyo', country: null },
    { name: 'Barcelona', country: null },
    { name: 'Amsterdam', country: null },
  ];
  for (let i = 1; i <= 10; i++) {
    const cfg = testEventCities[i - 1]!;
    const isFrance = cfg.country === 'France';
    const venue = isFrance ? pick(EVENT_VENUE_SUFFIXES_FR, i) : pick(EVENT_VENUE_SUFFIXES_WORLD, i);
    const label = isFrance ? `${cfg.name}, France` : cfg.name;
    const templates = isFrance ? EVENT_CONTENT_TEMPLATES_FR : EVENT_CONTENT_TEMPLATES_WORLD;
    const created = ensureFeedPost({
      id: `demo-evt-test-${pad2(i)}`,
      userId: testAccount.id,
      content: pick(templates, i)(cfg.name, venue),
      imageUrl: pick(UNSPLASH_IMAGES, i + 5),
      isEvent: true,
      eventDate: futureEventDateIso(75),
      eventLocation: isFrance ? `${venue}, ${cfg.name}` : `${venue}, ${label}`,
      eventType: pick(['dance', 'chant', 'autre'] as const, i + 2),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.testCreatedEventsCreated++;
  }

  // ── Compte test : 20 publications (point 9 — dernier tiers des 80) ──────
  for (let i = 1; i <= 20; i++) {
    const created = ensureFeedPost({
      id: `demo-post-test-${pad2(i)}`,
      userId: testAccount.id,
      content: pick(POST_CONTENT_TEMPLATES, i + 6)(testAccount.username),
      ...(i % 2 === 0 ? { imageUrl: pick(UNSPLASH_IMAGES, i + 6) } : {}),
      createdAt: pastTimestampInWindow(),
    });
    if (created) counts.postsTestAccountCreated++;
  }

  // ── Compte test : 2 albums × 3 sons de 3 min (point 3) ──────────────────
  for (let a = 1; a <= 2; a++) {
    const albumId = `demo-album-test-${pad2(a)}`;
    const albumCreatedAt = pastTimestampInWindow();
    const albumCreated = ensureAlbum({
      id: albumId,
      userId: testAccount.id,
      title: a === 1 ? 'Sessions Studio' : 'Compositions Live',
      description: a === 1 ? 'Mes premières compositions OnScen.' : 'Extraits enregistrés en live.',
      createdAt: albumCreatedAt,
      updatedAt: albumCreatedAt,
    });
    if (albumCreated) {
      counts.albumsTestAccountCreated++;
    }
    for (let t = 1; t <= 3; t++) {
      const compId = `demo-track-test-${pad2(a)}-${t}`;
      const trackCreatedAt = albumCreatedAt + t * 60_000;
      const compCreated = ensureComposition({
        id: compId,
        userId: testAccount.id,
        albumId,
        title: pick(TRACK_TITLES, a * 3 + t),
        artist: testAccount.username,
        fileUrl: audioFileUrl(a * 3 + t + 40),
        durationSec: 180,
        createdAt: trackCreatedAt,
      });
      if (compCreated) {
        counts.tracksTestAccountCreated++;
      }
    }
  }

  // ── 10 reels — mix documenté : 3 compte test, 4 auteurs suivis, 3 non suivis ─
  for (let i = 1; i <= 3; i++) {
    const reelId = `demo-reel-test-${pad2(i)}`;
    const created = ensureReel({
      id: reelId,
      title: pick(TRACK_TITLES, i + 20),
      artist: testAccount.username,
      genre: pick(GENRES_POOL, i)[0]!,
      mediaType: 'image',
      posterUrl: pick(UNSPLASH_IMAGES, i + 2),
      authorId: testAccount.id,
      createdAt: pastTimestampInWindow(),
      visibility: 'public',
    });
    if (created) {
      counts.reelsTestAccountCreated++;
    }
  }
  for (let i = 1; i <= 4; i++) {
    const authorId = followedPostAuthorIds[i - 1]!;
    const author = db.users.get(authorId)!;
    const reelId = `demo-reel-followed-${pad2(i)}`;
    const created = ensureReel({
      id: reelId,
      title: pick(TRACK_TITLES, i + 25),
      artist: author.username,
      genre: pick(GENRES_POOL, i + 1)[0]!,
      mediaType: 'image',
      posterUrl: pick(UNSPLASH_IMAGES, i + 3),
      authorId: author.id,
      createdAt: pastTimestampInWindow(),
      visibility: 'public',
    });
    if (created) {
      counts.reelsFollowedAuthorsCreated++;
    }
  }
  for (let i = 1; i <= 3; i++) {
    const authorId = notFollowedPostAuthorIds[i - 1]!;
    const author = db.users.get(authorId)!;
    const reelId = `demo-reel-notfollowed-${pad2(i)}`;
    const created = ensureReel({
      id: reelId,
      title: pick(TRACK_TITLES, i + 29),
      artist: author.username,
      genre: pick(GENRES_POOL, i + 2)[0]!,
      mediaType: 'image',
      posterUrl: pick(UNSPLASH_IMAGES, i + 4),
      authorId: author.id,
      createdAt: pastTimestampInWindow(),
      visibility: 'public',
    });
    if (created) {
      counts.reelsNotFollowedAuthorsCreated++;
    }
  }

  // ── 20 événements sponsorisés monde (point 10) — 3 France + 17 monde ────
  const sponsorSeeds: Array<{ cityName: string; isFrance: boolean }> = [
    ...SPONSOR_FRANCE_CITY_NAMES.map((c) => ({ cityName: c, isFrance: true })),
    ...SPONSOR_WORLD_CITY_NAMES.map((c) => ({ cityName: c, isFrance: false })),
  ];
  for (let i = 1; i <= sponsorSeeds.length; i++) {
    const seed = sponsorSeeds[i - 1]!;
    const venue = seed.isFrance ? pick(EVENT_VENUE_SUFFIXES_FR, i) : pick(EVENT_VENUE_SUFFIXES_WORLD, i);
    const label = seed.isFrance ? `${seed.cityName}, France` : seed.cityName;
    const templates = seed.isFrance ? EVENT_CONTENT_TEMPLATES_FR : EVENT_CONTENT_TEMPLATES_WORLD;
    const postId = `demo-sponso-evt-${pad2(i)}`;
    const postCreated = ensureFeedPost({
      id: postId,
      userId: sponsorAuthor.id,
      content: `[Sponsorisé] ${templates[i % templates.length]!(seed.cityName, venue)}`,
      imageUrl: pick(UNSPLASH_IMAGES, i + 5),
      isEvent: true,
      eventDate: futureEventDateIso(110),
      eventLocation: `${venue}, ${label}`,
      eventType: pick(['dance', 'chant', 'autre'] as const, i + 3),
      createdAt: NOW - i * 3_600_000,
    });
    if (postCreated) counts.sponsoredEventsCreated++;

    const sponsorId = `demo-sponso-sponsor-${pad2(i)}`;
    if (!db.sponsors.some((s) => s.id === sponsorId)) {
      const ts = NOW - i * 3_600_000;
      const sponsor: Sponsor = {
        id: sponsorId,
        name: `${venue} — ${seed.cityName}`,
        placement: 'map_sidebar_events',
        linkedEventPostId: postId,
        active: true,
        priority: 100 + i,
        title: `${venue} — ${seed.cityName}`,
        subtitle: 'Événement sponsorisé',
        cta: 'Voir',
        kind: 'sponsored',
        createdAt: ts,
        updatedAt: ts,
      };
      db.sponsors.push(sponsor);
      counts.sponsorsCreated++;
    }
  }

  // ── Follows : compte test → 100 utilisateurs (point 5) ──────────────────
  // NB : le schéma (userFollows: Map<string, Set<string>>) ne stocke pas de date
  // de création par relation de suivi — impossible d'étaler ces timestamps sans
  // migration de schéma (hors périmètre de ce script, voir rapport).
  for (const id of followedIds) {
    followUser(testAccount.id, id);
  }

  counts.botUsersCreated = botUsersCreated;

  // ── Persistance ──────────────────────────────────────────────────────────
  // IMPORTANT : les utilisateurs doivent être persistés en premier — user_reels
  // porte une FK (NOT VALID mais appliquée aux nouvelles lignes, migration 029)
  // vers users(id). albums/compositions/reels sont donc persistés APRÈS le
  // store principal (qui upsert tous les users), jamais avant.
  console.log('[seed-test-account] Persistance PostgreSQL (store principal : users, follows, posts, stories, sponsors)…');
  await savePersistedStoreToPostgres();
  console.log('[seed-test-account] Persistance salons/lives…');
  const salonsLives = await saveSalonsLivesToPostgres();

  console.log(`[seed-test-account] Persistance ${db.albums.length} album(s)…`);
  for (const album of db.albums) {
    await persistAlbumToPg(album);
  }
  console.log(`[seed-test-account] Persistance ${db.compositions.length} composition(s)…`);
  for (const composition of db.compositions) {
    await persistCompositionToPg(composition);
  }
  console.log(`[seed-test-account] Persistance ${db.userReels.length} reel(s)…`);
  for (const reel of db.userReels) {
    await persistReelToPg(reel);
  }

  if (followedIds.size !== 100) {
    notes.push(
      `Attention : ${followedIds.size} utilisateurs suivis au lieu de 100 attendus (vérifier chevauchements d'ids).`
    );
  }
  notes.push(
    'Reels : mix documenté = 3 publiés par le compte test, 4 par des utilisateurs suivis, 3 par des utilisateurs non suivis (10 au total).'
  );
  notes.push(
    "Interprétation « le compte test suit 5 salons / 5 lives / 4 events » : le modèle de données OnScen ne propose pas de suivi direct d'un salon/live/event (uniquement user→user). Le compte test suit donc l'hôte/auteur de chacun de ces 5+5+4 contenus, qui apparaissent ainsi dans son flux « Suivi »."
  );
  notes.push(
    'Stories : timestamps de création concentrés sur les dernières 20h (et non étalés sur 2 mois) car le TTL story est de 24h — un étalement sur 2 mois aurait rendu toutes les stories déjà expirées et invisibles.'
  );
  notes.push(
    "Morceaux audio : fichiers MP3 réels de 180s (tonalités générées, réutilisés en pool de 12 fichiers distincts) déployés manuellement sur le VPS sous public/uploads/compositions/ avant exécution du script — pas de génération de contenu audio original."
  );
  notes.push(
    "Reels : mediaType 'image' (posterUrl Unsplash) pour tous les reels seed — évite d'héberger des fichiers vidéo factices ; conforme au schéma (UserReel.mediaType accepte 'image')."
  );

  const summary: Summary = {
    testAccount: { id: testAccount.id, username: testAccount.username, email: testAccount.email },
    generatedPassword: plainPassword,
    counts: { ...counts, salonsPersisted: salonsLives.salons, livesPersisted: salonsLives.lives },
    followedUserIds: [...followedIds],
    reelMix: { testAccount: 3, followedAuthors: 4, notFollowedAuthors: 3 },
    notes,
  };

  console.log('\n=== SEED COMPTE TEST COMPLET — TERMINÉ ===\n');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('[seed-test-account] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
