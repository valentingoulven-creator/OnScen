import { beforeEach, describe, expect, it } from 'vitest';
import { db, type FeedPost, type User } from '../models/schema';
import { followUser } from './follows';
import { listFeedPosts } from './feedPosts';

function seedUser(id: string): User {
  return {
    id,
    username: id,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };
}

function seedPost(
  id: string,
  userId: string,
  createdAt: number,
  extra?: Partial<FeedPost>
): void {
  db.feedPosts.push({
    id,
    userId,
    content: `content ${id}`,
    createdAt,
    ...extra,
  });
}

describe('listFeedPosts followingOnly', () => {
  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    db.userFollows.clear();
    db.users.set('viewer', seedUser('viewer'));
    db.users.set('followed', seedUser('followed'));
    db.users.set('stranger', seedUser('stranger'));
  });

  it('followingOnly retourne posts et événements des suivis + propres publications, triés par createdAt', () => {
    followUser('viewer', 'followed');
    seedPost('post-followed', 'followed', 3000);
    seedPost('event-followed', 'followed', 2000, {
      isEvent: true,
      eventDate: '2026-12-01T20:00:00.000Z',
      eventLocation: 'Paris, France',
    });
    seedPost('post-own', 'viewer', 4000);
    seedPost('post-stranger', 'stranger', 5000);

    const posts = listFeedPosts('viewer', { followingOnly: true, limit: 50 });
    expect(posts.map((p) => p.id)).toEqual(['post-own', 'post-followed', 'event-followed']);
  });

  it('sans followingOnly inclut toutes les publications visibles', () => {
    followUser('viewer', 'followed');
    seedPost('post-followed', 'followed', 3000);
    seedPost('post-stranger', 'stranger', 5000);

    const posts = listFeedPosts('viewer', { limit: 50 });
    expect(posts.map((p) => p.id)).toEqual(['post-stranger', 'post-followed']);
  });
});
