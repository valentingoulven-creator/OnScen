import { describe, expect, it } from 'vitest';
import { reelPgVisibility } from './pgReels';
import type { UserReel } from '../models/schema';

function makeReel(overrides: Partial<UserReel> = {}): UserReel {
  return {
    id: 'reel-user-test-1',
    title: 'Test',
    artist: 'Artist',
    genre: 'Pop',
    mediaType: 'video',
    posterUrl: 'https://example.com/poster.jpg',
    authorId: 'user_1',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('reelPgVisibility', () => {
  it('mappe private et public pour la colonne PostgreSQL', () => {
    expect(reelPgVisibility(makeReel({ visibility: 'private' }))).toBe('private');
    expect(reelPgVisibility(makeReel({ visibility: 'public' }))).toBe('public');
    expect(reelPgVisibility(makeReel({ visibility: undefined }))).toBe('public');
  });
});
