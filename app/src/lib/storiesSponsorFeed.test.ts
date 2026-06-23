import { describe, expect, it } from 'vitest';
import type { ReelsSponsorAd } from '../types';
import type { MapStory } from '../types';
import type { StoryUserStack } from './storyViewerNav';
import {
  buildStoryViewerTimeline,
  DEFAULT_STORIES_SPONSOR_CONFIG,
  normalizeStoriesSponsorEveryN,
  storiesSponsorDisplayKey,
} from './storiesSponsorFeed';

function mockStory(id: string): MapStory {
  return {
    id,
    userId: 'u1',
    author: { id: 'u1', username: 'user' },
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };
}

function mockStack(stories: MapStory[]): StoryUserStack {
  return {
    userId: stories[0]?.userId ?? 'u1',
    stories,
  };
}

function mockAd(id: string): ReelsSponsorAd {
  return {
    id,
    title: 'Sponsor',
    subtitle: 'Offre',
    cta: 'Voir',
    accent: 'purple',
    kind: 'sponsored',
    posterUrl: 'https://example.com/ad.jpg',
  };
}

describe('storiesSponsorFeed', () => {
  it('normalise storiesSponsorEveryN entre 1 et 50', () => {
    expect(normalizeStoriesSponsorEveryN(0)).toBe(1);
    expect(normalizeStoriesSponsorEveryN(100)).toBe(50);
    expect(normalizeStoriesSponsorEveryN(4)).toBe(4);
  });

  it('n’insère pas de sponsor si désactivé ou liste vide', () => {
    const stacks = [mockStack([mockStory('s1'), mockStory('s2')])];
    expect(
      buildStoryViewerTimeline(stacks, [mockAd('a1')], {
        ...DEFAULT_STORIES_SPONSOR_CONFIG,
        storiesSponsorEnabled: false,
      }).length
    ).toBe(2);
    expect(buildStoryViewerTimeline(stacks, [], DEFAULT_STORIES_SPONSOR_CONFIG).length).toBe(2);
  });

  it('insère une pub tous les N segments story', () => {
    const stacks = [
      mockStack([
        mockStory('s1'),
        mockStory('s2'),
        mockStory('s3'),
        mockStory('s4'),
        mockStory('s5'),
        mockStory('s6'),
      ]),
    ];
    const timeline = buildStoryViewerTimeline(stacks, [mockAd('a1')], {
      storiesSponsorEnabled: true,
      storiesSponsorEveryN: 2,
    });
    const keys = timeline.map((item) =>
      item.kind === 'story' ? item.story.id : item.key
    );
    expect(keys).toEqual([
      's1',
      's2',
      storiesSponsorDisplayKey(mockAd('a1'), 0),
      's3',
      's4',
      storiesSponsorDisplayKey(mockAd('a1'), 1),
      's5',
      's6',
      storiesSponsorDisplayKey(mockAd('a1'), 2),
    ]);
  });
});
