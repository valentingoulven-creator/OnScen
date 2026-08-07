import { beforeEach, describe, expect, it } from 'vitest';
import { db, User } from '../models/schema';
import { followUser, notifyFollowersSalonCreated, setFollowActivityNotifications } from './follows';
import {
  hasUnreadDmFromSender,
  notifyContentHeartReceived,
  notifyDmReceived,
  notifyEventCreated,
  notifyFollowReceived,
} from './notifications';

function seedUser(id: string, username = id): User {
  return {
    id,
    username,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };
}

describe('notifications', () => {
  beforeEach(() => {
    db.users.clear();
    db.userFollows.clear();
    db.userFollowNotificationPrefs.clear();
    db.userFavorites.clear();
    db.notifications.length = 0;
    db.users.set('alice', seedUser('alice', 'Alice'));
    db.users.set('bob', seedUser('bob', 'Bob'));
    db.users.set('carol', seedUser('carol', 'Carol'));
  });

  it('notifyFollowReceived crée une notification follow en français', () => {
    notifyFollowReceived({
      recipientId: 'bob',
      sender: { id: 'alice', username: 'Alice' },
    });
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]).toMatchObject({
      recipientId: 'bob',
      senderId: 'alice',
      type: 'follow',
      message: 'Alice vous suit maintenant 👤',
    });
  });

  it('notifyContentHeartReceived ignore le self-like', () => {
    notifyContentHeartReceived({
      recipientId: 'alice',
      sender: { id: 'alice', username: 'Alice' },
      target: { kind: 'post', id: 'post-1' },
    });
    expect(db.notifications).toHaveLength(0);
  });

  it('notifyContentHeartReceived notifie le propriétaire du contenu', () => {
    notifyContentHeartReceived({
      recipientId: 'bob',
      sender: { id: 'alice', username: 'Alice' },
      target: { kind: 'reel', id: 'reel-1' },
    });
    expect(db.notifications[0]).toMatchObject({
      recipientId: 'bob',
      type: 'content_heart',
      reelId: 'reel-1',
      message: 'Alice a aimé votre reel ❤️',
    });
  });

  it('notifyDmReceived évite le spam tant que la notif DM est non lue', () => {
    notifyDmReceived({
      recipientId: 'bob',
      sender: { id: 'alice', username: 'Alice' },
      preview: 'Salut',
    });
    notifyDmReceived({
      recipientId: 'bob',
      sender: { id: 'alice', username: 'Alice' },
      preview: 'Deuxième message',
    });
    expect(db.notifications.filter((n) => n.type === 'dm_message')).toHaveLength(1);
    expect(hasUnreadDmFromSender('bob', 'alice')).toBe(true);
  });

  it('notifyEventCreated notifie les abonnés avec mute follow', async () => {
    followUser('alice', 'bob');
    followUser('carol', 'bob');
    setFollowActivityNotifications('carol', 'bob', false);

    notifyEventCreated({
      creator: { id: 'bob', username: 'Bob' },
      postId: 'event-1',
      eventLocation: 'Paris',
    });

    await new Promise((resolve) => setImmediate(resolve));

    const recipients = db.notifications.map((n) => n.recipientId).sort();
    expect(recipients).toEqual(['alice']);
    expect(db.notifications[0].type).toBe('event_created');
    expect(db.notifications[0].message).toContain('Bob a créé un événement');
    expect(db.notifications[0].message).toContain('Paris');
  });

  it('notifyFollowersSalonCreated notifie les abonnés sans inclure le host', async () => {
    followUser('alice', 'bob');
    followUser('carol', 'bob');

    notifyFollowersSalonCreated(
      { id: 'bob', username: 'Bob', email: 'bob@test.local', passwordHash: 'x', meloCoins: 0, isGhostMode: false, lastSeenAt: Date.now() },
      {
        id: 'salon_1',
        hostId: 'bob',
        hostName: 'Bob',
        title: 'Session Jazz',
        platform: 'youtube',
        playbackState: {
          platform: 'youtube',
          trackId: 'demo',
          title: 'Track',
          artist: 'Artist',
          isPlaying: true,
          progressMs: 0,
          updatedAt: Date.now(),
        },
        latitude: 48.8,
        longitude: 2.3,
        blurredLatitude: 48.8,
        blurredLongitude: 2.3,
        listenersCount: 0,
        isGhostMode: false,
        accessMode: 'public',
        isPublic: true,
        allowedUserIds: ['bob'],
        allowQueue: true,
        createdAt: Date.now(),
      }
    );

    // notifyFollowersSalonCreated dispatche via runInBatchesAsync (setImmediate) pour ne pas
    // bloquer l'event loop — laisser passer un tick avant de vérifier les notifications créées.
    await new Promise((resolve) => setImmediate(resolve));

    const recipients = db.notifications.map((n) => n.recipientId).sort();
    expect(recipients).toEqual(['alice', 'carol']);
    expect(db.notifications[0]).toMatchObject({
      type: 'salon_created',
      salonId: 'salon_1',
      senderId: 'bob',
    });
    expect(db.notifications[0].message).toContain('Session Jazz');
  });
});
