import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './models/schema';
import {
  countFeedEventPosts,
  EVENT_POST_ID_PREFIX,
  FEED_EVENT_SEEDS,
  needsFeedEventsRepair,
  seedFeedEvents,
} from './seed-feed-events';

const ENV_KEYS = ['APP_ENV', 'MSENV'] as const;
const prevEnv: Record<string, string | undefined> = {};

function seedDemoAuthors() {
  for (const userId of ['user_dj', 'user_bass', 'user_listener']) {
    db.users.set(userId, {
      id: userId,
      username: userId,
      email: `${userId}@msdev.local`,
      passwordHash: 'hash',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
    });
  }
}

describe('seedFeedEvents', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prevEnv[key] = process.env[key];
    }
    process.env.MSENV = 'msdev';
    process.env.APP_ENV = 'msdev';
    db.feedPosts.length = 0;
    db.users.clear();
    seedDemoAuthors();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prevEnv[key] === undefined) delete process.env[key];
      else process.env[key] = prevEnv[key];
    }
  });

  it('crée les événements seed avec isEvent et lieux FR', () => {
    const result = seedFeedEvents();
    expect(result.created).toBe(FEED_EVENT_SEEDS.length);
    expect(countFeedEventPosts()).toBe(FEED_EVENT_SEEDS.length);

    const paris = db.feedPosts.filter((p) => p.eventLocation?.includes('Paris'));
    const montpellier = db.feedPosts.filter((p) => p.eventLocation?.includes('Montpellier'));
    expect(paris.length).toBeGreaterThanOrEqual(5);
    expect(montpellier.length).toBeGreaterThanOrEqual(5);

    for (const post of db.feedPosts.filter((p) => p.id.startsWith(EVENT_POST_ID_PREFIX))) {
      expect(post.isEvent).toBe(true);
      expect(post.eventDate).toMatch(/^2026-0[67]/);
      expect(post.eventLocation?.toLowerCase()).toContain('france');
      expect(['dance', 'chant', 'autre']).toContain(post.eventType);
    }

    const types = new Set(
      db.feedPosts
        .filter((p) => p.id.startsWith(EVENT_POST_ID_PREFIX))
        .map((p) => p.eventType)
    );
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('est idempotent au second appel', () => {
    seedFeedEvents();
    const second = seedFeedEvents();
    expect(second.created).toBe(0);
    expect(second.total).toBe(FEED_EVENT_SEEDS.length);
  });

  it('needsFeedEventsRepair détecte les posts manquants', () => {
    expect(needsFeedEventsRepair()).toBe(true);
    seedFeedEvents();
    expect(needsFeedEventsRepair()).toBe(false);
  });
});
