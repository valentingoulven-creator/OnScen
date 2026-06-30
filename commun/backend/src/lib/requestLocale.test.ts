import { describe, expect, it } from 'vitest';
import { geoError, parseRequestLocale } from './requestLocale';

describe('parseRequestLocale', () => {
  it('defaults to fr', () => {
    expect(parseRequestLocale(undefined)).toBe('fr');
  });

  it('detects en', () => {
    expect(parseRequestLocale('en-US,en;q=0.9')).toBe('en');
  });
});

describe('geoError', () => {
  it('returns localized messages', () => {
    expect(geoError('invalidCoords', 'en')).toBe('Invalid coordinates');
    expect(geoError('invalidCoords', 'fr')).toBe('Coordonnées invalides');
  });
});
