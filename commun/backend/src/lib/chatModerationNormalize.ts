/**
 * Normalisation du texte avant filtres chat (contournements type leetspeak,
 * espaces entre lettres, accents). Inspiré des pratiques Twitch / Meta / TikTok
 * — liste de termes séparée, non publiée côté client.
 */

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '€': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  $: 's',
  '7': 't',
};

/** Texte en minuscules, sans accents, leetspeak partiel, ponctuation → espaces. */
export function normalizeForChatModeration(input: string): string {
  let s = input.toLowerCase().normalize('NFKD');
  s = s.replace(/\p{M}/gu, '');
  for (const [from, to] of Object.entries(LEET_MAP)) {
    s = s.split(from).join(to);
  }
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Variante sans espaces (ex. « p u t a i n »). */
export function compactForChatModeration(normalized: string): string {
  return normalized.replace(/\s/g, '');
}
