import { describe, expect, it } from 'vitest';
import { parseStoryAppLink } from './storyAppLink';

describe('storyAppLink', () => {
  it('parse album link', () => {
    const target = parseStoryAppLink(
      'https://onscen.com/profile/u1?tab=compositions&album=alb-42'
    );
    expect(target).toEqual({ kind: 'album', userId: 'u1', albumId: 'alb-42' });
  });

  it('parse composition link', () => {
    const target = parseStoryAppLink(
      'https://localhost:5173/profile/creator%201?tab=compositions&track=cmp-9'
    );
    expect(target).toEqual({ kind: 'composition', userId: 'creator 1', compositionId: 'cmp-9' });
  });

  it('rejects external links', () => {
    expect(parseStoryAppLink('https://example.com/profile/u1?tab=compositions&album=a')).toBeNull();
    expect(parseStoryAppLink('https://onscen.com/profile/u1?tab=music')).toBeNull();
  });
});
