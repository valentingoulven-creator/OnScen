import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DEFAULT_FEED_USER_PREFS,
  DEFAULT_NEWS_USER_PREFS,
  HOME_FEED_DISPLAY_PREFS,
  feedPrefsFiltersActive,
  newsPrefsFiltersActive,
  readFeedUserPrefs,
  readNewsUserPrefs,
  writeFeedUserPrefs,
  writeNewsUserPrefs,
} from './feedUserPrefs';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  });
}

describe('feedUserPrefs', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('persiste audienceScope et rôles', () => {
    writeFeedUserPrefs({
      audienceScope: 'favorites_only',
      profileTypes: ['dj'],
      musicalAffinitiesOnly: true,
      favoritesFirst: true,
    });
    expect(readFeedUserPrefs()).toEqual({
      audienceScope: 'favorites_only',
      profileTypes: ['dj'],
      musicalAffinitiesOnly: true,
      favoritesFirst: true,
    });
  });

  it('favoritesFirst est true par défaut', () => {
    expect(readFeedUserPrefs().favoritesFirst).toBe(true);
  });

  it('détecte filtres actifs', () => {
    expect(feedPrefsFiltersActive(DEFAULT_FEED_USER_PREFS)).toBe(false);
    expect(
      feedPrefsFiltersActive({ ...DEFAULT_FEED_USER_PREFS, profileTypes: ['bar'] })
    ).toBe(true);
  });

  it('HOME_FEED_DISPLAY_PREFS n active aucun filtre utilisateur', () => {
    expect(HOME_FEED_DISPLAY_PREFS.profileTypes).toEqual([]);
    expect(HOME_FEED_DISPLAY_PREFS.musicalAffinitiesOnly).toBe(false);
    expect(HOME_FEED_DISPLAY_PREFS.audienceScope).toBe('all');
    expect(HOME_FEED_DISPLAY_PREFS.favoritesFirst).toBe(false);
    expect(feedPrefsFiltersActive(HOME_FEED_DISPLAY_PREFS)).toBe(false);
  });
});

describe('newsUserPrefs', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('persiste catégories et affinités', () => {
    writeNewsUserPrefs({
      categories: ['musique', 'promo'],
      musicalAffinitiesOnly: true,
    });
    expect(readNewsUserPrefs()).toEqual({
      categories: ['musique', 'promo'],
      musicalAffinitiesOnly: true,
    });
  });

  it('détecte filtres news actifs', () => {
    expect(newsPrefsFiltersActive(DEFAULT_NEWS_USER_PREFS)).toBe(false);
    expect(
      newsPrefsFiltersActive({ ...DEFAULT_NEWS_USER_PREFS, categories: ['une'] })
    ).toBe(true);
    expect(
      newsPrefsFiltersActive({ ...DEFAULT_NEWS_USER_PREFS, musicalAffinitiesOnly: true })
    ).toBe(true);
  });

  it('migre musicalAffinitiesOnly depuis melosong_feed_prefs', () => {
    writeFeedUserPrefs({
      ...DEFAULT_FEED_USER_PREFS,
      musicalAffinitiesOnly: true,
      profileTypes: ['dj'],
    });
    expect(readNewsUserPrefs()).toEqual({
      categories: [],
      musicalAffinitiesOnly: true,
    });
  });
});
