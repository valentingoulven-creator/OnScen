import { db } from '../models/schema';

/** L'utilisateur `blockerId` a bloqué `blockedId` (silencieux). */
export function hasBlocked(blockerId: string, blockedId: string): boolean {
  return db.userBlocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId);
}

/** Le destinataire doit-il recevoir ce message ? */
export function shouldDeliverToReceiver(senderId: string, receiverId: string): boolean {
  return !hasBlocked(receiverId, senderId);
}

export function blockUser(blockerId: string, blockedId: string): void {
  if (blockerId === blockedId) return;
  if (hasBlocked(blockerId, blockedId)) return;
  db.userBlocks.push({
    blockerId,
    blockedId,
    createdAt: Date.now(),
  });
}

export function unblockUser(blockerId: string, blockedId: string): void {
  db.userBlocks = db.userBlocks.filter(
    (b) => !(b.blockerId === blockerId && b.blockedId === blockedId)
  );
}

export function getBlockedIds(blockerId: string): string[] {
  return db.userBlocks.filter((b) => b.blockerId === blockerId).map((b) => b.blockedId);
}
