/**
 * Profil showcase BeatCastel — publications, reels, albums, programmation, compteurs démo.
 */
import { addFavorite, isFavorite as isHostFavorite } from './lib/favorites';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { getYoutubeDemoPool } from './lib/musicCatalog';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { schedulePersist } from './lib/persist';
import { schedulePersistAlbumToPg } from './lib/pgAlbums';
import { schedulePersistCompositionToPg } from './lib/pgCompositions';
import { invalidateReelsFeedCache } from './lib/reelFeedCache';
import { DEMO_REELS } from './lib/reels';
import { SALON_LIVE_BOT_SEEDS, SALON_LIVE_ID_PREFIX } from './seed-salons-lives';
import {
  db,
  type FeedPost,
  type User,
  type UserAlbum,
  type UserComposition,
  type UserReel,
} from './models/schema';

export const BEATCASTEL_USER_ID = `${SALON_LIVE_ID_PREFIX}bot-beat-castel`;
const CONTENT_PREFIX = 'prod_seed_beatcastel_';

const BEATCASTEL_FOLLOWERS_TARGET = 36;
const BEATCASTEL_FAVORITES_TARGET = 57;

const HIP_HOP_REEL_INDICES = [0, 2, 4, 6, 8, 10];

const RAP_TRACKS: Array<{ title: string; artist: string; trackId: string }> = [
  { title: 'HUMBLE.', artist: 'Kendrick Lamar', trackId: 'tvTRZ0-26n0' },
  { title: 'SICKO MODE', artist: 'Travis Scott', trackId: '6ONRfLht3P0' },
  { title: 'God\'s Plan', artist: 'Drake', trackId: 'xpVfcZ0ZcFM' },
  { title: 'Lose Yourself', artist: 'Eminem', trackId: 'xFYQQPAO7K0' },
  { title: 'Ni**as In Paris', artist: 'JAY-Z & Kanye West', trackId: 'gG_dA32oH44' },
  { title: 'No Role Modelz', artist: 'J. Cole', trackId: 'bOCHbIvKUkI' },
  { title: 'Money Trees', artist: 'Kendrick Lamar', trackId: 'jN8AbX2aeQ8' },
  { title: 'Starboy', artist: 'The Weeknd', trackId: '34Na4j8AVgA' },
];

const SYNTH_USER_PREFIX = `${SALON_LIVE_ID_PREFIX}beatcastel-synth-`;

function ensureSyntheticUsers(count: number): string[] {
  const ids: string[] = [];
  const now = Date.now();
  for (let i = 1; i <= count; i++) {
    const id = `${SYNTH_USER_PREFIX}${String(i).padStart(3, '0')}`;
    ids.push(id);
    if (db.users.has(id)) continue;
    const user: User = {
      id,
      username: `fan_${i}`,
      email: `${id}@bot.onscen.local`,
      passwordHash: 'bot',
      avatarUrl: dicebearAdventurerAvatar(id),
      meloCoins: 0,
      isGhostMode: false,
      favoriteGenres: ['Hip-Hop'],
      city: 'Montpellier',
      listeningRole: 'auditeur',
      lastSeenAt: now,
      memberSince: now - i * 86_400_000,
      accountStatus: 'active',
    };
    refreshUserPublicCoords(user);
    db.users.set(id, user);
  }
  return ids;
}

function pickHostIdsForFans(): string[] {
  const synth = ensureSyntheticUsers(BEATCASTEL_FOLLOWERS_TARGET);
  const existing = [...db.users.keys()].filter(
    (id) => id !== BEATCASTEL_USER_ID && !id.startsWith(SYNTH_USER_PREFIX)
  );
  const merged = [...existing, ...synth].filter((id, idx, arr) => arr.indexOf(id) === idx);
  merged.sort((a, b) => a.localeCompare(b));
  return merged.slice(0, BEATCASTEL_FOLLOWERS_TARGET);
}

function pickHostIdsForBeatCastelFavorites(): string[] {
  const synth = ensureSyntheticUsers(BEATCASTEL_FAVORITES_TARGET + 10);
  const existing = [...db.users.keys()].filter(
    (id) => id !== BEATCASTEL_USER_ID && !id.startsWith(SYNTH_USER_PREFIX)
  );
  const merged = [...existing, ...synth].filter((id, idx, arr) => arr.indexOf(id) === idx);
  merged.sort((a, b) => a.localeCompare(b));
  return merged.slice(0, BEATCASTEL_FAVORITES_TARGET);
}

function eventDateIso(daysFromNow: number, hour = 20): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function upgradeBeatCastelUser(user: User): boolean {
  let changed = false;
  const apply = <K extends keyof User>(key: K, value: User[K]) => {
    if (user[key] !== value) {
      user[key] = value;
      changed = true;
    }
  };

  const seed = SALON_LIVE_BOT_SEEDS.find((s) => s.userId === BEATCASTEL_USER_ID);
  apply(
    'bio',
    'MC & host OnScen — sessions rap live depuis Castelnau-le-Lez et l’agglo montpelliéraine. Freestyles, cyphers et sorties du collectif Agglo Beats. Rejoins le salon ou le live quand le badge LIVE est allumé.'
  );
  apply('profileType', 'dj');
  apply('listeningRole', 'les_deux');
  apply('onboardingCompleted', true);
  apply('emailVerified', true);
  apply('city', seed?.city ?? 'Castelnau-le-Lez');
  apply('favoriteGenres', seed?.genres ?? ['Hip-Hop', 'Rap', 'Trap']);
  apply('favoriteArtists', ['Kendrick Lamar', 'J. Cole', 'Travis Scott', 'Ninho', 'Damso']);
  apply('interests', ['Freestyle', 'Beatmaking', 'Cyphers', 'Live rap', 'Montpellier']);
  apply('youtubeChannel', '@BeatCastelOnScen');
  apply('instagramHandle', 'beatcastel.mtp');
  apply('favoritesCountOverride', BEATCASTEL_FOLLOWERS_TARGET);

  if (changed) db.users.set(user.id, user);
  return changed;
}

function ensureBeatCastelSocialCounts(): { fans: number; favorites: number } {
  let fans = 0;
  let favorites = 0;

  for (const fanId of pickHostIdsForFans()) {
    if (!isHostFavorite(fanId, BEATCASTEL_USER_ID)) {
      addFavorite(fanId, BEATCASTEL_USER_ID);
      fans++;
    }
  }

  for (const hostId of pickHostIdsForBeatCastelFavorites()) {
    if (!isHostFavorite(BEATCASTEL_USER_ID, hostId)) {
      addFavorite(BEATCASTEL_USER_ID, hostId);
      favorites++;
    }
  }

  return { fans, favorites };
}

function ensureBeatCastelFeedPosts(): number {
  const user = db.users.get(BEATCASTEL_USER_ID);
  if (!user) return 0;

  const seeds: Array<Omit<FeedPost, 'userId' | 'createdAt'> & { daysAgo: number }> = [
    {
      id: `${CONTENT_PREFIX}post_01`,
      content:
        'Nouvelle session enregistrée hier au studio — extrait demain en reel. Merci à ceux qui étaient sur le live 🎤',
      imageUrl: 'https://img.youtube.com/vi/tvTRZ0-26n0/hqdefault.jpg',
      daysAgo: 1,
    },
    {
      id: `${CONTENT_PREFIX}post_02`,
      content:
        'Agglo Beats vol. 2 en préparation. Vous voulez du boom bap ou trap pour la prochaine soirée ? Répondez en commentaire.',
      daysAgo: 3,
    },
    {
      id: `${CONTENT_PREFIX}post_03`,
      content: 'Shoutout à la commu OnScen — 36 abonnés, on continue la montée 🔥 Castelnau représente.',
      imageUrl: 'https://img.youtube.com/vi/DyDfgMOUjCI/hqdefault.jpg',
      daysAgo: 5,
    },
    {
      id: `${CONTENT_PREFIX}post_04`,
      content:
        'Backstage Agglo Sessions — trois moments de la session : régie, cypher et public. Merci Montpellier 🔥',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
      imageUrls: [
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
      ],
      daysAgo: 2,
    },
    {
      id: `${CONTENT_PREFIX}event_01`,
      content: 'Showcase hip-hop — Place du Peyrou, MCs invités agglo + session BeatCastel.',
      isEvent: true,
      eventType: 'autre',
      eventLocation: 'Place du Peyrou, Montpellier, France',
      eventDate: eventDateIso(5, 19),
      daysAgo: 2,
    },
    {
      id: `${CONTENT_PREFIX}event_02`,
      content: 'Cypher open mic — inscriptions sur place, 3 min par MC, DJ set après.',
      isEvent: true,
      eventType: 'chant',
      eventLocation: 'Le Rockstore, Montpellier, France',
      eventDate: eventDateIso(9, 21),
      daysAgo: 4,
    },
    {
      id: `${CONTENT_PREFIX}event_03`,
      content: 'Live rap + listening party — sortie mixtape « Agglo Sessions ».',
      isEvent: true,
      eventType: 'autre',
      eventLocation: 'Castelnau-le-Lez, France',
      eventDate: eventDateIso(14, 20),
      eventLinkUrl: 'https://onscen.com',
      daysAgo: 6,
    },
    {
      id: `${CONTENT_PREFIX}event_04`,
      content: 'Atelier écriture & flow — débutants bienvenus, gratuit sur réservation.',
      isEvent: true,
      eventType: 'autre',
      eventLocation: 'Médiathèque Jacques Prévert, Castelnau-le-Lez',
      eventDate: eventDateIso(21, 18),
      daysAgo: 8,
    },
  ];

  let created = 0;
  const now = Date.now();
  for (const seed of seeds) {
    const existing = db.feedPosts.find((p) => p.id === seed.id);
    if (existing) {
      if (seed.imageUrl?.trim() && !existing.imageUrl?.trim()) {
        existing.imageUrl = seed.imageUrl.trim();
      }
      if (seed.imageUrls?.length && (!existing.imageUrls?.length || existing.imageUrls.length < seed.imageUrls.length)) {
        existing.imageUrls = [...seed.imageUrls];
        if (!existing.imageUrl?.trim()) existing.imageUrl = seed.imageUrls[0]!.trim();
      }
      continue;
    }
    const { daysAgo, ...postFields } = seed;
    db.feedPosts.push({
      ...postFields,
      userId: BEATCASTEL_USER_ID,
      createdAt: now - daysAgo * 86_400_000,
    });
    created++;
  }
  return created;
}

function ensureBeatCastelReels(): number {
  const user = db.users.get(BEATCASTEL_USER_ID);
  if (!user) return 0;

  let created = 0;
  for (let i = 0; i < HIP_HOP_REEL_INDICES.length; i++) {
    const demo = DEMO_REELS[HIP_HOP_REEL_INDICES[i]! % DEMO_REELS.length]!;
    const reelId = `${CONTENT_PREFIX}reel_${String(i + 1).padStart(2, '0')}`;
    if (db.userReels.some((r) => r.id === reelId)) continue;

    const reel: UserReel = {
      id: reelId,
      title: demo.title,
      artist: user.username,
      genre: demo.genre ?? 'Hip-Hop',
      mediaType: 'video',
      videoUrl: demo.videoUrl,
      posterUrl: demo.posterUrl,
      durationSec: demo.durationSec,
      audioUrl: demo.audioUrl,
      ...(demo.link?.trim() ? { link: demo.link.trim() } : {}),
      authorId: BEATCASTEL_USER_ID,
      createdAt: Date.now() - (i + 1) * 86_400_000,
      visibility: 'public',
    };
    db.userReels.push(reel);
    created++;
  }

  if (created > 0) invalidateReelsFeedCache();
  return created;
}

function ensureBeatCastelAlbums(): number {
  const user = db.users.get(BEATCASTEL_USER_ID);
  if (!user) return 0;

  const albumDefs = [
    { id: `${CONTENT_PREFIX}album_agglo`, title: 'Agglo Sessions', trackOffset: 0, count: 5 },
    { id: `${CONTENT_PREFIX}album_freestyle`, title: 'Castelnau Freestyles', trackOffset: 3, count: 4 },
  ];

  let albumsCreated = 0;
  const now = Date.now();
  const pool = getYoutubeDemoPool();

  for (const def of albumDefs) {
    if (db.albums.some((a) => a.id === def.id)) continue;

    const album: UserAlbum = {
      id: def.id,
      userId: BEATCASTEL_USER_ID,
      title: def.title,
      description: `Extrait démo OnScen — ${def.title}.`,
      coverUrl: `https://img.youtube.com/vi/${RAP_TRACKS[def.trackOffset]?.trackId ?? 'tvTRZ0-26n0'}/hqdefault.jpg`,
      createdAt: now - def.trackOffset * 3600_000,
      updatedAt: now,
    };
    db.albums.push(album);
    albumsCreated++;

    for (let t = 0; t < def.count; t++) {
      const rap = RAP_TRACKS[(def.trackOffset + t) % RAP_TRACKS.length]!;
      const fallback = pool[(def.trackOffset + t) % pool.length]!;
      const compId = `${def.id}_track_${t + 1}`;
      if (db.compositions.some((c) => c.id === compId)) continue;

      const comp: UserComposition = {
        id: compId,
        userId: BEATCASTEL_USER_ID,
        albumId: def.id,
        title: rap.title,
        artist: rap.artist || fallback.artist || user.username,
        fileUrl: buildPlatformTrackUrl('youtube', rap.trackId),
        durationSec: 180 + (t % 4) * 15,
        createdAt: now - (t + 1) * 120_000,
      };
      db.compositions.push(comp);
    }
  }

  return albumsCreated;
}

const SINGLES_ALBUM_ID = `${CONTENT_PREFIX}album_singles`;

/**
 * Rattache à un album « Titres seuls » toute composition BeatCastel restée sans album
 * (ex. fichier audio réel ajouté via `add-msdev-composition-from-file.ts` pour tester le
 * lecteur audio global — sans --album, une composition est invisible dans la grille
 * d'albums du profil, seulement listée sous un onglet secondaire « Sans album »).
 * Idempotent : ne crée l'album qu'une fois, ne déplace que les morceaux encore orphelins.
 */
function ensureBeatCastelLooseTracksAttached(): number {
  const user = db.users.get(BEATCASTEL_USER_ID);
  if (!user) return 0;

  const loose = db.compositions.filter((c) => c.userId === BEATCASTEL_USER_ID && !c.albumId);
  if (loose.length === 0) return 0;

  const now = Date.now();
  let album = db.albums.find((a) => a.id === SINGLES_ALBUM_ID && a.userId === BEATCASTEL_USER_ID);
  if (!album) {
    album = {
      id: SINGLES_ALBUM_ID,
      userId: BEATCASTEL_USER_ID,
      title: 'Titres seuls',
      description: 'Freestyles et reprises live enregistrés en solo.',
      createdAt: now,
      updatedAt: now,
    };
    db.albums.push(album);
  }

  for (const c of loose) {
    c.albumId = album.id;
    schedulePersistCompositionToPg(c);
  }
  album.updatedAt = now;
  schedulePersistAlbumToPg(album);

  return loose.length;
}

export interface EnsureBeatCastelProfileResult {
  userUpdated: boolean;
  fansAdded: number;
  favoritesAdded: number;
  postsCreated: number;
  reelsCreated: number;
  albumsCreated: number;
  looseTracksAttached: number;
}

/** Idempotent — enrichit le bot BeatCastel pour la démo produit. */
export function ensureBeatCastelShowcaseProfile(): EnsureBeatCastelProfileResult {
  const user = db.users.get(BEATCASTEL_USER_ID);
  if (!user) {
    return {
      userUpdated: false,
      fansAdded: 0,
      favoritesAdded: 0,
      postsCreated: 0,
      reelsCreated: 0,
      albumsCreated: 0,
      looseTracksAttached: 0,
    };
  }

  const userUpdated = upgradeBeatCastelUser(user);
  const { fans: fansAdded, favorites: favoritesAdded } = ensureBeatCastelSocialCounts();
  const postsCreated = ensureBeatCastelFeedPosts();
  const reelsCreated = ensureBeatCastelReels();
  const albumsCreated = ensureBeatCastelAlbums();
  const looseTracksAttached = ensureBeatCastelLooseTracksAttached();

  if (
    userUpdated ||
    fansAdded ||
    favoritesAdded ||
    postsCreated ||
    reelsCreated ||
    albumsCreated ||
    looseTracksAttached
  ) {
    schedulePersist();
  }

  return {
    userUpdated,
    fansAdded,
    favoritesAdded,
    postsCreated,
    reelsCreated,
    albumsCreated,
    looseTracksAttached,
  };
}
