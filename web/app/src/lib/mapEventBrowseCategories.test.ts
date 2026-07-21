import { describe, expect, it } from 'vitest';
import {
  classifyCountryEventCategory,
  groupFeedPostsByCountryCategory,
  isCountryFestivalEvent,
} from './mapEventBrowseCategories';
import type { FeedPost } from '../types';

function mockEvent(
  partial: Partial<FeedPost> & Pick<FeedPost, 'content'>
): FeedPost {
  return {
    id: partial.id ?? 'e1',
    userId: 'u1',
    content: partial.content,
    createdAt: 0,
    author: partial.author ?? { id: 'u1', username: 'host' },
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
    isEvent: true,
    eventDate: partial.eventDate ?? '2026-07-21T18:00:00.000Z',
    eventLocation: partial.eventLocation,
    eventType: partial.eventType,
  };
}

describe('mapEventBrowseCategories', () => {
  it('classifies festivals before concerts when keyword present', () => {
    const post = mockEvent({
      content: 'Hilary Hahn — Festival Radio France au Corum',
      eventType: 'chant',
    });
    expect(isCountryFestivalEvent(post)).toBe(true);
    expect(classifyCountryEventCategory(post)).toBe('festivals');
  });

  it('classifies chant events as concert when not a festival', () => {
    const post = mockEvent({
      content: 'Open mic au Rockstore',
      eventType: 'chant',
      eventLocation: 'Le Rockstore, Montpellier',
    });
    expect(classifyCountryEventCategory(post)).toBe('concert');
  });

  it('classifies dance and other non-festival events as artistique', () => {
    expect(
      classifyCountryEventCategory(
        mockEvent({ content: 'Soirée électro', eventType: 'dance' })
      )
    ).toBe('artistique');
    expect(
      classifyCountryEventCategory(
        mockEvent({ content: 'Expo live painting', eventType: 'autre' })
      )
    ).toBe('artistique');
  });

  it('groups posts into concert, festivals and artistique buckets', () => {
    const groups = groupFeedPostsByCountryCategory([
      mockEvent({ id: 'a', content: 'Concert intimiste', eventType: 'chant' }),
      mockEvent({ id: 'b', content: 'Les Déferlantes — Festival rock', eventType: 'autre' }),
      mockEvent({ id: 'c', content: 'Club danse', eventType: 'dance' }),
    ]);
    expect(groups.map((g) => [g.category, g.posts.map((p) => p.id)])).toEqual([
      ['concert', ['a']],
      ['festivals', ['b']],
      ['artistique', ['c']],
    ]);
  });
});
