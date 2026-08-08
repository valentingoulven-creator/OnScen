/**
 * Termes plateforme OnScen — usage serveur uniquement, jamais exposés via API.
 * Catégories alignées sur les politiques chat (discrimination, harcèlement,
 * grossièretés, spam). Compléter via env CHAT_BLOCKED_TERMS (virgules).
 */

/** Grossièretés : masquées à l'affichage (***), message autorisé. */
export const CHAT_MASK_TERMS: readonly string[] = [
  'putain',
  'merde',
  'connard',
  'connasse',
  'enculé',
  'encule',
  'salope',
  'pute',
  'fdp',
  'ntm',
  'nique',
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'cunt',
  'wanker',
  'bollocks',
  'merdeux',
  'batard',
  'bâtard',
  'enfoiré',
  'enfoire',
  'trouduc',
  'couillon',
  'couille',
];

/**
 * Slurs / haine / menaces graves : message refusé (pas publié).
 * Liste volontairement limitée ; compléter en prod via CHAT_BLOCKED_TERMS.
 */
export const CHAT_BLOCK_TERMS: readonly string[] = [
  'nigger',
  'nigga',
  'negro',
  'faggot',
  'fag',
  'kike',
  'retarded',
  'tapette',
  'kill yourself',
  'kys',
  'suicide toi',
];

/** Phrases spam / arnaque fréquentes (message refusé). */
export const CHAT_BLOCK_SPAM_PHRASES: readonly string[] = [
  'dm me for',
  'message me on whatsapp',
  'crypto giveaway',
  'free followers',
  'gagne de l argent facile',
  'investissement garanti',
  'onlyfans promo',
  'check my page for nudes',
];
