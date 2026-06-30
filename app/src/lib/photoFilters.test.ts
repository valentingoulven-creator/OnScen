import { describe, expect, it } from 'vitest';
import {
  PHOTO_AI_FILTERS,
  PHOTO_CLASSIC_FILTERS,
  PHOTO_FILTERS,
  getPhotoFilterCss,
  getPhotoFilterLabel,
  isAiPhotoFilter,
} from './photoFilters';

describe('photoFilters', () => {
  it('exposes French labels for classic presets', () => {
    expect(PHOTO_CLASSIC_FILTERS.map((f) => f.label)).toEqual([
      'Aucun',
      'Vif',
      'Chaud',
      'Froid',
      'N&B',
      'Sépia',
    ]);
  });

  it('exposes French labels for royalty-free AI presets', () => {
    expect(PHOTO_AI_FILTERS.map((f) => f.label)).toEqual([
      'Clarendon · punch',
      'Valencia · chaleur',
      'Lark · lumineux',
      'X-Pro · rétro',
      'Lo-fi · grainé',
      'Gingham · pastel',
      'Juno · doux',
      'Aden · froid',
      'Hudson · bleu',
    ]);
    expect(PHOTO_AI_FILTERS).toHaveLength(9);
  });

  it('returns css filter strings', () => {
    expect(getPhotoFilterCss('none')).toBe('none');
    expect(getPhotoFilterCss('bw')).toContain('grayscale');
    expect(getPhotoFilterLabel('sepia')).toBe('Sépia');
    expect(getPhotoFilterCss('ai_xpro')).toContain('hue-rotate');
    expect(getPhotoFilterCss('ai_clarendon')).toContain('contrast');
  });

  it('identifies AI filter category', () => {
    expect(isAiPhotoFilter('ai_clarendon')).toBe(true);
    expect(isAiPhotoFilter('vivid')).toBe(false);
    expect(PHOTO_FILTERS.every((f) => f.category === 'classic' || f.category === 'ai' || f.category === 'atypical')).toBe(true);
  });
});
