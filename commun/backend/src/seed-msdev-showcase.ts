import { blurCoordinate, destinationPointKm } from './lib/geo';

import { refreshUserPublicCoords } from './lib/locationPrivacy';

import { buildPlatformTrackUrl } from './lib/musicLinks';

import { followUser, getFollowingIds, unfollowUser } from './lib/follows';

import { addFavorite, isFavorite } from './lib/favorites';

import { schedulePersist } from './lib/persist';

import { DEMO_REELS } from './lib/reels';

import { invalidateReelsFeedCache } from './lib/reelFeedCache';

import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';

import {

  db,

  type FeedPost,

  type Live,

  type Salon,

  type User,

  type UserAlbum,

  type UserComposition,

  type UserReel,

} from './models/schema';

import { MSDEV_LISTENER_ID, PREFERRED_FAVORITE_HOST_IDS, seedMsdevUserFavorites } from './seed-favorite-feed';

import { SALON_LIVE_BOT_SEEDS, seedProductionSalonsLives } from './seed-salons-lives';

import { ensureMsdevDemoLives } from './seed-msdev';

import { dicebearAdventurerAvatar } from './lib/avatarUrl';

import { getYoutubeDemoPool } from './lib/musicCatalog';



export const MSDEV_SHOWCASE_REEL_PREFIX = 'msdev_showcase_reel_';

export const MSDEV_SHOWCASE_SALON_PREFIX = 'msdev_showcase_salon_';

export const MSDEV_SHOWCASE_LIVE_PREFIX = 'msdev_showcase_live_';

export const MSDEV_SHOWCASE_EVENT_PREFIX = 'msdev_showcase_event_';

export const MSDEV_SHOWCASE_HOST_EVENT_PREFIX = `${MSDEV_SHOWCASE_EVENT_PREFIX}host_`;

export const MSDEV_SHOWCASE_ALBUM_PREFIX = 'msdev_showcase_album_';



const MONTPELLIER = { lat: 43.6108, lon: 3.8767, city: 'Montpellier' };

/** Rayon agglo Montpellier pour profil listener showcase. */
export const SHOWCASE_MONTPELLIER_RADIUS_KM = 30;

/** Rayon disque pour les 2 salons offline suivis (centre Montpellier). */
export const SHOWCASE_OFFLINE_SALON_RADIUS_KM = 5;

/** Jitter stable (~100 m max) autour de la ville seed d'un hôte live showcase. */
export const SHOWCASE_HOST_JITTER_KM = 0.1;



/** 3 hôtes avec live actif autour de Montpellier → section Live suivi. */

export const SHOWCASE_LIVE_HOST_IDS = [

  `${SALON_LIVE_BOT_SEEDS[1]!.userId}`, // Luna_MTP — Montpellier

  `${SALON_LIVE_BOT_SEEDS[2]!.userId}`, // SoulLattes — Lattes

  `${SALON_LIVE_BOT_SEEDS[3]!.userId}`, // BeatCastel — Castelnau-le-Lez

] as const;



/** 2 hôtes salon offline (pas de live) → section Salon suivi, pins ≤ 5 km Montpellier. */

export const SHOWCASE_OFFLINE_SALON_HOST_IDS = [

  `${SALON_LIVE_BOT_SEEDS[6]!.userId}`, // PopSete

  `${SALON_LIVE_BOT_SEEDS[5]!.userId}`, // AcousticNimes

] as const;



/** Coords Paris showcase (user_dj — live actif). */
const SHOWCASE_PARIS = { lat: 48.857, lon: 2.3525, city: 'Paris' } as const;

/** 5 hôtes live Europe → section Live suivi (Paris + Berlin, London, Barcelona, Amsterdam). */
export const SHOWCASE_EU_LIVE_HOST_IDS = [
  'user_dj',
  'msdev_showcase_eu_bot-berlin',
  'msdev_showcase_eu_bot-london',
  'msdev_showcase_eu_bot-barcelona',
  'msdev_showcase_eu_bot-amsterdam',
] as const;

interface ShowcaseEuLiveBotSeed {
  userId: (typeof SHOWCASE_EU_LIVE_HOST_IDS)[number];
  username: string;
  city: string;
  lat: number;
  lng: number;
  genres: string[];
  salonId: string;
  salonTitle: string;
  liveTitle: string;
  trackTitle: string;
  artist: string;
  trackId: string;
}

/** Bots showcase Europe (hors user_dj déjà seed msdev). */
export const SHOWCASE_EU_LIVE_BOT_SEEDS: ShowcaseEuLiveBotSeed[] = [
  {
    userId: 'msdev_showcase_eu_bot-berlin',
    username: 'BerlinBeats',
    city: 'Berlin',
    lat: 52.52,
    lng: 13.405,
    genres: ['Techno', 'Électro', 'House'],
    salonId: 'msdev_showcase_eu_salon-berlin',
    salonTitle: 'Techno Underground — Berlin',
    liveTitle: 'Live Techno — Berlin',
    trackTitle: 'One More Time',
    artist: 'Daft Punk',
    trackId: 'FGBhQbmrHQQ',
  },
  {
    userId: 'msdev_showcase_eu_bot-london',
    username: 'LondonGroove',
    city: 'London',
    lat: 51.5074,
    lng: -0.1278,
    genres: ['Indie', 'Rock', 'Britpop'],
    salonId: 'msdev_showcase_eu_salon-london',
    salonTitle: 'Indie Session — London',
    liveTitle: 'Live Indie — London',
    trackTitle: 'Mr. Brightside',
    artist: 'The Killers',
    trackId: 'gGdGFtwCNBE',
  },
  {
    userId: 'msdev_showcase_eu_bot-barcelona',
    username: 'BCN_Nights',
    city: 'Barcelona',
    lat: 41.3874,
    lng: 2.1686,
    genres: ['House', 'Flamenco', 'Latino'],
    salonId: 'msdev_showcase_eu_salon-barcelona',
    salonTitle: 'House & Flamenco — Barcelona',
    liveTitle: 'Live House — Barcelona',
    trackTitle: 'Get Lucky',
    artist: 'Daft Punk',
    trackId: '5NV6RXX0i0I',
  },
  {
    userId: 'msdev_showcase_eu_bot-amsterdam',
    username: 'AMS_DJ',
    city: 'Amsterdam',
    lat: 52.3676,
    lng: 4.9041,
    genres: ['Deep House', 'Trance', 'Électro'],
    salonId: 'msdev_showcase_eu_salon-amsterdam',
    salonTitle: 'Deep House Canal — Amsterdam',
    liveTitle: 'Live Deep House — Amsterdam',
    trackTitle: 'Strobe',
    artist: 'deadmau5',
    trackId: 'jfaD3P3N0v4',
  },
];

export const SHOWCASE_EU_EVENT_COUNT = 4;

/** Abonnements showcase listener — 5 MTP (3 live + 2 salon offline) + 5 live Europe. */
export const SHOWCASE_FOLLOW_TARGET_IDS = [
  ...SHOWCASE_LIVE_HOST_IDS,
  ...SHOWCASE_OFFLINE_SALON_HOST_IDS,
  ...SHOWCASE_EU_LIVE_HOST_IDS,
] as const;

export const SHOWCASE_MONTPELLIER_EVENT_COUNT = 5;

export const SHOWCASE_FOLLOWED_EVENT_COUNT =
  SHOWCASE_MONTPELLIER_EVENT_COUNT + SHOWCASE_EU_EVENT_COUNT;



const MIN_LISTENER_REELS = 3;

const MIN_SHOWCASE_REELS = 10;

const MIN_LISTENER_EVENTS = 4;



const UNSPLASH = [

  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',

  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',

  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',

  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',

];



function isMsdevEnvironment(): boolean {

  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';

}



function stableHash(seed: string): number {

  let h = 0x6d73646d;

  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;

  return Math.abs(h);

}



function pick<T>(arr: readonly T[], seed: string): T {

  return arr[stableHash(seed) % arr.length]!;

}



function futureEventIso(daysAhead: number, hour = 20): string {

  const d = new Date();

  d.setUTCDate(d.getUTCDate() + daysAhead);

  d.setUTCHours(hour, 0, 0, 0);

  return d.toISOString();

}



function stableUnit(seed: string): number {
  return (stableHash(seed) % 1_000_000) / 1_000_000;
}

function stablePointWithinRadiusKm(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  seed: string
): { lat: number; lon: number } {
  const bearing = stableUnit(`${seed}:bearing`) * 2 * Math.PI;
  const distKm = radiusKm * Math.sqrt(stableUnit(`${seed}:dist`));
  return destinationPointKm(centerLat, centerLon, distKm, bearing);
}

/** Coordonnées stables et uniformément réparties dans un disque (seed reproductible). */
export function stablePointWithinMontpellierRadius(seed: string): { lat: number; lon: number } {
  return stablePointWithinRadiusKm(
    MONTPELLIER.lat,
    MONTPELLIER.lon,
    SHOWCASE_MONTPELLIER_RADIUS_KM,
    seed
  );
}

function salonLiveBotSeedForHost(hostId: string) {
  return SALON_LIVE_BOT_SEEDS.find((s) => s.userId === hostId);
}

function showcaseEuBotSeedForHost(hostId: string) {
  return SHOWCASE_EU_LIVE_BOT_SEEDS.find((s) => s.userId === hostId);
}

/** Coords stables d'un hôte showcase : live = ville seed ; offline salon = disque 5 km MTP. */
export function showcaseHostCoordinates(hostId: string): { lat: number; lon: number; city: string } {
  if ((SHOWCASE_OFFLINE_SALON_HOST_IDS as readonly string[]).includes(hostId)) {
    const { lat, lon } = stablePointWithinRadiusKm(
      MONTPELLIER.lat,
      MONTPELLIER.lon,
      SHOWCASE_OFFLINE_SALON_RADIUS_KM,
      `showcase-offline-salon-${hostId}`
    );
    return { lat, lon, city: MONTPELLIER.city };
  }
  if (hostId === 'user_dj') {
    return { lat: SHOWCASE_PARIS.lat, lon: SHOWCASE_PARIS.lon, city: SHOWCASE_PARIS.city };
  }
  const euSeed = showcaseEuBotSeedForHost(hostId);
  if (euSeed) {
    return { lat: euSeed.lat, lon: euSeed.lng, city: euSeed.city };
  }
  const seed = salonLiveBotSeedForHost(hostId);
  if (!seed) {
    return { lat: MONTPELLIER.lat, lon: MONTPELLIER.lon, city: MONTPELLIER.city };
  }
  return { lat: seed.lat, lon: seed.lng, city: seed.city };
}

/** Coords publiques showcase — exactes en msdev (sans flou ~50 m prod). */
function showcasePublicCoords(lat: number, lon: number): { lat: number; lon: number } {
  if (isMsdevEnvironment()) {
    return { lat, lon };
  }
  return { lat: blurCoordinate(lat), lon: blurCoordinate(lon) };
}


function salonsForHost(hostId: string): Salon[] {

  return [...db.salons.values()].filter((s) => s.hostId === hostId);

}



function activeLiveForHost(hostId: string): Live | undefined {

  for (const live of db.lives.values()) {

    if (live.hostId === hostId && live.isActive !== false) return live;

  }

  return undefined;

}



export function upgradeListenerShowcaseProfile(): boolean {

  const user = db.users.get(MSDEV_LISTENER_ID);

  if (!user) return false;



  let changed = false;

  const apply = <K extends keyof User>(key: K, value: User[K]) => {

    if (user[key] !== value) {

      user[key] = value;

      changed = true;

    }

  };



  apply('username', 'demo_test_founder');

  apply('city', MONTPELLIER.city);

  apply('profileType', 'dj');

  apply('listeningRole', 'les_deux');

  apply('onboardingCompleted', true);

  apply('emailVerified', true);

  apply(

    'bio',

    'Compte de démonstration Soundy — contenu de test pour valider les parcours produit (carte, reels, lives, salons, événements).'

  );

  apply('relationshipStatus', 'celibataire');



  const { lat, lon } = stablePointWithinMontpellierRadius('showcase-listener');

  if (user.latitude !== lat || user.longitude !== lon) {

    user.latitude = lat;

    user.longitude = lon;

    refreshUserPublicCoords(user);

    changed = true;

  }



  if (changed) {

    db.users.set(user.id, user);

    schedulePersist();

  }

  return changed;

}



export function resolveShowcaseFollowTargetIds(): string[] {

  return SHOWCASE_FOLLOW_TARGET_IDS.filter((id) => db.users.has(id));

}



export function showcaseFollowsNeedRepair(): boolean {

  const current = new Set(getFollowingIds(MSDEV_LISTENER_ID));

  const expected = new Set(resolveShowcaseFollowTargetIds());

  if (current.size !== expected.size) return true;

  for (const id of expected) {

    if (!current.has(id)) return true;

  }

  for (const id of current) {

    if (!expected.has(id)) return true;

  }

  return false;

}



export function countShowcaseFollowedHostEvents(): number {

  const followed = new Set(SHOWCASE_FOLLOW_TARGET_IDS);

  return db.feedPosts.filter(

    (p) =>

      p.id.startsWith(MSDEV_SHOWCASE_HOST_EVENT_PREFIX) &&

      p.isEvent &&

      followed.has(p.userId)

  ).length;

}



export function countShowcaseActiveLives(): number {
  const liveHostIds = [...SHOWCASE_LIVE_HOST_IDS, ...SHOWCASE_EU_LIVE_HOST_IDS];
  return liveHostIds.filter((hostId) => activeLiveForHost(hostId)).length;
}



export function countShowcaseOfflineSalons(): number {

  return SHOWCASE_OFFLINE_SALON_HOST_IDS.filter((hostId) => {

    const salons = salonsForHost(hostId);

    return salons.length > 0 && !activeLiveForHost(hostId);

  }).length;

}



export function showcaseHostContentNeedRepair(): boolean {

  if (countShowcaseFollowedHostEvents() < SHOWCASE_FOLLOWED_EVENT_COUNT) return true;

  if (countShowcaseActiveLives() < SHOWCASE_LIVE_HOST_IDS.length + SHOWCASE_EU_LIVE_HOST_IDS.length) {
    return true;
  }

  if (countShowcaseOfflineSalons() < SHOWCASE_OFFLINE_SALON_HOST_IDS.length) return true;



  for (const hostId of SHOWCASE_FOLLOW_TARGET_IDS) {

    const user = db.users.get(hostId);

    const expected = showcaseHostCoordinates(hostId);

    if (!user?.latitude || !user.longitude) {

      return true;

    }

    if (
      user.latitude !== expected.lat ||
      user.longitude !== expected.lon ||
      user.city !== expected.city
    ) {

      return true;

    }

    for (const salon of salonsForHost(hostId)) {

      if (salon.latitude !== expected.lat || salon.longitude !== expected.lon) {

        return true;

      }

    }

  }

  return false;

}



function ensureFollows(): number {

  seedMsdevUserFavorites();

  const targets = resolveShowcaseFollowTargetIds();

  const expected = new Set(targets);

  let changed = 0;



  for (const followingId of getFollowingIds(MSDEV_LISTENER_ID)) {

    if (expected.has(followingId)) continue;

    unfollowUser(MSDEV_LISTENER_ID, followingId);

    changed++;

  }



  for (const targetId of targets) {

    if (getFollowingIds(MSDEV_LISTENER_ID).includes(targetId)) continue;

    followUser(MSDEV_LISTENER_ID, targetId);

    changed++;

  }



  for (const hostId of PREFERRED_FAVORITE_HOST_IDS) {

    if (db.users.has(hostId) && !isFavorite(MSDEV_LISTENER_ID, hostId)) {

      addFavorite(MSDEV_LISTENER_ID, hostId);

    }

  }



  if (changed > 0) schedulePersist();

  return changed;

}



function ensureShowcaseHostLocations(): number {

  let changed = 0;



  for (const hostId of SHOWCASE_FOLLOW_TARGET_IDS) {

    const user = db.users.get(hostId);

    if (!user) continue;



    const { lat, lon, city } = showcaseHostCoordinates(hostId);



    if (user.latitude !== lat || user.longitude !== lon || user.city !== city) {

      user.latitude = lat;

      user.longitude = lon;

      user.city = city;

      refreshUserPublicCoords(user);

      db.users.set(hostId, user);

      changed++;

    }



    for (const salon of salonsForHost(hostId)) {

      const publicCoords = showcasePublicCoords(lat, lon);

      const coordsMatch =
        salon.latitude === lat &&
        salon.longitude === lon &&
        salon.blurredLatitude === publicCoords.lat &&
        salon.blurredLongitude === publicCoords.lon;

      if (coordsMatch) continue;

      salon.latitude = lat;

      salon.longitude = lon;

      salon.blurredLatitude = publicCoords.lat;

      salon.blurredLongitude = publicCoords.lon;

      db.salons.set(salon.id, salon);

      changed++;



      const live = db.lives.get(salon.id);

      if (live) {

        const livePublic = showcasePublicCoords(lat, lon);

        const liveCoordsMatch =
          live.latitude === lat &&
          live.longitude === lon &&
          live.blurredLatitude === livePublic.lat &&
          live.blurredLongitude === livePublic.lon;

        if (!liveCoordsMatch) {
          live.latitude = lat;

          live.longitude = lon;

          live.blurredLatitude = livePublic.lat;

          live.blurredLongitude = livePublic.lon;

          if (live.isActive !== true) {

            live.isActive = true;

          }

          db.lives.set(salon.id, live);

          changed++;

        }

      }

    }

  }



  if (changed > 0) schedulePersist();

  return changed;

}



function ensureShowcaseEuropeanLiveHosts(): { users: number; salons: number; lives: number } {
  ensureMsdevDemoLives();

  let usersCreated = 0;
  let salonsCreated = 0;
  let livesCreated = 0;

  for (const seed of SHOWCASE_EU_LIVE_BOT_SEEDS) {
    let user = db.users.get(seed.userId);
    if (!user) {
      const now = Date.now();
      user = {
        id: seed.userId,
        username: seed.username,
        email: `${seed.userId}@bot.melosong.local`,
        passwordHash: 'bot',
        avatarUrl: dicebearAdventurerAvatar(seed.userId),
        meloCoins: 0,
        isGhostMode: false,
        favoriteGenres: seed.genres,
        city: seed.city,
        listeningRole: 'host',
        connectedPlatforms: ['youtube'],
        latitude: seed.lat,
        longitude: seed.lng,
        lastSeenAt: now,
        memberSince: now - 7 * 86_400_000,
        accountStatus: 'active',
      };
      refreshUserPublicCoords(user);
      db.users.set(seed.userId, user);
      usersCreated++;
    } else {
      user.latitude = seed.lat;
      user.longitude = seed.lng;
      user.city = seed.city;
      user.listeningRole = 'host';
      refreshUserPublicCoords(user);
      db.users.set(seed.userId, user);
    }

    const progressMs = 20_000 + (stableHash(seed.salonId) % 160_000);
    const playbackState = {
      platform: 'youtube' as const,
      trackId: seed.trackId,
      title: seed.trackTitle,
      artist: seed.artist,
      albumArtUrl: `https://img.youtube.com/vi/${seed.trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs,
      updatedAt: Date.now(),
      startedAt: Date.now() - progressMs,
      externalUrl: buildPlatformTrackUrl('youtube', seed.trackId),
    };

    if (!db.salons.has(seed.salonId)) {
      const publicCoords = showcasePublicCoords(seed.lat, seed.lng);
      const salon: Salon = {
        id: seed.salonId,
        hostId: user.id,
        hostName: user.username,
        hostAvatarUrl: user.avatarUrl,
        title: seed.salonTitle,
        platform: 'youtube',
        playbackState,
        latitude: seed.lat,
        longitude: seed.lng,
        blurredLatitude: publicCoords.lat,
        blurredLongitude: publicCoords.lon,
        listenersCount: 4 + (stableHash(seed.userId) % 22),
        isGhostMode: false,
        isPublic: true,
        accessMode: 'public',
        allowedUserIds: [user.id],
        allowQueue: true,
        createdAt: Date.now() - progressMs,
      };
      db.salons.set(seed.salonId, salon);
      ensureSalonQueue(seed.salonId);
      ensureSalonProposals(seed.salonId);
      if (!db.salonChats.has(seed.salonId)) db.salonChats.set(seed.salonId, []);
      salonsCreated++;
    }

    if (!db.lives.has(seed.salonId)) {
      const publicCoords = showcasePublicCoords(seed.lat, seed.lng);
      const live: Live = {
        id: seed.salonId,
        salonId: seed.salonId,
        hostId: user.id,
        hostName: user.username,
        title: seed.liveTitle,
        platform: 'youtube',
        playbackState,
        latitude: seed.lat,
        longitude: seed.lng,
        blurredLatitude: publicCoords.lat,
        blurredLongitude: publicCoords.lon,
        viewersCount: 6 + (stableHash(seed.salonId) % 38),
        isActive: true,
        startedAt: Date.now() - 600_000 - (stableHash(seed.salonId) % 1_800_000),
        cameraActive: true,
      };
      db.lives.set(seed.salonId, live);
      if (!db.liveChats.has(seed.salonId)) db.liveChats.set(seed.salonId, []);
      livesCreated++;
    } else {
      const live = db.lives.get(seed.salonId)!;
      if (live.isActive !== true) {
        live.isActive = true;
        db.lives.set(seed.salonId, live);
      }
    }
  }

  if (usersCreated > 0 || salonsCreated > 0 || livesCreated > 0) schedulePersist();

  return { users: usersCreated, salons: salonsCreated, lives: livesCreated };
}



function ensureShowcaseFollowedHostEvents(): number {

  const seeds: Array<{

    id: string;

    hostId: (typeof SHOWCASE_FOLLOW_TARGET_IDS)[number];

    content: string;

    location: string;

    days: number;

    type: 'dance' | 'chant' | 'autre';

  }> = [

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}01`,

      hostId: SHOWCASE_LIVE_HOST_IDS[0]!,

      content: 'Nuit électro Place de la Comédie — set Luna_MTP + invités locaux 🎧',

      location: 'Place de la Comédie, Montpellier, France',

      days: 2,

      type: 'dance',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}02`,

      hostId: SHOWCASE_LIVE_HOST_IDS[1]!,

      content: 'Soul & jazz au Rockstore — session SoulLattes, entrée sur réservation 🎷',

      location: 'Le Rockstore, Montpellier, France',

      days: 4,

      type: 'chant',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}03`,

      hostId: SHOWCASE_LIVE_HOST_IDS[2]!,

      content: 'Hip-hop showcase Peyrou — BeatCastel + MCs de l’agglo 🎤',

      location: 'Place du Peyrou, Montpellier, France',

      days: 5,

      type: 'autre',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}04`,

      hostId: SHOWCASE_OFFLINE_SALON_HOST_IDS[0]!,

      content: 'Pop party Odysseum — DJ set PopSete, after au salon Montpellier 🪩',

      location: 'Odysseum, Montpellier, France',

      days: 7,

      type: 'dance',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}05`,

      hostId: SHOWCASE_OFFLINE_SALON_HOST_IDS[1]!,

      content: 'Acoustic live Zénith Sud — chanson française et reprises acoustiques 🎸',

      location: 'Zénith Sud, Montpellier, France',

      days: 9,

      type: 'chant',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}eu_01`,

      hostId: 'user_dj',

      content: 'Deep house night — DJ Melody live à l’Olympia, guest set Paris 🎧',

      location: "L'Olympia, Paris, France",

      days: 3,

      type: 'dance',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}eu_02`,

      hostId: 'msdev_showcase_eu_bot-berlin',

      content: 'Techno showcase Berghain — BerlinBeats + invités underground 🔊',

      location: 'Berghain, Berlin, Germany',

      days: 6,

      type: 'dance',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}eu_03`,

      hostId: 'msdev_showcase_eu_bot-london',

      content: 'Indie night O2 Academy — LondonGroove et friends, standing room 🎸',

      location: 'O2 Academy Brixton, London, UK',

      days: 8,

      type: 'autre',

    },

    {

      id: `${MSDEV_SHOWCASE_HOST_EVENT_PREFIX}eu_04`,

      hostId: 'msdev_showcase_eu_bot-barcelona',

      content: 'House & flamenco fusion — BCN_Nights au Razzmatazz 💃',

      location: 'Razzmatazz, Barcelona, Spain',

      days: 10,

      type: 'dance',

    },

  ];



  let created = 0;

  for (let i = 0; i < seeds.length; i++) {

    const seed = seeds[i]!;

    if (!db.users.has(seed.hostId)) continue;

    if (db.feedPosts.some((p) => p.id === seed.id)) continue;



    const post: FeedPost = {

      id: seed.id,

      userId: seed.hostId,

      content: seed.content,

      imageUrl: UNSPLASH[i % UNSPLASH.length],

      isEvent: true,

      eventDate: futureEventIso(seed.days, 19 + (i % 3)),

      eventLocation: seed.location,

      eventType: seed.type,

      createdAt: Date.now() - i * 7200_000,

    };

    db.feedPosts.push(post);

    created++;

  }



  if (created > 0) schedulePersist();

  return created;

}



function ensureListenerSalonsAndLives(): { salons: number; lives: number } {

  const listener = db.users.get(MSDEV_LISTENER_ID);

  if (!listener) return { salons: 0, lives: 0 };



  const tracks = getYoutubeDemoPool();

  let salonsCreated = 0;

  let livesCreated = 0;



  for (let i = 1; i <= 2; i++) {

    const salonId = `${MSDEV_SHOWCASE_SALON_PREFIX}${String(i).padStart(2, '0')}`;

    const legacyLiveId = `${MSDEV_SHOWCASE_LIVE_PREFIX}${String(i).padStart(2, '0')}`;

    if (legacyLiveId !== salonId && db.lives.has(legacyLiveId)) {

      db.lives.delete(legacyLiveId);

      db.liveChats.delete(legacyLiveId);

      db.liveBans.delete(legacyLiveId);

    }



    const track = pick(tracks, `salon-track-${i}`);

    const { lat, lon } = stablePointWithinMontpellierRadius(`showcase-listener-salon-${i}`);

    const progressMs = 20_000 + (stableHash(`salon-progress-${i}`) % 90_000);



    const playbackState = {

      platform: 'youtube' as const,

      trackId: track.trackId,

      title: track.title,

      artist: track.artist,

      albumArtUrl: `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`,

      isPlaying: true,

      progressMs,

      updatedAt: Date.now(),

      startedAt: Date.now() - progressMs,

      externalUrl: buildPlatformTrackUrl('youtube', track.trackId),

    };



    if (!db.salons.has(salonId)) {

      const salon: Salon = {

        id: salonId,

        hostId: listener.id,

        hostName: listener.username,

        hostAvatarUrl: listener.avatarUrl,

        title: i === 1 ? 'Salon showcase Montpellier' : 'Session électro Comédie',

        platform: 'youtube',

        playbackState,

        latitude: lat,

        longitude: lon,

        blurredLatitude: showcasePublicCoords(lat, lon).lat,

        blurredLongitude: showcasePublicCoords(lat, lon).lon,

        listenersCount: 6 + i * 3,

        isGhostMode: false,

        isPublic: true,

        accessMode: 'public',

        allowedUserIds: [listener.id],

        allowQueue: true,

        createdAt: Date.now() - i * 3_600_000,

      };

      db.salons.set(salonId, salon);

      ensureSalonQueue(salonId);

      ensureSalonProposals(salonId);

      if (!db.salonChats.has(salonId)) db.salonChats.set(salonId, []);

      salonsCreated++;

    }



    // i=1 : salon + live (clé partagée) ; i=2 : salon seul (pas de live simultané).

    if (i === 1 && !db.lives.has(salonId)) {

      const live: Live = {

        id: salonId,

        salonId,

        hostId: listener.id,

        hostName: listener.username,

        title: 'Live showcase Montpellier',

        platform: 'youtube',

        playbackState,

        latitude: lat,

        longitude: lon,

        blurredLatitude: showcasePublicCoords(lat, lon).lat,

        blurredLongitude: showcasePublicCoords(lat, lon).lon,

        viewersCount: 17,

        isActive: true,

        startedAt: Date.now() - 600_000,

        cameraActive: true,

      };

      db.lives.set(salonId, live);

      if (!db.liveChats.has(salonId)) db.liveChats.set(salonId, []);

      if (!db.liveBans.has(salonId)) db.liveBans.set(salonId, new Map());

      livesCreated++;

    }

  }



  if (salonsCreated > 0 || livesCreated > 0) schedulePersist();

  return { salons: salonsCreated, lives: livesCreated };

}



function ensureListenerEvents(): number {

  const listener = db.users.get(MSDEV_LISTENER_ID);

  if (!listener) return 0;



  const seeds = [

    {

      id: `${MSDEV_SHOWCASE_EVENT_PREFIX}01`,

      content: 'Showcase Soundy — soirée électro Place de la Comédie, entrée libre avant 22h 🎧',

      location: 'Place de la Comédie, Montpellier, France',

      days: 2,

      type: 'dance' as const,

    },

    {

      id: `${MSDEV_SHOWCASE_EVENT_PREFIX}02`,

      content: 'Open mic au Rockstore — inscription sur place, 15 min par artiste 🎤',

      location: 'Le Rockstore, Montpellier, France',

      days: 4,

      type: 'chant' as const,

    },

    {

      id: `${MSDEV_SHOWCASE_EVENT_PREFIX}03`,

      content: 'Jam session Peyrou — guitare, voix et bonne humeur au coucher du soleil 🎸',

      location: 'Place du Peyrou, Montpellier, France',

      days: 6,

      type: 'autre' as const,

    },

    {

      id: `${MSDEV_SHOWCASE_EVENT_PREFIX}04`,

      content: 'Promo album + live showcase — teasers reels et set complet ce samedi ✨',

      location: 'Zénith Sud, Montpellier, France',

      days: 9,

      type: 'chant' as const,

    },

  ];



  let created = 0;

  for (let i = 0; i < seeds.length; i++) {

    const seed = seeds[i]!;

    if (db.feedPosts.some((p) => p.id === seed.id)) continue;

    const post: FeedPost = {

      id: seed.id,

      userId: listener.id,

      content: seed.content,

      imageUrl: UNSPLASH[i % UNSPLASH.length],

      isEvent: true,

      eventDate: futureEventIso(seed.days, 19 + (i % 3)),

      eventLocation: seed.location,

      eventType: seed.type,

      createdAt: Date.now() - i * 7200_000,

    };

    db.feedPosts.push(post);

    created++;

  }



  if (created > 0) schedulePersist();

  return created;

}



function ensureShowcaseReels(): number {

  const listener = db.users.get(MSDEV_LISTENER_ID);

  if (!listener) return 0;



  const following = getFollowingIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id));

  const notFollowing = [...db.users.values()]

    .map((u) => u.id)

    .filter((id) => id !== MSDEV_LISTENER_ID && !following.includes(id));



  const authors = [MSDEV_LISTENER_ID, ...following, ...notFollowing].filter((id, idx, arr) => arr.indexOf(id) === idx);

  if (authors.length === 0) return 0;



  const targetCount = Math.min(10, DEMO_REELS.length);

  let created = 0;

  for (let i = 0; i < targetCount; i++) {

    const authorId = authors[i % authors.length]!;

    const author = db.users.get(authorId);

    if (!author) continue;



    const reelId = `${MSDEV_SHOWCASE_REEL_PREFIX}${String(i + 1).padStart(2, '0')}`;

    if (db.userReels.some((r) => r.id === reelId)) continue;



    const demo = DEMO_REELS[i % DEMO_REELS.length]!;

    const reel: UserReel = {

      id: reelId,

      title: demo.title,

      artist: authorId === MSDEV_LISTENER_ID ? listener.username : author.username,

      genre: demo.genre,

      mediaType: demo.mediaType,

      videoUrl: demo.videoUrl,

      posterUrl: demo.posterUrl,

      durationSec: demo.durationSec,

      audioUrl: demo.audioUrl,

      ...(demo.link?.trim() ? { link: demo.link.trim() } : {}),

      authorId,

      createdAt: Date.now() - (i + 1) * 86_400_000,

      visibility: 'public',

    };



    db.userReels.push(reel);

    created++;

  }



  if (created > 0) {

    invalidateReelsFeedCache();

    schedulePersist();

  }

  return created;

}



/** Reel « chanteur » (Mixkit libre de droits) + vinyle vers l’album showcase msdev. */
function ensurePresentationSingerReel(): boolean {
  const singerDemo = DEMO_REELS.find((r) => r.id === 'reel-singer');
  const listener = db.users.get(MSDEV_LISTENER_ID);
  if (!singerDemo?.videoUrl || !listener) return false;

  const reelId = `${MSDEV_SHOWCASE_REEL_PREFIX}02`;
  const reel: UserReel = {
    id: reelId,
    title: singerDemo.title,
    artist: listener.username,
    genre: singerDemo.genre,
    mediaType: 'video',
    videoUrl: singerDemo.videoUrl,
    posterUrl: singerDemo.posterUrl,
    durationSec: singerDemo.durationSec,
    audioUrl: singerDemo.audioUrl,
    ...(singerDemo.link?.trim() ? { link: singerDemo.link.trim() } : {}),
    authorId: MSDEV_LISTENER_ID,
    createdAt: Date.now() - 86_400_000,
    visibility: 'public',
  };

  const idx = db.userReels.findIndex((r) => r.id === reelId);
  if (idx >= 0) {
    const prev = db.userReels[idx]!;
    if (
      prev.videoUrl === reel.videoUrl &&
      prev.link === reel.link &&
      prev.posterUrl === reel.posterUrl
    ) {
      return false;
    }
    db.userReels[idx] = reel;
  } else {
    db.userReels.push(reel);
  }

  invalidateReelsFeedCache();
  schedulePersist();
  return true;
}



function ensureListenerAlbum(): number {

  const listener = db.users.get(MSDEV_LISTENER_ID);

  if (!listener) return 0;



  const albumId = `${MSDEV_SHOWCASE_ALBUM_PREFIX}01`;

  if (db.albums.some((a) => a.id === albumId)) return 0;



  const now = Date.now();

  const album: UserAlbum = {

    id: albumId,

    userId: listener.id,

    title: 'Showcase Sessions',

    description: 'Morceaux de démonstration pour tester l’onglet Musique.',

    coverUrl: UNSPLASH[0],

    createdAt: now,

    updatedAt: now,

  };

  db.albums.push(album);



  const tracks = getYoutubeDemoPool();

  for (let t = 1; t <= 2; t++) {

    const track = pick(tracks, `album-track-${t}`);

    const comp: UserComposition = {

      id: `${albumId}_track_${t}`,

      userId: listener.id,

      albumId,

      title: track.title,

      artist: listener.username,

      fileUrl: `https://assets.mixkit.co/music/preview/mixkit-${100 + t}.mp3`,

      durationSec: 120,

      createdAt: now - t * 60_000,

    };

    db.compositions.push(comp);

  }



  schedulePersist();

  return 1;

}



export function countShowcaseReels(): number {

  return db.userReels.filter((r) => r.id.startsWith(MSDEV_SHOWCASE_REEL_PREFIX)).length;

}



export function countListenerShowcaseEvents(): number {

  return db.feedPosts.filter(
    (p) =>
      p.id.startsWith(MSDEV_SHOWCASE_EVENT_PREFIX) &&
      !p.id.startsWith(MSDEV_SHOWCASE_HOST_EVENT_PREFIX)
  ).length;

}



export function needsMsdevShowcaseRepair(): boolean {

  if (!isMsdevEnvironment() || !db.users.has(MSDEV_LISTENER_ID)) return false;

  const listener = db.users.get(MSDEV_LISTENER_ID)!;

  if (listener.username !== 'demo_test_founder') return true;

  if (listener.city !== MONTPELLIER.city) return true;

  if (showcaseFollowsNeedRepair()) return true;

  if (showcaseHostContentNeedRepair()) return true;

  if (db.userReels.filter((r) => r.authorId === MSDEV_LISTENER_ID).length < MIN_LISTENER_REELS) return true;

  if (countShowcaseReels() < MIN_SHOWCASE_REELS) return true;

  if (countListenerShowcaseEvents() < MIN_LISTENER_EVENTS) return true;

  if (!db.salons.has(`${MSDEV_SHOWCASE_SALON_PREFIX}01`)) return true;

  if (!db.lives.has(`${MSDEV_SHOWCASE_SALON_PREFIX}01`)) return true;

  if (db.lives.has(`${MSDEV_SHOWCASE_LIVE_PREFIX}01`)) return true;

  if (db.lives.has(`${MSDEV_SHOWCASE_LIVE_PREFIX}02`)) return true;

  if (!db.salons.has('msdev_showcase_eu_salon-berlin')) return true;

  if (countShowcaseFollowedHostEvents() < SHOWCASE_FOLLOWED_EVENT_COUNT) return true;

  return false;

}



export interface SeedMsdevShowcaseResult {

  profileUpdated: boolean;

  followsAdded: number;

  hostLocationsUpdated: number;

  salonsCreated: number;

  livesCreated: number;

  eventsCreated: number;

  hostEventsCreated: number;

  reelsCreated: number;

  albumsCreated: number;

}



/** Écosystème showcase pour listener@msdev.local (idempotent, msdev uniquement). */

export function seedMsdevShowcase(options?: { force?: boolean }): SeedMsdevShowcaseResult {

  if (!isMsdevEnvironment() || !db.users.has(MSDEV_LISTENER_ID)) {

    return {

      profileUpdated: false,

      followsAdded: 0,

      hostLocationsUpdated: 0,

      salonsCreated: 0,

      livesCreated: 0,

      eventsCreated: 0,

      hostEventsCreated: 0,

      reelsCreated: 0,

      albumsCreated: 0,

    };

  }



  const force = options?.force === true || process.env.MSDEV_FORCE_SEED === '1';

  if (!force && !needsMsdevShowcaseRepair()) {

    return {

      profileUpdated: false,

      followsAdded: 0,

      hostLocationsUpdated: 0,

      salonsCreated: 0,

      livesCreated: 0,

      eventsCreated: 0,

      hostEventsCreated: 0,

      reelsCreated: 0,

      albumsCreated: 0,

    };

  }



  seedProductionSalonsLives();

  const euLiveHosts = ensureShowcaseEuropeanLiveHosts();

  const profileUpdated = upgradeListenerShowcaseProfile();

  const followsAdded = ensureFollows();

  const hostLocationsUpdated = ensureShowcaseHostLocations();

  const { salons: listenerSalonsCreated, lives: listenerLivesCreated } = ensureListenerSalonsAndLives();

  const salonsCreated = listenerSalonsCreated + euLiveHosts.salons;

  const livesCreated = listenerLivesCreated + euLiveHosts.lives;

  const eventsCreated = ensureListenerEvents();

  const hostEventsCreated = ensureShowcaseFollowedHostEvents();

  const reelsCreated = ensureShowcaseReels();
  ensurePresentationSingerReel();

  const albumsCreated = ensureListenerAlbum();



  const totalChanges =

    (profileUpdated ? 1 : 0) +

    followsAdded +

    hostLocationsUpdated +

    salonsCreated +

    livesCreated +

    euLiveHosts.users +

    eventsCreated +

    hostEventsCreated +

    reelsCreated +

    albumsCreated;



  if (totalChanges > 0) {

    console.log(

      `[msdev] Showcase listener@msdev.local : +${followsAdded} abonnement(s), ` +

        `${hostLocationsUpdated} coord(s) hôte(s), ${salonsCreated} salon(s) (${euLiveHosts.salons} EU), ${livesCreated} live(s) (${euLiveHosts.lives} EU), ` +

        `${eventsCreated} événement(s) listener, ${hostEventsCreated} événement(s) hôtes suivis, ` +

        `${reelsCreated} reel(s), ${albumsCreated} album(s)`

    );

  }



  return {

    profileUpdated,

    followsAdded,

    hostLocationsUpdated,

    salonsCreated,

    livesCreated,

    eventsCreated,

    hostEventsCreated,

    reelsCreated,

    albumsCreated,

  };

}


