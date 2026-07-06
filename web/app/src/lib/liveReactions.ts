import type { LiveChatReaction } from '../types';

export const LIVE_REACTION_TYPES = ['note', 'heart', 'star', 'crown'] as const;
export type LiveReactionType = (typeof LIVE_REACTION_TYPES)[number];

/** Valeurs par défaut — les paliers réels viennent de /api/donations/config */
export const LIVE_DON_TIERS = [1, 2, 5] as const;
export const DON_AMOUNT_MIN = 1;
export const DON_AMOUNT_MAX = 100;

export function parseDonAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < DON_AMOUNT_MIN || n > DON_AMOUNT_MAX) return null;
  return n;
}

export function donAmountValidationMessage(): string {
  return `Montant entre ${DON_AMOUNT_MIN} et ${DON_AMOUNT_MAX} €`;
}

export const GIFT_EMOJI: Record<string, string> = {
  note: '🎵',
  heart: '❤️',
  star: '⭐',
  crown: '👑',
  don: '💝',
};

export const GIFT_LABELS_FR: Record<string, string> = {
  note: 'Note',
  heart: 'Cœur',
  star: 'Étoile',
  crown: 'Couronne',
  don: 'Pourboire',
};

/** Icônes visuelles par palier de pourboire (style cadeaux live). */
export const DON_TIER_EMOJI: Record<number, string> = {
  1: '🎵',
  2: '💖',
  5: '👑',
};

export function donTierEmoji(amount: number): string {
  return DON_TIER_EMOJI[amount] ?? GIFT_EMOJI.don;
}

/** Emoji par type de récompense hôte (catalogue dons). */
export const REWARD_TYPE_EMOJI: Record<string, string> = {
  music_request: '🎵',
  dedication: '💌',
  dance: '💃',
  backstage: '🎫',
  badge: '🏅',
  custom: '💝',
};

export function donationOptionEmoji(opt: { amount: number; rewardType?: string }): string {
  if (opt.rewardType && REWARD_TYPE_EMOJI[opt.rewardType]) {
    return REWARD_TYPE_EMOJI[opt.rewardType];
  }
  return donTierEmoji(opt.amount);
}

export interface GiftPayload {
  id: string;
  senderId?: string;
  senderName: string;
  giftType: string;
  amount?: number;
  timestamp: number;
}

export function giftToReaction(g: GiftPayload): LiveChatReaction {
  return {
    id: g.id,
    senderId: g.senderId,
    senderName: g.senderName,
    giftType: g.giftType,
    amount: g.amount && g.amount > 0 ? g.amount : undefined,
    timestamp: g.timestamp,
    count: 1,
  };
}

const MERGE_WINDOW_MS = 45_000;

/** Regroupe les réactions identiques récentes du même utilisateur (pastille + compteur). */
export function appendLiveReaction(list: LiveChatReaction[], incoming: LiveChatReaction): LiveChatReaction[] {
  const last = list[list.length - 1];
  if (
    last &&
    last.senderId &&
    incoming.senderId &&
    last.senderId === incoming.senderId &&
    last.giftType === incoming.giftType &&
    (last.amount ?? 0) === (incoming.amount ?? 0) &&
    incoming.timestamp - last.timestamp < MERGE_WINDOW_MS
  ) {
    return [...list.slice(0, -1), { ...last, count: (last.count ?? 1) + 1, timestamp: incoming.timestamp }];
  }
  return [...list, incoming];
}

export function reactionSummary(r: LiveChatReaction): string {
  if (r.giftType === 'don' && r.amount) {
    return `Don · ${r.amount}€`;
  }
  const label = GIFT_LABELS_FR[r.giftType] ?? r.giftType;
  return `a envoyé ${label.toLowerCase()}`;
}

export function giftsToReactions(
  gifts: { id: string; senderId: string; senderName: string; giftType: string; amount: number; timestamp: number }[]
): LiveChatReaction[] {
  const sorted = [...gifts].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.reduce<LiveChatReaction[]>(
    (acc, g) => appendLiveReaction(acc, giftToReaction({ ...g, senderId: g.senderId })),
    []
  );
}
