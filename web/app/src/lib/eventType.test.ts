import { describe, it, expect } from 'vitest';
import { getEventTypeIcon, getMapEventDisplayIcon, getFeedEventTypeDisplayLabel, getFeedEventTypeDisplayIcon, isFeedEventType } from './eventType';

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

describe('getMapEventDisplayIcon', () => {
  it('force ✨ pour les événements sponsorisés', () => {
    expect(getMapEventDisplayIcon('dance', { sponsored: true })).toBe('✨');
    expect(getMapEventDisplayIcon('chant', { sponsored: true })).toBe('✨');
  });
});

describe('getFeedEventTypeDisplayLabel', () => {
  const t = (key: string) => (key === 'feed.eventTypeChant' ? 'Musique' : 'Autre');

  it('affiche Musique pour dance et chant', () => {
    expect(getFeedEventTypeDisplayLabel(t, 'dance')).toBe('Musique');
    expect(getFeedEventTypeDisplayLabel(t, 'chant')).toBe('Musique');
    expect(getFeedEventTypeDisplayLabel(t, 'autre')).toBe('Autre');
  });
});

describe('getFeedEventTypeDisplayIcon', () => {
  it('utilise l’icône Musique pour dance', () => {
    expect(getFeedEventTypeDisplayIcon('dance')).toBe('🎶');
    expect(getFeedEventTypeDisplayIcon('chant')).toBe('🎶');
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
