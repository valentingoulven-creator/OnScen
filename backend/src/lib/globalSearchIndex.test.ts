import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import { invalidateGlobalSearchIndex, searchUsernamesInIndex } from './globalSearchIndex';

describe('globalSearchIndex', () => {
  beforeEach(() => {
    invalidateGlobalSearchIndex();
    db.users.clear();
  });

  it('finds users by substring', () => {
    db.users.set('u1', {
      id: 'u1',
      username: 'AliceParis',
      email: 'a@test.com',
      passwordHash: 'x',
    } as never);
    db.users.set('u2', {
      id: 'u2',
      username: 'BobLyon',
      email: 'b@test.com',
      passwordHash: 'x',
    } as never);

    const hits = searchUsernamesInIndex('viewer', 'ali', 6);
    expect(hits.map((h) => h.username)).toEqual(['AliceParis']);
  });

  it('rebuilds after invalidate', () => {
    searchUsernamesInIndex('viewer', 'zoe', 6);
    invalidateGlobalSearchIndex();
    db.users.set('u4', {
      id: 'u4',
      username: 'ZoeAntibes',
      email: 'z2@test.com',
      passwordHash: 'x',
    } as never);
    const hits = searchUsernamesInIndex('viewer', 'ant', 6);
    expect(hits.some((h) => h.username === 'ZoeAntibes')).toBe(true);
  });
});
