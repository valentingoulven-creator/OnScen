import { db, type ChatMessage, type DirectMessage } from '../models/schema';

/** Messages conservés par salon / live (derniers N). Override : MAX_CHAT_MESSAGES_PER_ROOM */
const DEFAULT_MAX = 500;

/** Messages DM conservés par paire d'utilisateurs (derniers N). Override : MAX_DIRECT_MESSAGES_PER_PAIR */
const DEFAULT_MAX_DM_PER_PAIR = 500;

function maxMessagesPerRoom(): number {
  const raw = process.env.MAX_CHAT_MESSAGES_PER_ROOM;
  if (!raw) return DEFAULT_MAX;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 50 ? n : DEFAULT_MAX;
}

function maxDirectMessagesPerPair(): number {
  const raw = process.env.MAX_DIRECT_MESSAGES_PER_PAIR;
  if (!raw) return DEFAULT_MAX_DM_PER_PAIR;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 50 ? n : DEFAULT_MAX_DM_PER_PAIR;
}

export function trimChatMessageList(messages: ChatMessage[]): ChatMessage[] {
  const max = maxMessagesPerRoom();
  if (messages.length <= max) return messages;
  return messages.slice(-max);
}

function dmPairKey(senderId: string, receiverId: string): string {
  return senderId < receiverId ? `${senderId}:${receiverId}` : `${receiverId}:${senderId}`;
}

/**
 * Cap les DM par paire d'utilisateurs, à l'image de `trimChatMessageList` pour
 * les salons/lives (`MAX_CHAT_MESSAGES_PER_ROOM`) — `db.directMessages` est un
 * tableau plat unique sans limite jusqu'ici (audit DB/infra §3, mitigation
 * ciblée). N'affecte pas l'ordre chronologique global une fois retriée.
 *
 * NB : ceci ne résout pas le problème de fond du flush périodique en
 * ré-upsert intégral (`pgStore.ts`/`pgStoreSocialSync.ts`) — cap seulement la
 * croissance non bornée de la structure RAM. La refonte du mécanisme de
 * flush (delta incrémental au lieu d'un ré-upsert complet à chaque cycle)
 * reste un chantier séparé nécessitant une revue dédiée (cf. modification.txt
 * MODIF 963).
 */
export function trimDirectMessages(messages: DirectMessage[]): DirectMessage[] {
  const max = maxDirectMessagesPerPair();
  const byPair = new Map<string, DirectMessage[]>();
  for (const m of messages) {
    const key = dmPairKey(m.senderId, m.receiverId);
    const list = byPair.get(key);
    if (list) list.push(m);
    else byPair.set(key, [m]);
  }

  let trimmedAny = false;
  for (const list of byPair.values()) {
    if (list.length > max) trimmedAny = true;
  }
  if (!trimmedAny) return messages;

  const kept: DirectMessage[] = [];
  for (const list of byPair.values()) {
    kept.push(...(list.length > max ? list.slice(-max) : list));
  }
  return kept.sort((a, b) => a.timestamp - b.timestamp);
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

  const trimmedDms = trimDirectMessages(db.directMessages);
  if (trimmedDms.length !== db.directMessages.length) db.directMessages = trimmedDms;
}
