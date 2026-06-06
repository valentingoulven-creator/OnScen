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

function publisherJsonPath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'legal-publisher.json');
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
  if (!fs.existsSync(file)) return defaults;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<LegalPublisherConfig>;
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

function val(config: LegalPublisherConfig, key: keyof LegalPublisherConfig): string {
  const v = config[key]?.trim();
  return v || PLACEHOLDER(String(key));
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

export function isPublisherConfigComplete(): boolean {
  const c = loadLegalPublisherConfig();
  const required: (keyof LegalPublisherConfig)[] = [
    'publisherName',
    'address',
    'publicationDirector',
    'hostName',
    'hostAddress',
  ];
  return required.every((k) => Boolean(c[k]?.trim()));
}
