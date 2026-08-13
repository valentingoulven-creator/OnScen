import { describe, expect, it } from 'vitest';
import { feedPostMatchesEventCountry, filterFeedPostsByEventCountry } from './feedEventCountry';
import type { FeedPost } from '../types';

const post = (location: string): Pick<FeedPost, 'eventLocation'> => ({
  eventLocation: location,
});

describe('feedPostMatchesEventCountry', () => {
  it('matches French events for FR', () => {
    expect(feedPostMatchesEventCountry(post('Solar Festival, Le Crès, France'), 'FR')).toBe(true);
  });

  it('rejects non-matching country', () => {
    expect(feedPostMatchesEventCountry(post('Berlin, Germany'), 'FR')).toBe(false);
  });

  it('filters a list by country code', () => {
    const posts = [
      { id: 'a', eventLocation: 'Paris, France' },
      { id: 'b', eventLocation: 'London, UK' },
    ] as FeedPost[];
    expect(filterFeedPostsByEventCountry(posts, 'FR').map((p) => p.id)).toEqual(['a']);
  });
});
