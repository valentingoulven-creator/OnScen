import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../models/schema';
import { followUser, setFollowActivityNotifications } from './follows';
import { notifyFollowersCreatorActivity } from './followActivityNotifications';
import { notifyFavoritesLiveStarted } from './favorites';
import { isFollowing } from './follows';

function seedUser(id: string, username = id) {
  db.users.set(id, {
    id,
    username,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  });
}

describe('followActivityNotifications', () => {
  beforeEach(() => {
    db.users.clear();
    db.userFollows.clear();
    db.userFollowNotificationPrefs.clear();
    db.userFavorites.clear();
    db.notifications.length = 0;
    seedUser('host', 'Host');
    seedUser('fan', 'Fan');
    seedUser('muted', 'Muted');
  });

  it('respecte followNotificationsEnabled', async () => {
    followUser('fan', 'host');
    followUser('muted', 'host');
    setFollowActivityNotifications('muted', 'host', false);

    notifyFollowersCreatorActivity({
      creator: { id: 'host', username: 'Host' },
      type: 'track_published',
      message: 'Host morceau',
      compositionId: 'c1',
    });
    await new Promise((r) => setImmediate(r));

    expect(db.notifications.map((n) => n.recipientId)).toEqual(['fan']);
  });

  it('évite double notif favoris si déjà abonné (follow)', async () => {
    followUser('fan', 'host');
    const { addFavorite } = await import('./favorites');
    addFavorite('fan', 'host');

    notifyFollowersCreatorActivity({
      creator: { id: 'host', username: 'Host' },
      type: 'live_started',
      message: 'live',
      liveId: 'live1',
    });
    notifyFavoritesLiveStarted(
      { id: 'host', username: 'Host', email: 'h@t', passwordHash: 'x', meloCoins: 0, isGhostMode: false, lastSeenAt: 0 },
      { id: 'live1', hostId: 'host', hostName: 'Host', title: 'L', platform: 'youtube', playbackState: { platform: 'youtube', trackId: 't', title: 'T', artist: 'A', isPlaying: true, progressMs: 0, updatedAt: 0 }, latitude: 0, longitude: 0, blurredLatitude: 0, blurredLongitude: 0, listenersCount: 0, isGhostMode: false, accessMode: 'public', isPublic: true, allowedUserIds: [], allowQueue: true, createdAt: 0 }
    );
    await new Promise((r) => setImmediate(r));

    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0].type).toBe('live_started');
    expect(isFollowing('fan', 'host')).toBe(true);
  });
});
