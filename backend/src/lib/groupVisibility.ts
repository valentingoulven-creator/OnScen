import type { GroupMessage } from '../models/schema';

export function isGroupMessageVisibleToUser(msg: GroupMessage, userId: string): boolean {
  return !(msg.hiddenFor?.includes(userId));
}

export function hideGroupMessageForUser(msg: GroupMessage, userId: string): void {
  if (!msg.hiddenFor) msg.hiddenFor = [];
  if (!msg.hiddenFor.includes(userId)) msg.hiddenFor.push(userId);
}
