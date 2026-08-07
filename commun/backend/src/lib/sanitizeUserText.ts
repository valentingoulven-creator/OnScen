import sanitizeHtml from 'sanitize-html';

import {
  applyChatModerationPolicy,
  CHAT_MODERATION_REJECT_MESSAGE,
  type ChatModerationOptions,
} from './chatModerationPolicy';

export { CHAT_MODERATION_REJECT_MESSAGE };

/**
 * Neutralise tout HTML dans un texte libre saisi par l'utilisateur (bio, chat,
 * DM, description de groupe, texte de post…). Le client web n'utilise jamais
 * `dangerouslySetInnerHTML` — ce texte n'est donc jamais interprété comme du
 * HTML aujourd'hui — mais on l'assainit dès l'écriture en base pour couvrir
 * les futurs consommateurs de l'API (app mobile, exports, panneau admin,
 * webhooks) qui pourraient un jour rendre ce contenu comme HTML brut.
 *
 * Stratégie : aucun tag n'est autorisé (l'app n'a pas de rich text). Les
 * balises sont retirées mais le texte visible qu'elles contenaient est
 * conservé, pour ne pas surprendre l'utilisateur en supprimant du contenu
 * légitime (ex. « <3 » reste « <3 » sous forme d'entité échappée neutre).
 */
export function sanitizePlainText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
}

/** Chat / DM — assainit le HTML puis applique la politique de modération chat. */
export function sanitizeChatText(input: string, options?: ChatModerationOptions): string {
  return prepareChatText(input, options).text;
}

export type PreparedChatText =
  | { ok: true; text: string }
  | { ok: false; text: ''; message: string; reason: string };

/** Assainit + modère ; refus explicite si slurs / spam / termes bloqués. */
export function prepareChatText(input: string, options?: ChatModerationOptions): PreparedChatText {
  const plain = sanitizePlainText(input);
  if (!plain) return { ok: true, text: '' };
  const mod = applyChatModerationPolicy(plain, options);
  if (mod.blocked) {
    return {
      ok: false,
      text: '',
      message: CHAT_MODERATION_REJECT_MESSAGE,
      reason: mod.reason ?? 'blocked_term',
    };
  }
  return { ok: true, text: mod.text };
}
