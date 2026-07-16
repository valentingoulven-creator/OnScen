import sanitizeHtml from 'sanitize-html';

import { maskProfanity } from './chatTextFilter';

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

/** Chat / DM — assainit le HTML puis masque les insultes grossières. */
export function sanitizeChatText(input: string): string {
  return maskProfanity(sanitizePlainText(input));
}
