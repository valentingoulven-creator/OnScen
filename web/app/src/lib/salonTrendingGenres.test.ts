import { describe, expect, it } from 'vitest';
import { listActiveSalonGenres, rankTrendingSalonGenres, sortGenresByTrendingPriority } from './salonTrendingGenres';

describe('rankTrendingSalonGenres', () => {
  it('pondère par listenersCount', () => {
    const ranked = rankTrendingSalonGenres([
      { genres: ['Électro'], listenersCount: 2 },
      { genres: ['Indie', 'Électro'], listenersCount: 10 },
      { genres: ['Jazz'], listenersCount: 1 },
    ]);
    expect(ranked[0]).toBe('Électro');
    expect(ranked).toContain('Indie');
    expect(ranked).toContain('Jazz');
  });

  it('ignore les salons sans genres', () => {
    expect(rankTrendingSalonGenres([{ listenersCount: 50 }])).toEqual([]);
  });

  it('listActiveSalonGenres retourne tous les genres uniques', () => {
    expect(
      listActiveSalonGenres([
        { genres: ['Électro', 'Indie'], listenersCount: 3 },
        { genres: ['Indie', 'Jazz'], listenersCount: 1 },
      ])
    ).toEqual(['Indie', 'Électro', 'Jazz']);
  });
});

describe('sortGenresByTrendingPriority', () => {
  it('met les tendances en tête', () => {
    const sorted = sortGenresByTrendingPriority(
      ['Rock', 'Trap', 'Pop', 'Cloud rap'],
      ['Trap', 'Cloud rap']
    );
    expect(sorted.slice(0, 2)).toEqual(['Trap', 'Cloud rap']);
  });
});
