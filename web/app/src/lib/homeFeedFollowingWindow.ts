import type { FeedPost } from '../types';

/** Publications des abonnements affichées en tête du fil Accueil. */
export const HOME_FEED_FOLLOWING_RECENT_MS = 2 * 24 * 60 * 60 * 1000;

export function getHomeFeedFollowingCutoffMs(nowMs = Date.now()): number {
  return nowMs - HOME_FEED_FOLLOWING_RECENT_MS;
}

export function partitionFollowingFeedByRecency(
  posts: FeedPost[],
  cutoffMs: number
): { recent: FeedPost[]; older: FeedPost[] } {
  const recent: FeedPost[] = [];
  const older: FeedPost[] = [];
  for (const p of posts) {
    if (p.createdAt >= cutoffMs) recent.push(p);
    else older.push(p);
  }
  return { recent, older };
}

export function filterNonFollowingFeedPosts(
  posts: FeedPost[],
  viewerId: string,
  followingIds: ReadonlySet<string>
): FeedPost[] {
  return posts.filter((p) => p.userId !== viewerId && !followingIds.has(p.userId));
}
