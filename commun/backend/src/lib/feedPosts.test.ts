import { beforeEach, describe, expect, it } from 'vitest';
import { db, type FeedPost, type User } from '../models/schema';
import { followUser } from './follows';
import {
  createFeedPost,
  deleteFeedPost,
  hideEventFromOwnProfile,
  invalidateFeedSortCache,
  listFeedPosts,
  resharePost,
  updateFeedPost,
} from './feedPosts';

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

describe('hideEventFromOwnProfile', () => {
  const future = '2026-12-01T20:00:00.000Z';

  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    invalidateFeedSortCache();
    db.users.set('host', seedUser('host'));
    db.users.set('dj', seedUser('dj'));
    seedPost('evt-1', 'host', 1000, {
      isEvent: true,
      eventDate: future,
      eventLocation: 'Montpellier',
      eventTaggedUserIds: ['dj'],
    });
  });

  it('shows a tagged event on the guest profile', () => {
    const posts = listFeedPosts('dj', {
      eventsOnly: true,
      profileUserId: 'dj',
      limit: 50,
    });
    expect(posts.map((p) => p.id)).toEqual(['evt-1']);
  });

  it('lets a tagged user hide the event from their profile only', () => {
    const result = hideEventFromOwnProfile('dj', 'evt-1');
    expect(result.ok).toBe(true);
    const profile = listFeedPosts('dj', {
      eventsOnly: true,
      profileUserId: 'dj',
      limit: 50,
    });
    expect(profile).toEqual([]);
    const map = listFeedPosts('dj', { eventsOnly: true, limit: 50 });
    expect(map.map((p) => p.id)).toEqual(['evt-1']);
    const hostProfile = listFeedPosts('host', {
      eventsOnly: true,
      profileUserId: 'host',
      limit: 50,
    });
    expect(hostProfile.map((p) => p.id)).toEqual(['evt-1']);
  });

  it('rejects the organizer hiding their own event from profile', () => {
    const result = hideEventFromOwnProfile('host', 'evt-1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });
});

describe('updateFeedPost / deleteFeedPost author only', () => {
  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    db.feedPostLikes.clear();
    db.feedPostComments.clear();
    db.feedPostFavorites.clear();
    db.notifications.length = 0;
    invalidateFeedSortCache();
    db.users.set('host', seedUser('host'));
    db.users.set('guest', seedUser('guest'));
  });

  it('keeps existing media when the author only edits text', () => {
    const created = createFeedPost('host', {
      content: 'With photo',
      imageUrl: 'https://onscen.com/media/post.jpg',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = updateFeedPost('host', created.post.id, { content: 'Caption only' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.post.content).toBe('Caption only');
    expect(updated.post.imageUrl).toBe('https://onscen.com/media/post.jpg');
  });

  it('lets the author edit a regular post', () => {
    const created = createFeedPost('host', { content: 'Hello' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = updateFeedPost('host', created.post.id, { content: 'Hello edited' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.post.content).toBe('Hello edited');
  });

  it('rejects a non-author edit', () => {
    const created = createFeedPost('host', { content: 'Hello' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = updateFeedPost('guest', created.post.id, { content: 'Nope' });
    expect(updated.ok).toBe(false);
    if (updated.ok) return;
    expect(updated.status).toBe(403);
  });

  it('lets the event author update location and title', () => {
    const created = createFeedPost('host', {
      content: 'Nuit électro',
      isEvent: true,
      eventDate: '2026-12-01T20:00:00.000Z',
      eventLocation: 'Montpellier',
      eventType: 'autre',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = updateFeedPost('host', created.post.id, {
      content: 'Nuit électro — update',
      isEvent: true,
      eventDate: '2026-12-02T21:00:00.000Z',
      eventLocation: 'Place de la Comédie',
      eventType: 'dance',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.post.eventLocation).toBe('Place de la Comédie');
    expect(updated.post.eventType).toBe('dance');
    expect(updated.post.content).toBe('Nuit électro — update');
  });

  it('lets the reshare author add a caption without changing the original', () => {
    const original = createFeedPost('host', { content: 'Original' });
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    const share = resharePost('guest', original.post.id);
    expect(share.ok).toBe(true);
    if (!share.ok) return;
    const updated = updateFeedPost('guest', share.post.id, { content: 'Mon avis' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.post.content).toBe('Mon avis');
    expect(updated.post.resharedFrom?.content).toBe('Original');
  });

  it('lets the author delete their post and cascades reshares', () => {
    const original = createFeedPost('host', { content: 'Original' });
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    const share = resharePost('guest', original.post.id);
    expect(share.ok).toBe(true);
    if (!share.ok) return;
    const deleted = deleteFeedPost('host', original.post.id);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.deletedIds).toEqual(expect.arrayContaining([original.post.id, share.post.id]));
    expect(db.feedPosts).toEqual([]);
  });

  it('lets the reshare author delete only the reshare', () => {
    const original = createFeedPost('host', { content: 'Original' });
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    const share = resharePost('guest', original.post.id);
    expect(share.ok).toBe(true);
    if (!share.ok) return;
    const deleted = deleteFeedPost('guest', share.post.id);
    expect(deleted.ok).toBe(true);
    expect(db.feedPosts.map((p) => p.id)).toEqual([original.post.id]);
  });

  it('rejects a non-author delete', () => {
    const created = createFeedPost('host', { content: 'Hello' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const deleted = deleteFeedPost('guest', created.post.id);
    expect(deleted.ok).toBe(false);
    if (deleted.ok) return;
    expect(deleted.status).toBe(403);
    expect(db.feedPosts).toHaveLength(1);
  });
});
