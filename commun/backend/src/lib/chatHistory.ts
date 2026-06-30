import { db, type ChatMessage } from '../models/schema';

/** Messages conservés par salon / live (derniers N). Override : MAX_CHAT_MESSAGES_PER_ROOM */
const DEFAULT_MAX = 500;

function maxMessagesPerRoom(): number {
  const raw = process.env.MAX_CHAT_MESSAGES_PER_ROOM;
  if (!raw) return DEFAULT_MAX;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 50 ? n : DEFAULT_MAX;
}

export function trimChatMessageList(messages: ChatMessage[]): ChatMessage[] {
  const max = maxMessagesPerRoom();
  if (messages.length <= max) return messages;
  return messages.slice(-max);
}

/** Tronque l'historique chat en mémoire avant snapshot / persistance. */
export function purgeUnboundedChatHistory(): void {
  for (const [id, list] of db.salonChats.entries()) {
    const trimmed = trimChatMessageList(list ?? []);
    if (trimmed.length !== list.length) db.salonChats.set(id, trimmed);
  }
  for (const [id, list] of db.liveChats.entries()) {
    const trimmed = trimChatMessageList(list ?? []);
    if (trimmed.length !== list.length) db.liveChats.set(id, trimmed);
  }
}
