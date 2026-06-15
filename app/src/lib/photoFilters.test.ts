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
      'Amélioration IA',
      'Portrait éclat',
      'Cinéma IA',
      'Vintage IA',
      'Néon nocturne',
      'Rêve pastel',
    ]);
  });

  it('returns css filter strings', () => {
    expect(getPhotoFilterCss('none')).toBe('none');
    expect(getPhotoFilterCss('bw')).toContain('grayscale');
    expect(getPhotoFilterLabel('sepia')).toBe('Sépia');
    expect(getPhotoFilterCss('ai_cinematic')).toContain('hue-rotate');
  });

  it('identifies AI filter category', () => {
    expect(isAiPhotoFilter('ai_enhance')).toBe(true);
    expect(isAiPhotoFilter('vivid')).toBe(false);
    expect(PHOTO_FILTERS.every((f) => f.category === 'classic' || f.category === 'ai')).toBe(true);
  });
});
