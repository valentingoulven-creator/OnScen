import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from './models/schema';
import { addFavorite } from './lib/favorites';
import { listStoriesForViewer } from './lib/stories';
import {
  countFollowedAuthorsWithActiveStories,
  MSDEV_STORY_MIN_AUTHORS,
  needsMsdevStoriesRepair,
  seedMsdevStories,
} from './seed-msdev-stories';
import { MSDEV_LISTENER_ID } from './seed-favorite-feed';

function seedUser(id: string, username: string) {
  db.users.set(id, {
    id,
    username,
    email: `${id}@msdev.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`,
    latitude: 48.8566,
    longitude: 2.3522,
    blurredLatitude: 48.8566,
    blurredLongitude: 2.3522,
    lastSeenAt: Date.now(),
  });
}

describe('seedMsdevStories', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, APP_ENV: 'msdev' };
    db.users.clear();
    db.stories.length = 0;
    db.userFavorites.clear();

    seedUser(MSDEV_LISTENER_ID, 'Auditeur');
    for (const id of ['user_dj', 'user_bass', 'bot_luna', 'bot_nova', 'bot_kira']) {
      seedUser(id, id);
      addFavorite(MSDEV_LISTENER_ID, id);
    }
  });

  afterEach(() => {
    process.env = envBackup;
    db.users.clear();
    db.stories.length = 0;
    db.userFavorites.clear();
  });

  it('detecte un fil stories vide pour les favoris', () => {
    expect(needsMsdevStoriesRepair(MSDEV_LISTENER_ID)).toBe(true);
  });

  it('crée des stories visibles pour listener@msdev.local', () => {
    const result = seedMsdevStories();
    expect(result.created).toBeGreaterThan(0);
    expect(result.authorsWithStories).toBeGreaterThanOrEqual(MSDEV_STORY_MIN_AUTHORS);

    const visible = listStoriesForViewer(MSDEV_LISTENER_ID);
    expect(visible.length).toBeGreaterThan(0);
    for (const story of visible) {
      expect(story.imageUrl?.startsWith('https://')).toBe(true);
      expect(story.author.id).not.toBe(MSDEV_LISTENER_ID);
    }
  });

  it('est idempotent sans force', () => {
    seedMsdevStories();
    const second = seedMsdevStories();
    expect(second.created).toBe(0);
    expect(countFollowedAuthorsWithActiveStories(MSDEV_LISTENER_ID)).toBeGreaterThanOrEqual(
      MSDEV_STORY_MIN_AUTHORS
    );
  });

  it('force regénère les stories seed', () => {
    seedMsdevStories();
    const forced = seedMsdevStories({ force: true });
    expect(forced.removed).toBeGreaterThan(0);
    expect(forced.created).toBeGreaterThan(0);
  });
});
