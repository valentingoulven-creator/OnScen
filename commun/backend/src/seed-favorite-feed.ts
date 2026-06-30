import { db, FeedPost } from './models/schema';
import { addFavorite, getFavoriteHostIds, isFavorite } from './lib/favorites';
import { getYoutubeDemoPool } from './lib/musicCatalog';
import { schedulePersist } from './lib/persist';

/** Publications des comptes favoris — préfixe idempotent (onglet Communauté). */
export const FAVORITE_POST_ID_PREFIX = 'feed-favorite-';

/** Nombre cible de publications des favoris (12–15). */
export const FAVORITE_POST_TARGET = 15;

/** Compte démo principal — listener@msdev.local */
export const MSDEV_LISTENER_ID = 'user_listener';

/** Nombre minimum de comptes favoris pour l'auditeur démo. */
export const MIN_FAVORITE_HOSTS = 8;

/** Comptes favoris seedés pour l'auditeur démo (8–10). */
export const PREFERRED_FAVORITE_HOST_IDS = [
  'user_dj',
  'user_bass',
  'bot_luna',
  'bot_nova',
  'bot_kira',
  'bot_echo',
  'bot_wave',
  'bot_pixel',
  'bot_milo',
  'bot_zara',
] as const;

const FAVORITE_POST_SAMPLES = [
  'Nouveau set deep house ce soir — qui vient ? 🎧',
  'Partage de ma dernière découverte, vous en pensez quoi ?',
  'Live dans 15 min sur la carte, rejoignez-moi ! 🔴',
  'Playlist du moment : que des pépites ✨',
  'Merci à tous ceux qui sont passés hier soir 🙏',
  'Ambiance parfaite pour coder ce matin ☕🎶',
  'Ce morceau tourne en boucle chez moi depuis 3 jours',
  'Qui écoute la même chose que moi en ce moment ?',
  'Session chill ce soir — salon ouvert 🎵',
  'Petit rappel : mon live hebdo c\'est le vendredi !',
  'Découverte grâce à un ami sur Soundy — trop bien 💜',
  'En train de préparer ma prochaine setlist 🎛️',
  'Bonne vibe ce weekend, partagez vos sons 👇',
  'Le salon est ouvert, venez nombreux !',
  'Track du jour : impossible de s\'en lasser 🔁',
];

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=600',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=600',
];

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

function postHash(index: number, salt: string): number {
  let h = index ^ 0x7a4f6176;
  for (let i = 0; i < salt.length; i++) {
    h = (h * 31 + salt.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function postUnit(index: number, salt: string): number {
  return (postHash(index, salt) % 10_000) / 10_000;
}

export function countFavoriteFeedPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(FAVORITE_POST_ID_PREFIX)).length;
}

function removeFavoriteFeedPosts(): number {
  const toRemove = new Set(
    db.feedPosts.filter((p) => p.id.startsWith(FAVORITE_POST_ID_PREFIX)).map((p) => p.id)
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

/** Fenêtre d'âge des publications seed (48 h) — restent en tête du fil récent. */
const SEED_POST_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function buildPostContent(index: number): string {
  const tracks = getYoutubeDemoPool();
  const useTrack = postHash(index, 'fav-track') % 100 < 25 && tracks.length > 0;
  if (useTrack) {
    const track = tracks[postHash(index, 'fav-track-pick') % tracks.length];
    return `En ce moment : "${track.title}" de ${track.artist} 🎶`;
  }
  return FAVORITE_POST_SAMPLES[postHash(index, 'fav-text') % FAVORITE_POST_SAMPLES.length];
}

/**
 * Ajoute des comptes favoris pour listener@msdev.local (idempotent).
 */
export function seedMsdevUserFavorites(): number {
  if (!isMsdevEnvironment()) return 0;
  if (!db.users.has(MSDEV_LISTENER_ID)) return 0;

  let added = 0;
  for (const hostId of PREFERRED_FAVORITE_HOST_IDS) {
    if (!db.users.has(hostId)) continue;
    if (!isFavorite(MSDEV_LISTENER_ID, hostId)) {
      addFavorite(MSDEV_LISTENER_ID, hostId);
      added++;
    }
  }

  if (added > 0) schedulePersist();
  return added;
}

export interface SeedFavoriteFeedPostsResult {
  created: number;
  total: number;
}

/**
 * Crée des publications publiées par les comptes favoris de l'auditeur démo (idempotent).
 */
export function seedFavoriteFeedPosts(options?: { force?: boolean }): SeedFavoriteFeedPostsResult {
  if (!isMsdevEnvironment()) {
    return { created: 0, total: countFavoriteFeedPosts() };
  }

  seedMsdevUserFavorites();

  const authorIds = getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id));
  if (authorIds.length === 0) {
    return { created: 0, total: countFavoriteFeedPosts() };
  }

  let removed = 0;
  if (options?.force) {
    removed = removeFavoriteFeedPosts();
  }

  const existing = countFavoriteFeedPosts();
  if (existing >= FAVORITE_POST_TARGET && !options?.force) {
    return { created: 0, total: existing };
  }

  const now = Date.now();
  const tracks = getYoutubeDemoPool();
  const toCreate = FAVORITE_POST_TARGET - (options?.force ? 0 : existing);

  for (let j = 0; j < toCreate; j++) {
    const i = (options?.force ? 0 : existing) + j;
    const authorId = authorIds[postHash(i, 'fav-author') % authorIds.length];
    const content = buildPostContent(i);

    const ageMs = Math.floor(postUnit(i, 'fav-age') * SEED_POST_MAX_AGE_MS);
    const createdAt = now - ageMs;

    const hasImage = postHash(i, 'fav-img') % 100 < 25;
    let imageUrl: string | undefined;
    if (hasImage) {
      const useYoutube = tracks.length > 0 && postHash(i, 'fav-img-src') % 2 === 0;
      if (useYoutube) {
        const track = tracks[postHash(i, 'fav-img-track') % tracks.length];
        imageUrl = `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`;
      } else {
        imageUrl = UNSPLASH_IMAGES[postHash(i, 'fav-unsplash') % UNSPLASH_IMAGES.length];
      }
    }

    const postId = `${FAVORITE_POST_ID_PREFIX}${i}-${createdAt}`;
    const post: FeedPost = {
      id: postId,
      userId: authorId,
      content,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt,
    };
    db.feedPosts.push(post);
  }

  if (toCreate > 0 || removed > 0) {
    schedulePersist();
  }
  if (toCreate > 0) {
    console.log(
      `[msdev] ${toCreate} publication(s) favoris créée(s) (${countFavoriteFeedPosts()} au total, auteurs favoris: ${authorIds.length})`
    );
  } else if (removed > 0) {
    console.log(`[msdev] ${removed} publication(s) favoris régénérée(s)`);
  }

  return { created: toCreate, total: countFavoriteFeedPosts() };
}

export function needsFavoriteFeedRepair(): boolean {
  if (!isMsdevEnvironment() || !db.users.has(MSDEV_LISTENER_ID)) return false;
  const favCount = getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id)).length;
  if (favCount < MIN_FAVORITE_HOSTS) return true;
  return countFavoriteFeedPosts() < FAVORITE_POST_TARGET;
}

export function seedFavoriteFeed(options?: { force?: boolean }): {
  favoritesAdded: number;
  postsCreated: number;
  postsTotal: number;
} {
  const favoritesAdded = seedMsdevUserFavorites();
  const force = options?.force || needsFavoriteFeedRepair();
  const { created, total } = seedFavoriteFeedPosts({ force });
  return { favoritesAdded, postsCreated: created, postsTotal: total };
}
