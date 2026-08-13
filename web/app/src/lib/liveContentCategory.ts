export type LiveContentCategory = 'music' | 'dance' | 'artistic';

export const LIVE_CONTENT_CATEGORIES: LiveContentCategory[] = ['music', 'dance', 'artistic'];

export function isLiveContentCategory(value: unknown): value is LiveContentCategory {
  return value === 'music' || value === 'dance' || value === 'artistic';
}

const CATEGORY_I18N_KEY: Record<LiveContentCategory, string> = {
  music: 'setupChatCategoryMusic',
  dance: 'setupChatCategoryDance',
  artistic: 'setupChatCategoryArtistic',
};

export function liveContentCategoryI18nKey(category: LiveContentCategory): string {
  return CATEGORY_I18N_KEY[category];
}

export function liveContentCategorySummaryLabel(category: LiveContentCategory): string {
  switch (category) {
    case 'music':
      return 'Musique';
    case 'dance':
      return 'Danse';
    case 'artistic':
      return 'Artistique';
    default:
      return 'Musique';
  }
}

/** Lives sans catégorie → musique (aligné setup live par défaut). */
export function normalizeLiveContentCategory(
  category?: LiveContentCategory | null
): LiveContentCategory {
  return isLiveContentCategory(category) ? category : 'music';
}

export function filterLivesByContentCategory<T extends { contentCategory?: LiveContentCategory }>(
  lives: T[],
  category: LiveContentCategory
): T[] {
  return lives.filter(
    (live) => normalizeLiveContentCategory(live.contentCategory) === category
  );
}
