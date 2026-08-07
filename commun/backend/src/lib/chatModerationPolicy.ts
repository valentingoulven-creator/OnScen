import {
  CHAT_BLOCK_SPAM_PHRASES,
  CHAT_BLOCK_TERMS,
  CHAT_MASK_TERMS,
} from './chatModerationTerms';
import {
  compactForChatModeration,
  normalizeForChatModeration,
} from './chatModerationNormalize';

export type ChatModerationBlockReason =
  | 'hate_speech'
  | 'harassment'
  | 'spam'
  | 'blocked_term';

export interface ChatModerationOptions {
  /** Termes additionnels (hôte live / salon), insensibles à la casse. */
  extraBlockedTerms?: string[];
}

export interface ChatModerationResult {
  blocked: boolean;
  text: string;
  reason?: ChatModerationBlockReason;
}

export const CHAT_MODERATION_REJECT_MESSAGE =
  'Ce message ne respecte pas les règles de la communauté Soundy.';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function envExtraBlockedTerms(): string[] {
  const raw = process.env.CHAT_BLOCKED_TERMS;
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function termMatchesNormalized(term: string, normalized: string, compact: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (t.includes(' ')) {
    return normalized.includes(t);
  }
  const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i');
  if (re.test(normalized)) return true;
  if (t.length >= 4 && compact.includes(t.replace(/\s/g, ''))) return true;
  return false;
}

function classifyBlock(term: string): ChatModerationBlockReason {
  const lower = term.toLowerCase();
  if (CHAT_BLOCK_SPAM_PHRASES.some((p) => lower.includes(p) || p.includes(lower))) {
    return 'spam';
  }
  if (lower.includes('kill') || lower.includes('kys') || lower.includes('suicide')) {
    return 'harassment';
  }
  return 'hate_speech';
}

function findBlockReason(
  normalized: string,
  compact: string,
  extraTerms: string[]
): ChatModerationBlockReason | null {
  for (const term of CHAT_BLOCK_TERMS) {
    if (termMatchesNormalized(term, normalized, compact)) {
      return classifyBlock(term);
    }
  }
  for (const phrase of CHAT_BLOCK_SPAM_PHRASES) {
    if (normalized.includes(phrase) || compact.includes(phrase.replace(/\s/g, ''))) {
      return 'spam';
    }
  }
  for (const term of [...envExtraBlockedTerms(), ...extraTerms]) {
    if (termMatchesNormalized(term, normalized, compact)) {
      return 'blocked_term';
    }
  }
  return null;
}

const MASK_RE = new RegExp(
  `\\b(${CHAT_MASK_TERMS.map(escapeRegExp).join('|')})\\b`,
  'gi'
);

function maskProfanityDisplay(input: string): string {
  return input.replace(MASK_RE, (match) => '*'.repeat(Math.min(match.length, 6)));
}

/**
 * Applique la politique chat Soundy sur du texte déjà assaini (sans HTML).
 * 1) Blocage slurs / spam / termes hôte ou env
 * 2) Masquage grossièretés sur le texte publié
 */
export function applyChatModerationPolicy(
  sanitizedPlain: string,
  options?: ChatModerationOptions
): ChatModerationResult {
  const normalized = normalizeForChatModeration(sanitizedPlain);
  const compact = compactForChatModeration(normalized);
  const extra = (options?.extraBlockedTerms ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  const blockReason = findBlockReason(normalized, compact, extra);
  if (blockReason) {
    return { blocked: true, text: '', reason: blockReason };
  }

  return { blocked: false, text: maskProfanityDisplay(sanitizedPlain) };
}
