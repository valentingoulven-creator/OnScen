import { describe, expect, it } from 'vitest';
import { db } from '../models/schema';
import { purgeStaleNotifications, runDataRetentionPass } from './dataRetention';

describe('dataRetention', () => {
  it('purges old read notifications', () => {
    const now = Date.now();
    db.notifications.push(
      {
        id: 'n1',
        recipientId: 'u1',
        senderId: 'u2',
        senderName: 'B',
        type: 'follow',
        message: 'old read',
        read: true,
        createdAt: now - 100 * 24 * 60 * 60 * 1000,
      },
      {
        id: 'n2',
        recipientId: 'u1',
        senderId: 'u2',
        senderName: 'B',
        type: 'follow',
        message: 'recent read',
        read: true,
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
      }
    );
    const removed = purgeStaleNotifications(now);
    expect(removed).toBe(1);
    expect(db.notifications.some((n) => n.id === 'n2')).toBe(true);
    db.notifications.length = 0;
  });

  it('runDataRetentionPass completes without error', () => {
    expect(() => runDataRetentionPass()).not.toThrow();
  });
});
