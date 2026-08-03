import { db, FeedPost } from './models/schema';
import { addFavorite, getFavoriteHostIds, isFavorite } from './lib/favorites';
import { invalidateFeedSortCache } from './lib/feedPosts';
import { schedulePersist } from './lib/persist';

/** Publications des comptes favoris — préfixe idempotent (fil d'accueil Actualité). */
export const FAVORITE_POST_ID_PREFIX = 'feed-favorite-';

/** Nombre cible de publications showcase dans le fil (comptes suivis). */
export const FAVORITE_POST_TARGET = 10;

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
  'prod-seed-bot-beat-castel',
] as const;

const UNSPLASH = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=800&q=80',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=800&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&q=80',
];

/** 10 publications démo : texte seul, 1 photo, ou galerie multi-images. */
export const FAVORITE_FEED_SHOWCASE: Array<{
  slot: string;
  authorId: (typeof PREFERRED_FAVORITE_HOST_IDS)[number];
  content: string;
  hoursAgo: number;
  imageUrl?: string;
  imageUrls?: string[];
}> = [
  {
    slot: '01',
    authorId: 'user_dj',
    content: 'Deep house ce soir — setlist prête, qui passe au salon ? 🎧',
    hoursAgo: 3,
  },
  {
    slot: '02',
    authorId: 'bot_nova',
    content: 'Ambiance studio hier soir — extrait photo ci-dessous ✨',
    hoursAgo: 6,
    imageUrl: UNSPLASH[0],
  },
  {
    slot: '03',
    authorId: 'user_bass',
    content: 'Week-end festival : trois moments à retenir (scène, public, backstage) 🔥',
    hoursAgo: 9,
    imageUrl: UNSPLASH[1],
    imageUrls: [UNSPLASH[1], UNSPLASH[2], UNSPLASH[4]],
  },
  {
    slot: '04',
    authorId: 'bot_luna',
    content: 'Merci pour les messages — prochain live techno annoncé dans la semaine.',
    hoursAgo: 14,
  },
  {
    slot: '05',
    authorId: 'bot_kira',
    content: 'Track du jour en une image — vous la reconnaissez ?',
    hoursAgo: 18,
    imageUrl: UNSPLASH[3],
  },
  {
    slot: '06',
    authorId: 'bot_echo',
    content: 'Session photo + écoute : deux vibes du même set 🎶📷',
    hoursAgo: 22,
    imageUrl: UNSPLASH[4],
    imageUrls: [UNSPLASH[4], UNSPLASH[5]],
  },
  {
    slot: '07',
    authorId: 'bot_wave',
    content: 'Salon ouvert — file d’attente collaborative, venez proposer vos morceaux.',
    hoursAgo: 28,
  },
  {
    slot: '08',
    authorId: 'bot_pixel',
    content: 'Visuel du prochain clip — retouches en cours.',
    hoursAgo: 32,
    imageUrl: UNSPLASH[2],
  },
  {
    slot: '09',
    authorId: 'prod-seed-bot-beat-castel',
    content: 'Agglo Sessions — galerie du cypher Castelnau (4 plans) 🎤',
    hoursAgo: 36,
    imageUrl: UNSPLASH[0],
    imageUrls: [UNSPLASH[0], UNSPLASH[1], UNSPLASH[3], UNSPLASH[5]],
  },
  {
    slot: '10',
    authorId: 'bot_milo',
    content: 'Petit poll : plutôt live carte ou salon ce weekend ? Répondez en commentaire 👇',
    hoursAgo: 42,
  },
];

function showcasePostId(slot: string): string {
  return `${FAVORITE_POST_ID_PREFIX}showcase-${slot}`;
}

/** Auteurs des publications showcase — à suivre pour le fil Accueil (`followingOnly`). */
export function getFavoriteShowcaseFollowAuthorIds(): string[] {
  const ids = new Set<string>();
  for (const seed of FAVORITE_FEED_SHOWCASE) {
    if (db.users.has(seed.authorId)) ids.add(seed.authorId);
  }
  return [...ids];
}

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function countFavoriteFeedPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(FAVORITE_POST_ID_PREFIX)).length;
}

function countFavoriteShowcasePosts(): number {
  return FAVORITE_FEED_SHOWCASE.filter((s) =>
    db.feedPosts.some((p) => p.id === showcasePostId(s.slot))
  ).length;
}

function hasLegacyFavoriteFeedPosts(): boolean {
  return db.feedPosts.some(
    (p) => p.id.startsWith(FAVORITE_POST_ID_PREFIX) && !p.id.includes('showcase-')
  );
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
  invalidateFeedSortCache();
  return toRemove.size;
}

function upsertShowcasePost(seed: (typeof FAVORITE_FEED_SHOWCASE)[number], now: number): boolean {
  const id = showcasePostId(seed.slot);
  const createdAt = now - seed.hoursAgo * 3_600_000;
  const imageUrls =
    seed.imageUrls && seed.imageUrls.length > 1 ? [...seed.imageUrls] : undefined;
  const imageUrl = seed.imageUrl ?? imageUrls?.[0];

  const existing = db.feedPosts.find((p) => p.id === id);
  if (existing) {
    let changed = false;
    if (existing.content !== seed.content) {
      existing.content = seed.content;
      changed = true;
    }
    if (existing.userId !== seed.authorId && db.users.has(seed.authorId)) {
      existing.userId = seed.authorId;
      changed = true;
    }
    if (imageUrl && existing.imageUrl !== imageUrl) {
      existing.imageUrl = imageUrl;
      changed = true;
    }
    if (imageUrls?.length) {
      const prev = (existing.imageUrls ?? []).join('|');
      const next = imageUrls.join('|');
      if (prev !== next) {
        existing.imageUrls = imageUrls;
        if (!existing.imageUrl?.trim()) existing.imageUrl = imageUrls[0]!;
        changed = true;
      }
    } else if (!imageUrl && (existing.imageUrl || existing.imageUrls?.length)) {
      delete existing.imageUrl;
      delete existing.imageUrls;
      changed = true;
    }
    return changed;
  }

  if (!db.users.has(seed.authorId)) return false;

  const post: FeedPost = {
    id,
    userId: seed.authorId,
    content: seed.content,
    createdAt,
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageUrls?.length ? { imageUrls } : {}),
  };
  db.feedPosts.push(post);
  return true;
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
 * Crée 10 publications showcase (texte / 1 photo / multi-photos) des comptes favoris démo.
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

  const needsMigrate = hasLegacyFavoriteFeedPosts();
  const showcaseComplete = countFavoriteShowcasePosts() >= FAVORITE_POST_TARGET;

  if (showcaseComplete && !needsMigrate && !options?.force) {
    return { created: 0, total: countFavoriteShowcasePosts() };
  }

  let removed = 0;
  if (options?.force || needsMigrate || !showcaseComplete) {
    removed = removeFavoriteFeedPosts();
  }

  const now = Date.now();
  let created = 0;
  let updated = 0;
  for (const seed of FAVORITE_FEED_SHOWCASE) {
    if (!db.users.has(seed.authorId)) continue;
    const isNew = !db.feedPosts.some((p) => p.id === showcasePostId(seed.slot));
    const changed = upsertShowcasePost(seed, now);
    if (isNew && changed) created++;
    else if (changed) updated++;
  }

  if (created > 0 || updated > 0 || removed > 0) {
    invalidateFeedSortCache();
    schedulePersist();
  }
  if (created > 0 || removed > 0) {
    console.log(
      `[msdev] Fil favoris : ${created} publication(s) showcase créée(s)` +
        (removed > 0 ? `, ${removed} ancienne(s) retirée(s)` : '') +
        ` (${countFavoriteShowcasePosts()}/${FAVORITE_POST_TARGET})`
    );
  }

  return { created, total: countFavoriteShowcasePosts() };
}

export function needsFavoriteFeedRepair(): boolean {
  if (!isMsdevEnvironment() || !db.users.has(MSDEV_LISTENER_ID)) return false;
  const favCount = getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id)).length;
  if (favCount < MIN_FAVORITE_HOSTS) return true;
  if (hasLegacyFavoriteFeedPosts()) return true;
  return countFavoriteShowcasePosts() < FAVORITE_POST_TARGET;
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
