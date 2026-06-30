import { db } from '../models/schema';
import { recordCompositionWeeklyVote } from './weeklyVotes';
import { schedulePersist } from './persist';
export function getCompositionUpvoteCount(compositionId: string): number {
  return db.compositionUpvotes.filter((v) => v.compositionId === compositionId).length;
}

export function userHasCompositionUpvote(compositionId: string, userId: string): boolean {
  return db.compositionUpvotes.some(
    (v) => v.compositionId === compositionId && v.userId === userId
  );
}

export function enrichCompositionWithUpvotes<T extends { id: string }>(
  track: T,
  viewerId?: string
): T & { upvoteCount: number; userHasUpvoted: boolean } {
  return {
    ...track,
    upvoteCount: getCompositionUpvoteCount(track.id),
    userHasUpvoted: Boolean(viewerId && userHasCompositionUpvote(track.id, viewerId)),
  };
}

export function toggleCompositionUpvote(
  compositionId: string,
  voterId: string
): { upvoteCount: number; userHasUpvoted: boolean } | { error: string } {
  const composition = db.compositions.find((c) => c.id === compositionId);
  if (!composition) {
    return { error: 'Composition introuvable' };
  }

  const existingIdx = db.compositionUpvotes.findIndex(
    (v) => v.compositionId === compositionId && v.userId === voterId
  );
  const isAdding = existingIdx < 0;

  if (existingIdx >= 0) {
    db.compositionUpvotes.splice(existingIdx, 1);
  } else {
    db.compositionUpvotes.push({
      compositionId,
      userId: voterId,
      votedAt: Date.now(),
    });
  }

  recordCompositionWeeklyVote(composition, voterId, isAdding);

  schedulePersist();

  return {    upvoteCount: getCompositionUpvoteCount(compositionId),
    userHasUpvoted: isAdding,
  };
}

export function deleteCompositionUpvotes(compositionId: string): void {
  db.compositionUpvotes = db.compositionUpvotes.filter((v) => v.compositionId !== compositionId);
  schedulePersist();
}

export function deleteCompositionUpvotesByUser(userId: string): void {
  db.compositionUpvotes = db.compositionUpvotes.filter((v) => v.userId !== userId);
  schedulePersist();
}