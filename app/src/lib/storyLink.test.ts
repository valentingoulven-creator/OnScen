import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORY_LINK_POSITION,
  storyLinkDisplayLabel,
  validateStoryLinkUrl,
} from './storyLink';

describe('storyLink', () => {
  it('validates http and https URLs', () => {
    expect(validateStoryLinkUrl('https://example.com/page').ok).toBe(true);
    expect(validateStoryLinkUrl('http://example.com').ok).toBe(true);
    expect(validateStoryLinkUrl('ftp://example.com').ok).toBe(false);
    expect(validateStoryLinkUrl('example.com').ok).toBe(false);
    expect(validateStoryLinkUrl('').ok).toBe(false);
  });

  it('normalizes valid URL via URL parser', () => {
    const r = validateStoryLinkUrl('https://example.com/path?q=1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toBe('https://example.com/path?q=1');
  });

  it('resolves display label from custom text or domain', () => {
    expect(
      storyLinkDisplayLabel({ url: 'https://www.soundy.com/foo', label: 'Voir plus' })
    ).toBe('Voir plus');
    expect(storyLinkDisplayLabel({ url: 'https://www.soundy.com/foo' })).toBe('soundy.com');
    expect(storyLinkDisplayLabel({ url: 'not-a-url' })).toBe('Voir plus');
  });

  it('exposes default link position', () => {
    expect(DEFAULT_STORY_LINK_POSITION.x).toBe(0.5);
    expect(DEFAULT_STORY_LINK_POSITION.y).toBe(0.78);
  });
});
