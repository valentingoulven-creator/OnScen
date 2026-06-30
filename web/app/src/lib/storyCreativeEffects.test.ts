import { describe, expect, it } from 'vitest';
import {
  DUOTONE_GENRE_PRESETS,
  resolveDuotoneGenre,
  waveformSeedFromText,
} from './storyCreativeEffects';

describe('storyCreativeEffects', () => {
  it('resolveDuotoneGenre defaults', () => {
    expect(resolveDuotoneGenre(null).id).toBe('default');
    expect(resolveDuotoneGenre('electro').id).toBe('electro');
  });

  it('waveformSeedFromText', () => {
    expect(waveformSeedFromText('Track', 'Artist')).toBe('track|artist');
    expect(waveformSeedFromText()).toBe('soundy');
  });

  it('has genre presets', () => {
    expect(DUOTONE_GENRE_PRESETS.length).toBeGreaterThan(4);
  });
});
