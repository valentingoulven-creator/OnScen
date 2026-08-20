import type { LegalPublisherConfig } from '../types';

/** Regex qui détecte les balises de champ non rempli dans un texte rendu */
export const INCOMPLETE_FIELD_REGEX = /\[À compléter\s*:\s*([^\]]+)\]/g;

/**
 * Patterns indicateurs d'une valeur non remplie dans legal-publisher.json.
 * Couvre les valeurs issues de legal-publisher.example.json ou de acompleter.txt.
 */
const PLACEHOLDER_PATTERNS = [
  'à renseigner',
  'acompleter',
  'à compléter',
  '[à compléter',
];

/**
 * Retourne true si la valeur de config est vide ou contient un placeholder non rempli.
 * Permet de détecter les valeurs du fichier exemple non encore remplacées.
 */
function isValueUnset(v: string | undefined): boolean {
  if (!v || !v.trim()) return true;
  const lower = v.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

function val(config: LegalPublisherConfig, key: keyof LegalPublisherConfig): string {
  const v = config[key]?.trim();
  return !v || isValueUnset(v) ? `[À compléter : ${String(key)}]` : v;
}

export function applyPublisherTemplate(text: string, config: LegalPublisherConfig): string {
  const map: Record<string, string> = {
    publisherName: val(config, 'publisherName'),
    legalForm: val(config, 'legalForm'),
    address: val(config, 'address'),
    siren: val(config, 'siren'),
    rcs: val(config, 'rcs'),
    capital: val(config, 'capital'),
    publicationDirector: val(config, 'publicationDirector'),
    hostName: val(config, 'hostName'),
    hostAddress: val(config, 'hostAddress'),
    hostPhone: val(config, 'hostPhone'),
    hostCountry: config.hostCountry?.trim() || 'France',
    mediatorName: config.mediatorName?.trim() || '—',
    mediatorUrl: config.mediatorUrl?.trim() || 'https://ec.europa.eu/consumers/odr/',
    dpoEmail: config.dpoEmail?.trim() || 'non désigné',
    contactEmail: config.contactEmail?.trim() || 'support@onscen.com',
    privacyEmail: config.privacyEmail?.trim() || 'admin@onscen.com',
    productionDomain: config.productionDomain?.trim() || '[À compléter : productionDomain]',
  };

  let out = text;
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}

/** Retourne true si le texte rendu contient encore des champs non remplis */
export function hasIncompleteFields(renderedText: string): boolean {
  return new RegExp(INCOMPLETE_FIELD_REGEX.source).test(renderedText);
}

/**
 * Extrait les noms de champs manquants dans un texte déjà rendu.
 * Ex. "[À compléter : address]" → ["address"]
 */
export function extractMissingFieldKeys(renderedText: string): string[] {
  const regex = new RegExp(INCOMPLETE_FIELD_REGEX.source, 'g');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(renderedText)) !== null) {
    const key = m[1].trim();
    if (!matches.includes(key)) matches.push(key);
  }
  return matches;
}
