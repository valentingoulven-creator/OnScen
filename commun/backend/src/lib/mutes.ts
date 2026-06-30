import { db } from '../models/schema';

/** L'utilisateur `muterId` a mis en sourdine `mutedId` (messages toujours visibles). */
export function hasMuted(muterId: string, mutedId: string): boolean {
  return db.userMutes.some((m) => m.muterId === muterId && m.mutedId === mutedId);
}

export function muteUser(muterId: string, mutedId: string): void {
  if (muterId === mutedId) return;
  if (hasMuted(muterId, mutedId)) return;
  db.userMutes.push({
    muterId,
    mutedId,
    createdAt: Date.now(),
  });
}

export function unmuteUser(muterId: string, mutedId: string): void {
  db.userMutes = db.userMutes.filter(
    (m) => !(m.muterId === muterId && m.mutedId === mutedId)
  );
}

export function getMutedIds(muterId: string): string[] {
  return db.userMutes.filter((m) => m.muterId === muterId).map((m) => m.mutedId);
}
