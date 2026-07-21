import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../models/schema';
import {
  appendGroupSystemMessage,
  formatGroupSystemContentFr,
  usernameOf,
} from './groupSystemMessages';

const emit = vi.fn();
const to = vi.fn(() => ({ emit }));

vi.mock('./ioInstance', () => ({
  getIo: () => ({ to }),
}));

vi.mock('./persist', () => ({
  schedulePersist: vi.fn(),
}));

describe('groupSystemMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.messageGroups.length = 0;
    db.groupMessages.length = 0;
    db.users.clear();

    db.users.set('alice', {
      id: 'alice',
      username: 'Alice',
      email: 'alice@test.local',
      passwordHash: 'x',
    });
    db.users.set('bob', {
      id: 'bob',
      username: 'Bob',
      email: 'bob@test.local',
      passwordHash: 'x',
    });

    db.messageGroups.push({
      id: 'grp_test',
      name: 'Test Group',
      creatorId: 'alice',
      memberIds: ['alice', 'bob'],
      createdAt: Date.now(),
    });
  });

  it('usernameOf retourne le pseudo ou Membre', () => {
    expect(usernameOf('alice')).toBe('Alice');
    expect(usernameOf('unknown')).toBe('Membre');
  });

  it('formatGroupSystemContentFr couvre les événements principaux', () => {
    expect(
      formatGroupSystemContentFr('group_created', { actorName: 'Alice', newName: 'Jam' })
    ).toContain('Alice');
    expect(
      formatGroupSystemContentFr('group_renamed', { actorName: 'Alice', newName: 'Jam 2' })
    ).toContain('Jam 2');
    expect(
      formatGroupSystemContentFr('member_added', { actorName: 'Alice', targetName: 'Bob' })
    ).toContain('Bob');
    expect(
      formatGroupSystemContentFr('member_left', { actorName: 'Bob', targetName: 'Bob' })
    ).toContain('Bob');
    expect(
      formatGroupSystemContentFr('admin_transferred', { actorName: 'Alice', targetName: 'Bob' })
    ).toContain('administrateur');
  });

  it('appendGroupSystemMessage persiste et émet à tous les membres', () => {
    const msg = appendGroupSystemMessage('grp_test', 'alice', 'group_renamed', {
      actorName: 'Alice',
      newName: 'New Name',
    });

    expect(msg).not.toBeNull();
    expect(msg!.kind).toBe('system');
    expect(msg!.systemEvent).toBe('group_renamed');
    expect(db.groupMessages).toHaveLength(1);
    expect(to).toHaveBeenCalledWith('user_alice');
    expect(to).toHaveBeenCalledWith('user_bob');
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('retourne null si groupe introuvable', () => {
    expect(
      appendGroupSystemMessage('grp_missing', 'alice', 'group_created', {
        actorName: 'Alice',
        newName: 'X',
      })
    ).toBeNull();
  });
});
