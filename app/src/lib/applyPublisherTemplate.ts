import type { LegalPublisherConfig } from '../types';

const PLACEHOLDER = (label: string) => `[À compléter : ${label}]`;

function val(config: LegalPublisherConfig, key: keyof LegalPublisherConfig): string {
  const v = config[key]?.trim();
  return v || PLACEHOLDER(String(key));
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
    contactEmail: config.contactEmail?.trim() || 'contact@melosong.app',
    privacyEmail: config.privacyEmail?.trim() || 'privacy@melosong.app',
    productionDomain: config.productionDomain?.trim() || PLACEHOLDER('productionDomain'),
  };

  let out = text;
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}
