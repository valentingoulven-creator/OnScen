/**
 * Filtre texte chat basique — masque les insultes les plus courantes (FR/EN).
 * Complément à la modération image Sightengine ; pas de liste exhaustive.
 */

const PROFANITY = [
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
  'shit',
  'bitch',
  'asshole',
  'bastard',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PROFANITY_RE = new RegExp(
  `\\b(${PROFANITY.map(escapeRegExp).join('|')})\\b`,
  'gi'
);

export function maskProfanity(input: string): string {
  return input.replace(PROFANITY_RE, (match) => '*'.repeat(Math.min(match.length, 6)));
}
