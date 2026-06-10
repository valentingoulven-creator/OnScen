import { db, type FeedPost, type User } from '../models/schema';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hoursSincePost(post: FeedPost): number {
  return (Date.now() - post.createdAt) / 3_600_000;
}

/** Count how many times a post has been reshared (O(n) — called once per scored post). */
function reshareCount(postId: string): number {
  let count = 0;
  for (const p of db.feedPosts) {
    if (p.resharedFromId === postId) count++;
  }
  return count;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Scores a single post for a given viewer.
 *
 * Weights:
 *  - 40 % engagement (likes × 1 + comments × 2 + reshares × 3, time-normalised)
 *  - 25 % recency    (exponential decay, half-life ≈ 48 h)
 *  - 20 % user similarity (genre overlap between viewer and post author)
 *  - 10 % creator relationship (followed accounts get a 1.5× boost)
 *  -  5 % diversity handled downstream (max 2 posts per creator)
 */
function scorePost(post: FeedPost, viewer: User): number {
  const likeCount    = db.feedPostLikes.get(post.id)?.size ?? 0;
  const commentCount = db.feedPostComments.get(post.id)?.length ?? 0;
  const reshares     = reshareCount(post.id);
  const hours        = Math.max(0.1, hoursSincePost(post));

  // 40 % — engagement normalised by post age (avoids old viral posts dominating)
  const engagementScore =
    (likeCount * 1 + commentCount * 2 + reshares * 3) / (hours * 0.1 + 1);

  // 25 % — recency: exponential decay, half-life ≈ 48 h
  const recencyScore = Math.exp(-hours / 48);

  // 20 % — genre match between viewer and post author (0 or 1)
  const authorUser    = db.users.get(post.userId);
  const viewerGenres  = viewer.favoriteGenres ?? [];
  const authorGenres  = authorUser?.favoriteGenres ?? [];
  const genreMatch =
    viewerGenres.length > 0 && authorGenres.length > 0
      ? viewerGenres.some((g) => authorGenres.includes(g)) ? 1 : 0
      : 0;

  // 10 % — creator relationship: followed creators score higher
  const followBoost = db.userFollows.get(viewer.id)?.has(post.userId) ? 1.5 : 1;

  return (
    engagementScore * 0.4 +
    recencyScore    * 0.25 +
    genreMatch      * 0.2 * 5 +
    followBoost     * 0.1 * 10
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a scored, ranked, diversity-filtered list of FeedPost objects for
 * the given viewer.  Caller is responsible for converting to PublicFeedPost.
 *
 * Diversity rule: a single creator may appear at most twice in the result set
 * (5 % of the overall weight, enforced post-sort).
 */
export function getAlgoFeed(viewerId: string, limit = 20): FeedPost[] {
  const viewer = db.users.get(viewerId);
  if (!viewer) return [];

  const scored = db.feedPosts
    .filter((p) => p.userId !== viewerId)
    .map((p) => ({ post: p, score: scorePost(p, viewer) }))
    .sort((a, b) => b.score - a.score);

  const seenCreators: Record<string, number> = {};
  const result: FeedPost[] = [];

  for (const { post } of scored) {
    const seen = seenCreators[post.userId] ?? 0;
    if (seen >= 2) continue; // diversity: max 2 posts per creator
    seenCreators[post.userId] = seen + 1;
    result.push(post);
    if (result.length >= limit) break;
  }

  return result;
}
