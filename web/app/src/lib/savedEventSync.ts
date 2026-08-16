/** Synchronise les événements suivis (favoris publication) entre fil, carte et globe. */

import type { FeedPost } from '../types';

export const SAVED_EVENT_CHANGED_EVENT = 'onscen:saved-event-changed';

export type SavedEventChangedDetail = {
  postId: string;
  saved: boolean;
  post?: FeedPost;
};

export function notifySavedEventChanged(
  postId: string,
  saved: boolean,
  post?: FeedPost
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SavedEventChangedDetail>(SAVED_EVENT_CHANGED_EVENT, {
      detail: { postId, saved, post },
    })
  );
}

export function applySavedEventChanged(
  prev: Set<string>,
  postId: string,
  saved: boolean
): Set<string> {
  const next = new Set(prev);
  if (saved) next.add(postId);
  else next.delete(postId);
  return next;
}

export function applySavedEventPostsChanged(
  prev: FeedPost[],
  detail: SavedEventChangedDetail
): FeedPost[] {
  if (!detail.saved) return prev.filter((p) => p.id !== detail.postId);
  const post = detail.post;
  if (!post?.isEvent) return prev;
  const next = { ...post, favoriteByMe: true };
  const idx = prev.findIndex((p) => p.id === post.id);
  if (idx === -1) return [...prev, next];
  const copy = [...prev];
  copy[idx] = next;
  return copy;
}
