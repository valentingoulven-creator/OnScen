import type { DirectMessage } from '../models/schema';

export function isDmVisibleToUser(msg: DirectMessage, userId: string): boolean {
  return !(msg.hiddenFor?.includes(userId));
}

export function hideDmForUser(msg: DirectMessage, userId: string): void {
  if (!msg.hiddenFor) msg.hiddenFor = [];
  if (!msg.hiddenFor.includes(userId)) msg.hiddenFor.push(userId);
}
