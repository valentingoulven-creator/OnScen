import { describe, expect, it } from 'vitest';
import { formatCompactCount, formatEventUpvoteCount, formatFavoritesCountLabel } from './formatCount';

describe('formatEventUpvoteCount', () => {
  it('formats thousands in French compact style', () => {
    expect(formatEventUpvoteCount(6300)).toBe('6,3k');
    expect(formatEventUpvoteCount(999)).toBe('999');
  });
});

describe('formatCompactCount', () => {
  it('affiche les petits nombres tels quels', () => {
    expect(formatCompactCount(0)).toBe('0');
    expect(formatCompactCount(999)).toBe('999');
  });

  it('compacte en K', () => {
    expect(formatCompactCount(1000)).toBe('1K');
    expect(formatCompactCount(1500)).toBe('1.5K');
    expect(formatCompactCount(10000)).toBe('10K');
    expect(formatCompactCount(243_000)).toBe('243K');
  });
});

describe('formatFavoritesCountLabel', () => {
  it('pluralise en français', () => {
    expect(formatFavoritesCountLabel(0)).toBe('0 favoris');
    expect(formatFavoritesCountLabel(1)).toBe('1 favori');
    expect(formatFavoritesCountLabel(12)).toBe('12 favoris');
    expect(formatFavoritesCountLabel(1500)).toBe('1.5K favoris');
  });
});
