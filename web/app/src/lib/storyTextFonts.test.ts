import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORY_TEXT_FONT_ID,
  resolveStoryTextFont,
  STORY_TEXT_FONTS,
} from './storyTextFonts';

describe('storyTextFonts', () => {
  it('exposes distinct font presets with French labels', () => {
    const ids = STORY_TEXT_FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of STORY_TEXT_FONTS) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.fontFamily.length).toBeGreaterThan(0);
    }
  });

  it('resolveStoryTextFont returns default for unknown id', () => {
    const font = resolveStoryTextFont(undefined);
    expect(font.id).toBe(DEFAULT_STORY_TEXT_FONT_ID);
  });

  it('resolveStoryTextFont returns matching preset', () => {
    expect(resolveStoryTextFont('mono').label).toBe('Machine à écrire');
  });
});
