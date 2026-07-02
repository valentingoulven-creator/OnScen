import type { LiveDonationOption } from '../models/schema';

/** Catalogue récompenses par défaut (miroir web/app DEFAULT_LIVE_REWARDS). */
export const DEFAULT_LIVE_DONATION_OPTIONS: LiveDonationOption[] = [
  { id: 'r1', label: 'Demande de musique', amount: 10 },
  { id: 'r2', label: 'Dédicace', amount: 5 },
  { id: 'r3', label: 'Danse spécifique', amount: 15 },
  { id: 'r4', label: 'Accès backstage', amount: 20 },
];

export function defaultDonationOptionsForLive(): LiveDonationOption[] {
  return DEFAULT_LIVE_DONATION_OPTIONS.map((o) => ({ ...o }));
}
