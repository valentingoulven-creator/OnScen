import { db, FeedPost, FeedPostComment } from './models/schema';
import { getFavoriteHostIds } from './lib/favorites';
import { getYoutubeDemoPool } from './lib/musicCatalog';
import { schedulePersist } from './lib/persist';
import {
  MSDEV_LISTENER_ID,
  PREFERRED_FAVORITE_HOST_IDS,
  seedMsdevUserFavorites,
} from './seed-favorite-feed';

/** Publications hors favoris (Accueil) — préfixe idempotent. */
export const COMMUNITY_POST_ID_PREFIX = 'feed-community-';

/** Nombre cible de publications d'auteurs non favoris (15–20). */
export const COMMUNITY_POST_TARGET = 18;

const SAMPLE_POSTS = [
  'Qui écoute du jazz ce soir ? 🎷',
  'Mon salon YouTube est ouvert — venez !',
  'Découverte du jour : ce morceau est incroyable',
  'Live dans 10 minutes sur la carte 🎵',
  'Ambiance lo-fi parfaite pour travailler ce matin ☕🎧',
  'Quelqu\'un connaît un bon salon de deep house ?',
  'Session collective ce soir — on teste des morceaux inédits 🎤',
  'La carte est animée, plein de lives autour de moi 🗺️',
  'Ce titre tourne en boucle depuis hier 🔁 Accro total.',
  'Premier live ce soir — un peu stressé mais motivé ! 😤🎶',
  'Ma playlist du moment fait 3h, impossible de m\'arrêter 😅',
  'OnScen + weekend + bonne humeur = combo parfait ☀️🎵',
  'Petit café + playlist chill = matinée parfaite ☕',
  'Qui partage une bonne playlist ? Je cherche des idées 🎧',
  'Le live d\'hier soir était fou — merci à tous 🔥',
  'Découverte grâce à la carte — merci OnScen 🗺️❤️',
  'Vendredi soir = soirée musique, qui est partant ? 🎉',
  'En train de préparer ma setlist pour le prochain live 🎛️',
  'Concert hier soir — encore des frissons ce matin 🎸',
  'Bonne nuit à tous, dernière track avant de dormir 🌙😴',
  'Music is life 🎵 — impossible de décrocher ce soir !',
  'Salon ouvert ! Ambiance garantie, rejoignez-nous 🙌',
  'Qui écoute quoi en ce moment ? Partagez vos découvertes 👂',
  'Mon coup de cœur de la semaine, je vous le partage ici ❤️‍🔥',
  'J\'adore quand on tombe sur une pépite musicale par hasard 💎',
];

const COMMENT_POOL = [
  '🔥🔥🔥',
  'Trop bien ce morceau !',
  'Merci pour le partage 🙌',
  "Je l'écoute aussi en ce moment 😄",
  'Super découverte !',
  "J'adore cet artiste ❤️",
  'On se retrouve sur le salon ?',
  'Bonne playlist 👍',
  'Live ce soir ?',
  "Je viens d'écouter, c'est top !",
  "On est sur la même longueur d'onde 🎵",
  'Excellent choix 💯',
  "Salon ouvert chez moi si t'es chaud 🎤",
];

/** Fenêtre d'âge des publications seed (48 h) — restent en tête du fil récent. */
const SEED_POST_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=600',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=600',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
];

function isMsdevEnvironment(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

function postHash(index: number, salt: string): number {
  let h = index ^ 0x6c62272e;
  for (let i = 0; i < salt.length; i++) {
    h = (h * 31 + salt.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function postUnit(index: number, salt: string): number {
  return (postHash(index, salt) % 10_000) / 10_000;
}

export function countCommunityPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(COMMUNITY_POST_ID_PREFIX)).length;
}

function isFavoriteAuthorForListener(authorId: string, favoriteIds: Set<string>): boolean {
  return authorId === MSDEV_LISTENER_ID || favoriteIds.has(authorId);
}

/** Publications Communauté dont l'auteur n'est pas favori de l'auditeur démo. */
export function countNonFavoriteCommunityPosts(): number {
  const favoriteIds = new Set(getFavoriteHostIds(MSDEV_LISTENER_ID));
  return db.feedPosts.filter(
    (p) =>
      p.id.startsWith(COMMUNITY_POST_ID_PREFIX) &&
      !isFavoriteAuthorForListener(p.userId, favoriteIds)
  ).length;
}

function collectNonFavoriteAuthorIds(): string[] {
  const favoriteIds = new Set([
    ...getFavoriteHostIds(MSDEV_LISTENER_ID),
    ...PREFERRED_FAVORITE_HOST_IDS,
  ]);
  const ids = new Set<string>();
  for (const id of db.users.keys()) {
    if (id === MSDEV_LISTENER_ID) continue;
    if (favoriteIds.has(id)) continue;
    if (id.startsWith('bot_') || id.startsWith('user_')) ids.add(id);
  }
  return [...ids];
}

function removeCommunityPostsFromFavoriteAuthors(): number {
  const favoriteIds = new Set(getFavoriteHostIds(MSDEV_LISTENER_ID));
  const toRemove = new Set(
    db.feedPosts
      .filter(
        (p) =>
          p.id.startsWith(COMMUNITY_POST_ID_PREFIX) &&
          isFavoriteAuthorForListener(p.userId, favoriteIds)
      )
      .map((p) => p.id)
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

function pickCommunityPostImageUrl(index: number): string | undefined {
  if (postHash(index, 'img') % 100 >= 55) return undefined;
  const tracks = getYoutubeDemoPool();
  const useYoutube = tracks.length > 0 && postHash(index, 'img-src') % 2 === 0;
  if (useYoutube) {
    const track = tracks[postHash(index, 'img-track') % tracks.length];
    return `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`;
  }
  return UNSPLASH_IMAGES[postHash(index, 'unsplash') % UNSPLASH_IMAGES.length];
}

/** Ajoute des visuels aux publications Communauté seedées sans média (fil msdev plus vivant). */
function backfillCommunityPostImages(): number {
  let updated = 0;
  for (const post of db.feedPosts) {
    if (!post.id.startsWith(COMMUNITY_POST_ID_PREFIX)) continue;
    if (post.imageUrl?.trim() || (post.imageUrls?.length ?? 0) > 0 || post.videoUrl?.trim()) continue;
    const seedKey = postHash(post.id.length, post.id);
    const imageUrl = pickCommunityPostImageUrl(seedKey);
    if (!imageUrl) continue;
    post.imageUrl = imageUrl;
    updated++;
  }
  return updated;
}

function buildPostContent(index: number): string {
  const tracks = getYoutubeDemoPool();
  const useTrack = postHash(index, 'track') % 100 < 30 && tracks.length > 0;
  if (useTrack) {
    const track = tracks[postHash(index, 'track-pick') % tracks.length];
    const variants = [
      `Je viens de découvrir 🎵 "${track.title}" de ${track.artist} — trop bien !`,
      `En écoute : "${track.title}" de ${track.artist} 🎶`,
      `${track.artist} est incroyable. Écoutez "${track.title}" ❤️`,
    ];
    return variants[postHash(index, 'track-variant') % variants.length];
  }
  return SAMPLE_POSTS[postHash(index, 'text') % SAMPLE_POSTS.length];
}

function removeCommunityPosts(): number {
  const toRemove = new Set(
    db.feedPosts.filter((p) => p.id.startsWith(COMMUNITY_POST_ID_PREFIX)).map((p) => p.id)
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

export interface SeedCommunityPostsResult {
  created: number;
  total: number;
  nonFavoriteTotal?: number;
  removed?: number;
  removedFavoriteAuthors?: number;
}

/**
 * Génère des publications d'auteurs non favoris pour le fil Accueil (msdev uniquement).
 * Idempotent : nettoie les posts Communauté publiés par des favoris, complète jusqu'à COMMUNITY_POST_TARGET.
 */
export function seedCommunityPosts(options?: { force?: boolean }): SeedCommunityPostsResult {
  if (!isMsdevEnvironment()) {
    return { created: 0, total: countCommunityPosts(), nonFavoriteTotal: countNonFavoriteCommunityPosts() };
  }

  seedMsdevUserFavorites();

  let removed = 0;
  if (options?.force) {
    removed = removeCommunityPosts();
  }

  const removedFavoriteAuthors = removeCommunityPostsFromFavoriteAuthors();
  const backfilledImages = backfillCommunityPostImages();

  const authorIds = collectNonFavoriteAuthorIds();
  if (authorIds.length === 0) {
    return {
      created: 0,
      total: countCommunityPosts(),
      nonFavoriteTotal: countNonFavoriteCommunityPosts(),
      removed: removed || undefined,
      removedFavoriteAuthors: removedFavoriteAuthors || undefined,
    };
  }

  const existing = countNonFavoriteCommunityPosts();
  if (existing >= COMMUNITY_POST_TARGET && !options?.force) {
    return {
      created: 0,
      total: countCommunityPosts(),
      nonFavoriteTotal: existing,
      removedFavoriteAuthors: removedFavoriteAuthors || undefined,
    };
  }

  const now = Date.now();
  const toCreate = COMMUNITY_POST_TARGET - (options?.force ? 0 : existing);

  for (let j = 0; j < toCreate; j++) {
    const i = (options?.force ? 0 : existing) + j;
    const authorId = authorIds[postHash(i, 'author') % authorIds.length];
    const content = buildPostContent(i);

    const ageMs = Math.floor(postUnit(i, 'age') * SEED_POST_MAX_AGE_MS);
    const createdAt = now - ageMs;

    const imageUrl = pickCommunityPostImageUrl(i);

    const postId = `${COMMUNITY_POST_ID_PREFIX}${i}-${createdAt}`;
    const post: FeedPost = {
      id: postId,
      userId: authorId,
      content,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt,
    };
    db.feedPosts.push(post);

    const likeCount = postHash(i, 'likes') % 31;
    if (likeCount > 0) {
      const likers = new Set<string>();
      for (let l = 0; l < likeCount; l++) {
        const likerId = authorIds[postHash(i * 1000 + l, 'liker') % authorIds.length];
        if (likerId !== authorId) likers.add(likerId);
      }
      if (likers.size > 0) db.feedPostLikes.set(postId, likers);
    }

    const commentCount = postHash(i, 'comments') % 6;
    if (commentCount > 0) {
      const comments: FeedPostComment[] = [];
      for (let c = 0; c < commentCount; c++) {
        const commenterId = authorIds[postHash(i * 500 + c, 'commenter') % authorIds.length];
        const commenter = db.users.get(commenterId);
        const commentAgeMs = Math.floor(postUnit(i * 100 + c, 'comment-age') * Math.max(ageMs, 3600000));
        comments.push({
          id: `fc-community-${i}-${c}`,
          postId,
          userId: commenterId,
          username: commenter?.username ?? 'Utilisateur',
          avatarUrl: commenter?.avatarUrl,
          content: COMMENT_POOL[postHash(i * 100 + c, 'comment-text') % COMMENT_POOL.length],
          createdAt: createdAt + commentAgeMs,
        });
      }
      db.feedPostComments.set(postId, comments);
    }
  }

  if (toCreate > 0 || removed > 0 || removedFavoriteAuthors > 0 || backfilledImages > 0) {
    schedulePersist();
  }

  const total = countCommunityPosts();
  const nonFavoriteTotal = countNonFavoriteCommunityPosts();
  if (toCreate > 0) {
    console.log(
      `[msdev] ${toCreate} publication(s) hors favoris créée(s) (${nonFavoriteTotal} non-favoris, ${total} Communauté au total, auteurs: ${authorIds.length})`
    );
  } else if (backfilledImages > 0) {
    console.log(`[msdev] ${backfilledImages} publication(s) Communauté enrichie(s) avec une image`);
  } else if (removedFavoriteAuthors > 0) {
    console.log(
      `[msdev] ${removedFavoriteAuthors} publication(s) Communauté retirée(s) (auteurs favoris)`
    );
  }

  return {
    created: toCreate,
    total,
    nonFavoriteTotal,
    removed: removed || undefined,
    removedFavoriteAuthors: removedFavoriteAuthors || undefined,
  };
}

export function needsCommunityFeedRepair(): boolean {
  if (!isMsdevEnvironment() || !db.users.has(MSDEV_LISTENER_ID)) return false;
  return countNonFavoriteCommunityPosts() < COMMUNITY_POST_TARGET;
}
