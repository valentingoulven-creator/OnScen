import fs from 'fs';
import path from 'path';
import { getMsdevEnvPath } from '../paths';
import { LEGAL_CONTACT_EMAIL, LEGAL_PRIVACY_EMAIL } from './legalConstants';

export interface LegalPublisherConfig {
  publisherName: string;
  legalForm: string;
  address: string;
  siren: string;
  rcs: string;
  capital: string;
  publicationDirector: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  hostCountry: string;
  mediatorName: string;
  mediatorUrl: string;
  dpoEmail: string;
  contactEmail: string;
  privacyEmail: string;
  productionDomain: string;
}

const PLACEHOLDER = (label: string) => `[À compléter : ${label} — voir acompleter.txt]`;

/**
 * Patterns indicateurs d'une valeur non remplie (issue du fichier exemple ou de acompleter.txt).
 * Permet de détecter les valeurs placeholder qui ne sont pas vides mais non significatives.
 */
const PLACEHOLDER_PATTERNS = [
  'à renseigner',
  'acompleter',
  'à compléter',
  '[à compléter',
  'adresse postale complète à renseigner',
];

function isValueUnset(v: string | undefined): boolean {
  if (!v || !v.trim()) return true;
  const lower = v.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function publisherJsonPath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'legal-publisher.json');
}

/** Overrides depuis .env (secrets / adresse non versionnée en Git). */
function applyLegalPublisherEnvOverrides(config: LegalPublisherConfig): LegalPublisherConfig {
  const address = process.env.LEGAL_PUBLISHER_ADDRESS?.trim();
  if (address) config.address = address;

  const publisherName = process.env.LEGAL_PUBLISHER_NAME?.trim();
  if (publisherName) config.publisherName = publisherName;

  const siren = process.env.LEGAL_PUBLISHER_SIREN?.trim();
  if (siren) config.siren = siren;

  return config;
}

export function loadLegalPublisherConfig(): LegalPublisherConfig {
  const defaults: LegalPublisherConfig = {
    publisherName: '',
    legalForm: '',
    address: '',
    siren: '',
    rcs: '',
    capital: '',
    publicationDirector: '',
    hostName: '',
    hostAddress: '',
    hostPhone: '',
    hostCountry: 'France',
    mediatorName: '',
    mediatorUrl: '',
    dpoEmail: '',
    contactEmail: LEGAL_CONTACT_EMAIL,
    privacyEmail: LEGAL_PRIVACY_EMAIL,
    productionDomain: '',
  };

  const file = publisherJsonPath();
  if (!fs.existsSync(file)) return applyLegalPublisherEnvOverrides(defaults);

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LegalPublisherConfig>;
    return applyLegalPublisherEnvOverrides({ ...defaults, ...raw });
  } catch {
    return applyLegalPublisherEnvOverrides(defaults);
  }
}

function val(config: LegalPublisherConfig, key: keyof LegalPublisherConfig): string {
  const v = config[key]?.trim();
  return !v || isValueUnset(v) ? PLACEHOLDER(String(key)) : v;
}

export function applyPublisherTemplate(text: string, config?: LegalPublisherConfig): string {
  const c = config ?? loadLegalPublisherConfig();
  const map: Record<string, string> = {
    publisherName: val(c, 'publisherName'),
    legalForm: val(c, 'legalForm'),
    address: val(c, 'address'),
    siren: val(c, 'siren'),
    rcs: val(c, 'rcs'),
    capital: val(c, 'capital'),
    publicationDirector: val(c, 'publicationDirector'),
    hostName: val(c, 'hostName'),
    hostAddress: val(c, 'hostAddress'),
    hostPhone: val(c, 'hostPhone'),
    hostCountry: val(c, 'hostCountry') || 'France',
    mediatorName: c.mediatorName.trim() || '—',
    mediatorUrl: c.mediatorUrl.trim() || 'https://ec.europa.eu/consumers/odr/',
    dpoEmail: c.dpoEmail.trim() || 'non désigné',
    contactEmail: c.contactEmail.trim() || LEGAL_CONTACT_EMAIL,
    privacyEmail: c.privacyEmail.trim() || LEGAL_PRIVACY_EMAIL,
    productionDomain: c.productionDomain.trim() || PLACEHOLDER('productionDomain'),
  };

  let out = text;
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}

/**
 * Vérifie si la configuration éditeur est complète au sens LCEN minimal.
 *
 * Champs requis par la loi (LCEN art. 6) :
 *   publisherName, legalForm, address, siren, publicationDirector,
 *   hostName, hostAddress, hostPhone
 *
 * Cette fonction détecte également les valeurs placeholder non remplacées
 * (ex. "adresse postale complète à renseigner") qui ne sont pas vides
 * mais ne constituent pas des informations légalement valables.
 */
export function isPublisherConfigComplete(): boolean {
  const c = loadLegalPublisherConfig();
  const required: (keyof LegalPublisherConfig)[] = [
    'publisherName',
    'legalForm',
    'address',
    'siren',
    'publicationDirector',
    'hostName',
    'hostAddress',
    'hostPhone',
  ];
  return required.every((k) => !isValueUnset(c[k]));
}
