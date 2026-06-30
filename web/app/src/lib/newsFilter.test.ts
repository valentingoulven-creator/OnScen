import { describe, expect, it } from 'vitest';
import { applyNewsPreferences } from './newsFilter';
import { DEFAULT_NEWS_USER_PREFS, type NewsUserPrefs } from './feedUserPrefs';
import type { MusicNewsItem } from '../types';

function news(
  id: string,
  category: MusicNewsItem['category'],
  extra?: Partial<MusicNewsItem>
): MusicNewsItem {
  return {
    id,
    type: 'news',
    category,
    title: `News ${id}`,
    excerpt: 'Excerpt',
    publishedAt: 1_700_000_000_000,
    ...extra,
  };
}

describe('applyNewsPreferences', () => {
  const items = [
    news('1', 'une', { genres: ['Jazz'] }),
    news('2', 'musique', { genres: ['Rock'] }),
    news('3', 'promo'),
    news('4', 'tendance', { artist: 'Daft Punk', genres: ['Electro'] }),
  ];

  it('laisse tout passer par défaut', () => {
    expect(applyNewsPreferences(items, DEFAULT_NEWS_USER_PREFS)).toHaveLength(4);
  });

  it('filtre par catégorie', () => {
    const prefs: NewsUserPrefs = { ...DEFAULT_NEWS_USER_PREFS, categories: ['musique', 'promo'] };
    const ids = applyNewsPreferences(items, prefs).map((n) => n.id);
    expect(ids).toEqual(['2', '3']);
  });

  it('filtre par affinités musicales (genres)', () => {
    const prefs: NewsUserPrefs = { ...DEFAULT_NEWS_USER_PREFS, musicalAffinitiesOnly: true };
    const viewerTastes = { favoriteGenres: ['Jazz'] };
    const ids = applyNewsPreferences(items, prefs, viewerTastes).map((n) => n.id);
    expect(ids).toEqual(['1']);
  });

  it('filtre par affinités musicales (artistes)', () => {
    const prefs: NewsUserPrefs = { ...DEFAULT_NEWS_USER_PREFS, musicalAffinitiesOnly: true };
    const viewerTastes = { favoriteArtists: ['Daft Punk'] };
    const ids = applyNewsPreferences(items, prefs, viewerTastes).map((n) => n.id);
    expect(ids).toEqual(['4']);
  });
});
