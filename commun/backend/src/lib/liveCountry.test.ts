import { describe, expect, it } from 'vitest';
import {
  countryFromCoordinates,
  FRANCE_COUNTRY_CODE,
  resolveLiveCountry,
} from './liveCountry';

describe('liveCountry', () => {
  it('détecte la France (Paris)', () => {
    const c = countryFromCoordinates(48.8566, 2.3522);
    expect(c?.code).toBe(FRANCE_COUNTRY_CODE);
    expect(c?.name).toBe('France');
  });

  it('détecte la Belgique (Bruxelles)', () => {
    const c = countryFromCoordinates(50.8503, 4.3517);
    expect(c?.code).toBe('BE');
    expect(c?.name).toBe('Belgique');
  });

  it('détecte la Suisse (Genève)', () => {
    const c = countryFromCoordinates(46.2044, 6.1432);
    expect(c?.code).toBe('CH');
    expect(c?.name).toBe('Suisse');
  });

  it('détecte le Japon (Tokyo)', () => {
    const c = countryFromCoordinates(35.6762, 139.6503);
    expect(c?.code).toBe('JP');
  });

  it('utilise la ville hôte en priorité', () => {
    const c = resolveLiveCountry(48.8566, 2.3522, 'Brussels');
    expect(c?.code).toBe('BE');
  });

  it('parse le pays depuis une étiquette ville', () => {
    const c = resolveLiveCountry(0, 0, 'Montpellier, France');
    expect(c?.code).toBe(FRANCE_COUNTRY_CODE);
  });
});
