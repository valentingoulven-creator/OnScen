import type { FeedPost } from '../types';

/** Le compte connecté est l'auteur de cette publication, événement ou repartage. */
export function isFeedPostOwner(
  user: { id?: string } | null | undefined,
  post: Pick<FeedPost, 'userId' | 'author'> | null | undefined
): boolean {
  const userId = user?.id?.trim();
  if (!userId || !post) return false;
  return userId === post.userId || userId === post.author.id;
}
