import { describe, it, expect } from 'vitest';
import { getEventTypeIcon, isFeedEventType } from './eventType';

describe('getEventTypeIcon', () => {
  it('retourne l’icône selon le type', () => {
    expect(getEventTypeIcon('dance')).toBe('💃');
    expect(getEventTypeIcon('chant')).toBe('🎶');
    expect(getEventTypeIcon('autre')).toBe('✨');
  });

  it('défaut ✨ si type absent', () => {
    expect(getEventTypeIcon()).toBe('✨');
    expect(getEventTypeIcon(null)).toBe('✨');
  });
});

describe('isFeedEventType', () => {
  it('valide les types connus', () => {
    expect(isFeedEventType('dance')).toBe(true);
    expect(isFeedEventType('chant')).toBe(true);
    expect(isFeedEventType('autre')).toBe(true);
    expect(isFeedEventType('concert')).toBe(false);
  });
});
