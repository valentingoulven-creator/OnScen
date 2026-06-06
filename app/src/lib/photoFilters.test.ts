import { describe, expect, it } from 'vitest';
import { PHOTO_FILTERS, getPhotoFilterCss, getPhotoFilterLabel } from './photoFilters';

describe('photoFilters', () => {
  it('exposes French labels for all presets', () => {
    expect(PHOTO_FILTERS.map((f) => f.label)).toEqual([
      'Aucun',
      'Vif',
      'Chaud',
      'Froid',
      'N&B',
      'Sépia',
    ]);
  });

  it('returns css filter strings', () => {
    expect(getPhotoFilterCss('none')).toBe('none');
    expect(getPhotoFilterCss('bw')).toContain('grayscale');
    expect(getPhotoFilterLabel('sepia')).toBe('Sépia');
  });
});
